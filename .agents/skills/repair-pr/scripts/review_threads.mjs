#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const CODEX_CONNECTOR_LOGINS = new Set([
  "chatgpt-codex-connector",
  "chatgpt-codex-connector[bot]",
]);
const GH_TIMEOUT_SECONDS = 60;

function outputText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  return String(value);
}

function commandDetail(stderr, stdout) {
  return outputText(stderr).trim() || outputText(stdout).trim();
}

function commandString(args) {
  return ["gh", ...args].join(" ");
}

function runJson(args) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    timeout: GH_TIMEOUT_SECONDS * 1000,
  });

  if (result.error) {
    const detail = commandDetail(result.stderr, result.stdout);
    const suffix = detail ? `: ${detail}` : "";
    if (result.error.code === "ETIMEDOUT") {
      throw new Error(
        `${commandString(args)} timed out after ${GH_TIMEOUT_SECONDS}s${suffix}`,
      );
    }
    throw new Error(
      `${commandString(args)} failed: ${result.error.message}${suffix}`,
    );
  }

  if (result.status !== 0) {
    const detail = commandDetail(result.stderr, result.stdout);
    throw new Error(`${commandString(args)} failed: ${detail}`);
  }

  return JSON.parse(result.stdout);
}

function parseRepoArg(repo) {
  const parts = repo.split("/");
  if (parts.length === 2 && parts.every(Boolean)) {
    const [owner, name] = parts;
    return { host: null, owner, name };
  }
  if (parts.length === 3 && parts.every(Boolean)) {
    const [host, owner, name] = parts;
    return { host, owner, name };
  }
  throw new Error("--repo must use [HOST/]OWNER/REPO format");
}

function repoReference(repo) {
  if (repo) {
    return parseRepoArg(repo);
  }

  const payload = runJson(["repo", "view", "--json", "owner,name,url"]);
  const owner = payload.owner?.login;
  const name = payload.name;
  if (!owner || !name) {
    throw new Error("gh repo view did not return repository owner/name");
  }

  let host = null;
  if (payload.url) {
    host = new URL(payload.url).hostname;
  }
  return { host, owner, name };
}

function ghGraphqlArgs(host) {
  const args = ["api", "graphql"];
  if (host) {
    args.push("--hostname", host);
  }
  return args;
}

const REVIEW_THREADS_QUERY = `
query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          originalLine
          originalStartLine
          comments(first: 100) {
            nodes {
              id
              author {
                login
              }
              body
              path
              line
              originalLine
              url
              createdAt
              updatedAt
            }
          }
        }
      }
    }
  }
}
`;

const RESOLVE_REVIEW_THREAD_MUTATION = `
mutation($threadId: ID!) {
  resolveReviewThread(input: {threadId: $threadId}) {
    thread {
      id
      isResolved
    }
  }
}
`;

function reviewThreadsConnection(payload) {
  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }

  const repository = payload.data?.repository;
  if (!repository) {
    throw new Error("GitHub GraphQL response did not include repository data");
  }

  const pullRequest = repository.pullRequest;
  if (!pullRequest) {
    throw new Error(
      "GitHub GraphQL response did not include pull request data",
    );
  }

  const connection = pullRequest.reviewThreads;
  if (!connection) {
    throw new Error("GitHub GraphQL response did not include review threads");
  }
  return connection;
}

function fetchReviewThreads(prNumber, repo) {
  const { host, owner, name } = repoReference(repo);
  const threads = [];
  let after = null;

  while (true) {
    const args = ghGraphqlArgs(host);
    args.push(
      "-f",
      `owner=${owner}`,
      "-f",
      `name=${name}`,
      "-F",
      `number=${prNumber}`,
      "-f",
      `query=${REVIEW_THREADS_QUERY}`,
    );
    if (after) {
      args.push("-f", `after=${after}`);
    }

    const payload = runJson(args);
    const connection = reviewThreadsConnection(payload);
    threads.push(...(connection.nodes ?? []));

    const pageInfo = connection.pageInfo ?? {};
    if (!pageInfo.hasNextPage) {
      return { host, owner, name, threads };
    }
    after = pageInfo.endCursor;
  }
}

function authorLogin(comment) {
  return comment.author?.login ?? null;
}

function isCodexConnectorComment(comment) {
  return CODEX_CONNECTOR_LOGINS.has(authorLogin(comment));
}

function firstThreadComment(thread) {
  const comments = thread.comments?.nodes ?? [];
  return comments[0] ?? {};
}

function isCodexConnectorThread(thread) {
  return isCodexConnectorComment(firstThreadComment(thread));
}

function codexOrFirstComment(thread) {
  const firstComment = firstThreadComment(thread);
  return isCodexConnectorComment(firstComment) ? firstComment : {};
}

function isUnresolvedCodexThread(thread) {
  if (thread.isResolved) {
    return false;
  }
  return isCodexConnectorThread(thread);
}

