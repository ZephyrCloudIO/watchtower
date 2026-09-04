#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const CODEX_CONNECTOR_LOGINS = new Set([
  "chatgpt-codex-connector",
  "chatgpt-codex-connector[bot]",
]);
const GH_TIMEOUT_SECONDS = 60;

export function outputText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  return String(value);
}

export function commandDetail(stderr, stdout) {
  return outputText(stderr).trim() || outputText(stdout).trim();
}

function commandString(args) {
  return ["gh", ...args].join(" ");
}

export function runJson(args) {
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

export function ghArgs(repo) {
  return repo ? ["--repo", repo] : [];
}

export function parseRepoArg(repo) {
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

export function repoReference(repo) {
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

export function prView(prNumber, repo) {
  const fields = [
    "author",
    "baseRefName",
    "headRefName",
    "headRepository",
    "headRepositoryOwner",
    "isDraft",
    "mergeStateStatus",
    "number",
    "reviewDecision",
    "state",
    "statusCheckRollup",
    "title",
    "url",
  ].join(",");

  return runJson([
    "pr",
    "view",
    String(prNumber),
    ...ghArgs(repo),
    "--json",
    fields,
  ]);
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
          comments(first: 20) {
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
            }
          }
        }
      }
    }
  }
}
`;

export function reviewThreads(prNumber, repo) {
  const { host, owner, name } = repoReference(repo);
  const threads = [];
  let after = null;

  while (true) {
    const args = ["api", "graphql"];
    if (host) {
      args.push("--hostname", host);
    }
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
      return threads;
    }
    after = pageInfo.endCursor;
  }
}

export function reviewThreadsConnection(payload) {
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

export function authorLogin(comment) {
  return comment.author?.login ?? null;
}

export function isCodexConnectorComment(comment) {
  return CODEX_CONNECTOR_LOGINS.has(authorLogin(comment));
}

export function checkName(check) {
  return (
    check.name ??
    check.context ??
    check.workflowName ??
    check.__typename ??
    "unknown-check"
  );
}

export function checkState(check) {
  return check.conclusion || check.state || check.status || "UNKNOWN";
}

export function printChecks(checks) {
  if (!checks.length) {
    console.log("Checks: none reported");
    return;
  }

  const groups = new Map();
  for (const check of checks) {
    const state = checkState(check);
    const names = groups.get(state) ?? [];
    names.push(checkName(check));
    groups.set(state, names);
  }

  console.log("Checks:");
  for (const [state, names] of [...groups.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const sortedNames = names.sort((a, b) => a.localeCompare(b));
    console.log(`  ${state}: ${sortedNames.length}`);
    for (const name of sortedNames.slice(0, 20)) {
      console.log(`    - ${name}`);
    }
    if (sortedNames.length > 20) {
      console.log(`    - ... ${sortedNames.length - 20} more`);
    }
  }
}

export function unresolvedCodexThreads(threads) {
  return threads.filter((thread) => {
    if (thread.isResolved) {
      return false;
    }
    const comments = thread.comments?.nodes ?? [];
    return comments.some(isCodexConnectorComment);
  });
}

export function codexOrFirstComment(thread) {
  const comments = thread.comments?.nodes ?? [];
  return comments.find(isCodexConnectorComment) ?? comments[0] ?? {};
}

export function printCodexThreads(threads) {
  const matches = unresolvedCodexThreads(threads);
  console.log(`Unresolved chatgpt-codex-connector threads: ${matches.length}`);
  for (const thread of matches.slice(0, 30)) {
    const comment = codexOrFirstComment(thread);
    const location = comment.path || thread.path || "unknown path";
    const line = comment.line || comment.originalLine || thread.line;
    const suffix = line ? `:${line}` : "";
    const url = comment.url || thread.id;
    let body = (comment.body || "").split(/\s+/).filter(Boolean).join(" ");
    if (body.length > 180) {
      body = `${body.slice(0, 177)}...`;
    }

    console.log(`  - ${thread.id} ${location}${suffix}`);
    console.log(`    ${url}`);
    if (body) {
      console.log(`    ${body}`);
    }
  }
  if (matches.length > 30) {
    console.log(`  - ... ${matches.length - 30} more`);
  }
}

function printHelp() {
  console.log(`usage: pr_snapshot.mjs [-h] [--repo REPO] pr_number

Print a GitHub PR maintenance snapshot.

positional arguments:
  pr_number    Pull request number

optional arguments:
  -h, --help   show this help message and exit
  --repo REPO  GitHub repository in [HOST/]OWNER/REPO form`);
}

export function parseCliArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      repo: { type: "string" },
    },
  });

  return {
    help: values.help ?? false,
    repo: values.repo ?? null,
    prNumber: positionals[0] ? Number(positionals[0]) : null,
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }
  if (!Number.isInteger(args.prNumber) || args.prNumber <= 0) {
    printHelp();
    console.error("pr_snapshot.mjs: pr_number must be a positive integer");
    return 2;
  }

  try {
    const pr = prView(args.prNumber, args.repo);
    const threads = reviewThreads(args.prNumber, args.repo);

    const headOwner = pr.headRepositoryOwner?.login ?? "unknown-owner";
    const headRepo = pr.headRepository?.name ?? "unknown-repo";
    const author = pr.author?.login ?? "unknown-author";

    console.log(`PR: #${pr.number} ${pr.title}`);
    console.log(`URL: ${pr.url}`);
    console.log(
      `State: ${pr.state} draft=${pr.isDraft} merge=${pr.mergeStateStatus}`,
    );
    console.log(`Review decision: ${pr.reviewDecision}`);
    console.log(`Author: ${author}`);
    console.log(
      `Branch: ${headOwner}/${headRepo}:${pr.headRefName} -> ${pr.baseRefName}`,
    );
    console.log();
    printChecks(pr.statusCheckRollup ?? []);
    console.log();
    printCodexThreads(threads);
    return 0;
  } catch (error) {
    console.error(`pr_snapshot.mjs: ${error.message}`);
    return 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main();
}
