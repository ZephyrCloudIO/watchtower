import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateGitHubDirectory } from "./validate-github-action-pins.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const FULL_SHA = "0123456789abcdef0123456789abcdef01234567";

async function validateFixture(t, relativePath, usesLines) {
  const steps = usesLines.map((value) => `      - uses: ${value}`).join("\n");
  const contents = relativePath.startsWith("actions/")
    ? `name: fixture\ndescription: fixture\nruns:\n  using: composite\n  steps:\n${steps}\n`
    : `name: fixture\njobs:\n  test:\n    steps:\n${steps}\n`;
  return validateYamlFixture(t, relativePath, contents);
}

async function validateYamlFixture(t, relativePath, contents) {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "github-action-pins-"),
  );
  t.after(async () => {
    await rm(temporaryDirectory, { force: true, recursive: true });
  });

  const githubDirectory = path.join(temporaryDirectory, ".github");
  const fixture = path.join(githubDirectory, relativePath);
  await mkdir(path.dirname(fixture), { recursive: true });
  await writeFile(fixture, contents, "utf8");
  return validateGitHubDirectory(githubDirectory);
}

test("current repository action set passes", async () => {
  assert.deepEqual(
    await validateGitHubDirectory(path.join(repoRoot, ".github")),
    [],
  );
});

test("tag and branch references fail", async (t) => {
  for (const reference of ["owner/action@v3", "owner/action@main"]) {
    const findings = await validateFixture(t, "workflows/mutable.yml", [
      reference,
    ]);
    assert.equal(findings.length, 1);
    assert.match(findings[0].reason, /full 40-character commit SHA/);
  }
});

test("flow-style action references are validated", async (t) => {
  const findings = await validateYamlFixture(
    t,
    "workflows/flow-style.yml",
    "name: fixture\njobs:\n  test:\n    steps: [{ uses: owner/action@v4 }]\n",
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].reference, "owner/action@v4");
  assert.equal(findings[0].lineNumber, 4);
});

test("malformed and shortened SHAs fail", async (t) => {
  const references = [
    "owner/action@0123456789abcdef0123456789abcdef0123456",
    "owner/action@0123456789abcdef0123456789abcdef0123456g",
    "owner/action-without-ref",
  ];
  for (const reference of references) {
    const findings = await validateFixture(t, "actions/example/action.yml", [
      reference,
    ]);
    assert.equal(findings.length, 1);
  }
});

test("full SHAs with version comments pass", async (t) => {
  const findings = await validateFixture(t, "workflows/pinned.yaml", [
    `owner/action@${FULL_SHA} # v3.0.0`,
    `'owner/action/subdirectory@${FULL_SHA}' # v2`,
  ]);
  assert.deepEqual(findings, []);
});

test("repository-local actions remain allowed", async (t) => {
  const findings = await validateFixture(t, "workflows/local.yml", [
    "./.github/actions/setup-env",
    "'./nested/action'",
  ]);
  assert.deepEqual(findings, []);
});
