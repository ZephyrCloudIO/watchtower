---
name: manage-pr
description: Monitor and repair a specified GitHub pull request by PR number. Use only when a human explicitly invokes `$manage-pr`; never select this skill automatically from PR references or task similarity. When explicitly invoked, manage, watch, keep green, update, or repair a PR; fix failing CI; apply review comments from chatgpt-codex-connector; resolve merge conflicts; push PR updates; or repeat PR status checks until the PR is ready or blocked.
---

# Manage PR

## Overview

Use this skill when the user gives a GitHub PR number and wants Codex to own the PR maintenance loop: inspect the PR, fix blockers, update the branch, and keep checking until the PR is ready or truly blocked.

## Operating Rules

- Require a PR number. If the user did not provide one, ask for it before doing GitHub work.
- Use `gh` for GitHub operations. Prefer the GitHub plugin skills `github:gh-fix-ci` and `github:gh-address-comments` when they are available and match the current blocker.
- Work on the PR branch, not the base branch. Use `gh pr checkout <number>` unless the repository has a documented alternative workflow.
- Do not merge, close, approve, or request review on the PR unless the user explicitly asks.
- Automatically apply actionable review comments from `chatgpt-codex-connector`. Do not automatically apply or resolve human reviewer comments unless the user asks.
- Resolve `chatgpt-codex-connector` review threads only after the corresponding fix is committed and pushed, or after confirming the thread is stale/non-actionable with clear evidence.
- Preserve unrelated local changes. Stage and commit only the files needed for the PR maintenance work.
- Follow all repository instructions, including docs-as-source-of-truth, test requirements, commit conventions, and no `--no-verify`.

## Snapshot First

From the repository root, collect a fresh PR snapshot before changing files:

```bash
node .agents/skills/manage-pr/scripts/pr_snapshot.mjs <pr-number>
```

Use the script output to identify:

- PR branch, base branch, draft/open/closed state, and merge state.
- Failing, pending, or missing checks.
- Unresolved `chatgpt-codex-connector` review threads.

If the script cannot run because `gh` is unavailable, unauthenticated, or outside a repository, report that blocker and use direct `gh` commands only after fixing the environment.

## Maintenance Loop

Repeat this loop until the PR has no merge conflict, no failing required checks, and no unresolved `chatgpt-codex-connector` threads, or until a real blocker remains:

1. Refresh the PR snapshot.
2. Handle merge conflicts or branch-behind status.
3. Handle failing CI.
4. Handle `chatgpt-codex-connector` review threads.
5. Run the relevant local validation.
6. Commit, push, and resolve addressed Codex connector threads.
7. Wait for new checks or reviews, then refresh.

Use short user updates while waiting or when switching blocker categories. If checks are still pending after a long wait, keep polling only when the user clearly asked for ongoing monitoring; otherwise summarize the current state and next expected event.

## Merge Conflicts

When GitHub reports a merge conflict or the branch must be updated before checks can pass:

- Fetch the base branch and PR branch.
- Prefer merging the base branch into the PR branch unless repository instructions require rebasing.
- Resolve conflicts by reading the surrounding code and repository docs, not by choosing one side blindly.
- Run the tests that cover the conflict area.
- Commit and push the conflict-resolution update.

Do not rewrite the PR branch history unless the user or repository contract explicitly requires it.

## Failing CI

When checks fail:

- Use `github:gh-fix-ci` if available. Otherwise inspect failed checks with `gh pr checks`, `gh run view --log-failed`, and job annotations.
- Find the first root-cause failure, not only the last visible error line.
- Add enough local logging or structured logs when the failure needs better troubleshooting evidence, following the repository logging rules.
- Fix code, docs, generated artifacts, or tests as appropriate.
- Run the smallest reliable local validation first, then broader required tests when the change touches shared behavior.
- Commit and push. If evidence points to a transient external failure, rerun the failed workflow once and say why.

Never mark CI as fixed until the relevant GitHub check passes or the remaining failure is clearly external and documented.

## Codex Connector Reviews

For review comments authored by `chatgpt-codex-connector`:

- Use `github:gh-address-comments` if available and thread-level state matters. Otherwise inspect unresolved review threads from the snapshot and, if needed, use GraphQL through `gh api graphql`.
- Treat each actionable comment as required work. Patch the code, update tests/docs, and run validation.
- If a comment is stale, duplicate, or incorrect, verify that from the current diff before resolving it.
- After pushing the fix, resolve only the addressed `chatgpt-codex-connector` threads.
- If a Codex connector comment conflicts with repository docs, follow the docs and leave a short explanation in the final status.

## Finishing Criteria

Finish with a concise status that includes:

- PR URL and branch.
- What was fixed and pushed.
- Current CI state.
- Codex connector thread state.
- Any remaining blocker, including exact check names or thread URLs.

If all checks are green, merge state is clean, and Codex connector threads are resolved, say the PR is ready for human review or merge. Do not merge it unless the user requested that action.
