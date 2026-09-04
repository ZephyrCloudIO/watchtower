import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isScalar, LineCounter, parseDocument, visit } from "yaml";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const DEFAULT_GITHUB_DIRECTORY = path.join(repoRoot, ".github");

const EXTERNAL_ACTION =
  /^(?<owner>[A-Za-z0-9_.-]+)\/(?<repository>[A-Za-z0-9_.-]+)(?:\/[A-Za-z0-9_.-]+)*@(?<ref>[^\s@]+)$/;
const FULL_COMMIT_SHA = /^[0-9a-fA-F]{40}$/;

async function collectYamlFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectYamlFiles(entryPath)));
    } else if (
      entry.isFile() &&
      [".yml", ".yaml"].includes(path.extname(entry.name).toLowerCase())
    ) {
      files.push(entryPath);
    }
  }
  return files;
}

export async function yamlFiles(githubDirectory) {
  return (await collectYamlFiles(githubDirectory)).sort();
}

export async function validateFile(filePath) {
  const findings = [];
  const contents = await readFile(filePath, "utf8");
  const lineCounter = new LineCounter();
  const document = parseDocument(contents, { lineCounter });

  for (const error of document.errors) {
    findings.push({
      path: filePath,
      lineNumber:
        error.linePos?.[0].line ?? lineCounter.linePos(error.pos[0]).line,
      reference: "<invalid YAML>",
      reason: `invalid YAML (${error.code}): ${error.message.split("\n", 1)[0]}`,
    });
  }
  if (document.errors.length > 0) {
    return findings;
  }

  visit(document, {
    Pair(_key, pair) {
      if (!isScalar(pair.key) || pair.key.value !== "uses") {
        return;
      }

      const lineNumber = lineCounter.linePos(pair.key.range[0]).line;
      const reference =
        isScalar(pair.value) && typeof pair.value.value === "string"
          ? pair.value.value
          : "<non-string>";
      if (reference.startsWith("./")) {
        return;
      }

      const external = reference.match(EXTERNAL_ACTION);
      if (!external) {
        findings.push({
          path: filePath,
          lineNumber,
          reference: reference || "<empty>",
          reason: "unsupported or malformed action reference",
        });
        return;
      }

      if (!FULL_COMMIT_SHA.test(external.groups.ref)) {
        findings.push({
          path: filePath,
          lineNumber,
          reference,
          reason: "external action ref must be a full 40-character commit SHA",
        });
      }
    },
  });
  return findings;
}

export async function validateGitHubDirectory(githubDirectory) {
  const findings = [];
  for (const filePath of await yamlFiles(githubDirectory)) {
    findings.push(...(await validateFile(filePath)));
  }
  return findings;
}

export function renderFinding(finding, root) {
  const displayPath = path.relative(root, finding.path) || finding.path;
  return `${displayPath}:${finding.lineNumber}: ${finding.reason}: uses: ${finding.reference}`;
}

export function parseArgs(argv) {
  const options = { githubDirectory: DEFAULT_GITHUB_DIRECTORY };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== "--github-dir") {
      throw new Error(`Unsupported argument: ${argument}`);
    }
    index += 1;
    if (!argv[index]) {
      throw new Error("--github-dir requires a path");
    }
    options.githubDirectory = path.resolve(argv[index]);
  }
  return options;
}

async function main() {
  try {
    const { githubDirectory } = parseArgs(process.argv.slice(2));
    const findings = await validateGitHubDirectory(githubDirectory);
    if (findings.length > 0) {
      process.stderr.write(
        "Mutable or invalid GitHub Action references found:\n",
      );
      for (const finding of findings) {
        process.stderr.write(
          `  ${renderFinding(finding, path.dirname(githubDirectory))}\n`,
        );
      }
      process.exitCode = 1;
      return;
    }

    const checkedFiles = (await yamlFiles(githubDirectory)).length;
    process.stdout.write(
      `Validated ${checkedFiles} GitHub YAML files: all action references are immutable.\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await main();
}