function unresolvedCodexThreads(threads) {
  return threads.filter(isUnresolvedCodexThread);
}

function threadLocation(thread, comment) {
  const path = comment.path || thread.path || "unknown path";
  const line =
    comment.line ||
    comment.originalLine ||
    thread.line ||
    thread.originalLine ||
    thread.startLine ||
    thread.originalStartLine ||
    null;
  return line ? `${path}:${line}` : path;
}

function summarizeBody(body) {
  let summary = (body || "").split(/\s+/).filter(Boolean).join(" ");
  if (summary.length > 180) {
    summary = `${summary.slice(0, 177)}...`;
  }
  return summary;
}

function serializeThread(thread) {
  const comment = codexOrFirstComment(thread);
  return {
    id: thread.id,
    isResolved: Boolean(thread.isResolved),
    isOutdated: Boolean(thread.isOutdated),
    path: comment.path || thread.path || null,
    line:
      comment.line ||
      comment.originalLine ||
      thread.line ||
      thread.originalLine ||
      thread.startLine ||
      thread.originalStartLine ||
      null,
    location: threadLocation(thread, comment),
    url: comment.url || null,
    author: authorLogin(comment),
    summary: summarizeBody(comment.body),
  };
}

function printThreads(threads) {
  const matches = unresolvedCodexThreads(threads);
  console.log(`Unresolved chatgpt-codex-connector threads: ${matches.length}`);
  for (const thread of matches) {
    const details = serializeThread(thread);
    const outdated = details.isOutdated ? " outdated=true" : "";
    console.log(`  - ${details.id} ${details.location}${outdated}`);
    if (details.url) {
      console.log(`    ${details.url}`);
    }
    if (details.summary) {
      console.log(`    ${details.summary}`);
    }
  }
}

function resolveReviewThread(host, threadId) {
  const args = ghGraphqlArgs(host);
  args.push(
    "-f",
    `threadId=${threadId}`,
    "-f",
    `query=${RESOLVE_REVIEW_THREAD_MUTATION}`,
  );

  const payload = runJson(args);
  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }

  const thread = payload.data?.resolveReviewThread?.thread;
  if (!thread) {
    throw new Error(
      "GitHub GraphQL response did not include resolved thread data",
    );
  }
  return thread;
}

function printHelp() {
  console.log(`usage: review_threads.mjs [-h] [--repo REPO] [--json] [--resolve THREAD_ID] pr_number

List or resolve unresolved chatgpt-codex-connector inline review threads.

positional arguments:
  pr_number              Pull request number

optional arguments:
  -h, --help             show this help message and exit
  --repo REPO            GitHub repository in [HOST/]OWNER/REPO form
  --json                 print unresolved Codex connector threads as JSON
  --resolve THREAD_ID    resolve one unresolved Codex connector review thread`);
}

function parseCliArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      json: { type: "boolean" },
      repo: { type: "string" },
      resolve: { type: "string" },
    },
  });

  return {
    help: values.help ?? false,
    json: values.json ?? false,
    repo: values.repo ?? null,
    resolveThreadId: values.resolve ?? null,
    prNumber: positionals[0] ? Number(positionals[0]) : null,
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }
  if (!Number.isInteger(args.prNumber) || args.prNumber <= 0) {
    printHelp();
    console.error("review_threads.mjs: pr_number must be a positive integer");
    return 2;
  }
  if (args.json && args.resolveThreadId) {
    console.error(
      "review_threads.mjs: --json cannot be combined with --resolve",
    );
    return 2;
  }

  try {
    const { host, owner, name, threads } = fetchReviewThreads(
      args.prNumber,
      args.repo,
    );
    if (args.resolveThreadId) {
      const thread = threads.find(
        (candidate) => candidate.id === args.resolveThreadId,
      );
      if (!thread) {
        throw new Error(
          `review thread not found on PR #${args.prNumber}: ${args.resolveThreadId}`,
        );
      }
      if (thread.isResolved) {
        console.log(`Review thread already resolved: ${args.resolveThreadId}`);
        return 0;
      }
      if (!isUnresolvedCodexThread(thread)) {
        throw new Error(
          `refusing to resolve non-Codex connector review thread: ${args.resolveThreadId}`,
        );
      }

      const resolved = resolveReviewThread(host, args.resolveThreadId);
      console.log(
        `Resolved review thread: ${resolved.id} isResolved=${resolved.isResolved}`,
      );
      return 0;
    }

    const matches = unresolvedCodexThreads(threads).map(serializeThread);
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            pull_request: {
              repository: `${owner}/${name}`,
              number: args.prNumber,
            },
            threads: matches,
          },
          null,
          2,
        ),
      );
      return 0;
    }

    printThreads(threads);
    return 0;
  } catch (error) {
    console.error(`review_threads.mjs: ${error.message}`);
    return 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main();
}
