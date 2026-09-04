---
name: repair-pr
description: Repair a GitHub pull request in one non-looping pass. Use only when a human explicitly invokes `$repair-pr`; never select this skill automatically from PR references or task similarity. When explicitly invoked, repair or unblock a PR by resolving merge conflicts, applying actionable review feedback from chatgpt-codex-connector[bot], fixing CI failures, pushing updates, resolving addressed inline review threads with thread-aware GitHub GraphQL, or adding or updating a PR Manual Testing section for human verification.
---

# Repair PR

## Overview

Use this skill to make one focused repair pass on a GitHub PR. Handle the current blockers, push the resulting update when changes are needed, refresh status once, and stop.

## Operating Rules

- Require a PR number or an unambiguous current PR branch. If neither is available, ask for the PR number.
- Use `gh` for GitHub operations when possible.
- Follow repository instructions before editing; in this repository, list `docs/` first and treat `docs/` as the source of truth.
- Work on the PR branch, not the base branch. Use `gh pr checkout <pr-number>` unless repository instructions define another workflow.
- Preserve unrelated local changes. Stage and commit only files needed for the repair.
- Do not merge, close, approve, or request review on the PR unless the user explicitly asks.
- Do not use `--no-verify`.
- Do not loop: do not watch, poll repeatedly, or keep retrying checks. After pushing, refresh PR status once and report any pending or remaining blockers.
- Use thread-aware review data for inline review threads. Do not treat flat PR comments as the source of truth for thread resolution state.

## One-Pass Workflow

1. Capture the PR state once:
   - PR branch, base branch, draft/open state, mergeability, and branch-behind status.
   - Failed, pending, cancelled, or missing checks.
   - Unresolved review threads authored by `chatgpt-codex-connector[bot]`, including each thread id, URL, file/line, and short summary.
   - Current PR body and whether it already has `## Manual Testing`.
2. Checkout the PR branch and inspect repository instructions and relevant docs before changing files.
3. Resolve merge conflicts or branch-behind state if present:
   - Fetch the base branch and PR branch.
   - Prefer merging the base branch into the PR branch unless the repository explicitly requires rebasing.
   - Resolve conflicts from source context and docs, not by blindly choosing one side.
4. Apply actionable `chatgpt-codex-connector[bot]` review feedback:
   - Treat actionable bot comments as required work.
   - Ignore only comments proven stale, duplicate, or inconsistent with repository contracts.
   - Track only the thread ids that this repair pass actually addresses.
5. Fix CI failures:
   - Inspect failed check logs and annotations with `gh`.
   - Fix the first root cause, including tests, docs, generated files, or implementation as needed.
   - If the failure is clearly external or flaky, document that evidence instead of inventing a code change.
6. Upsert `## Manual Testing` in the PR body when required:
   - Add or update it when the PR template asks for it, a review requests it, automated tests do not cover user-visible behavior, manual verification is needed for confidence, or the repair changes behavior humans should verify.
   - Write concrete human instructions, not a summary of what Codex did.
   - Keep existing useful body content intact.
7. Run the smallest reliable local validation that covers the repair, plus any repository-mandated tests for touched languages or areas.
8. Commit and push if files changed. Use a Conventional Commits message.
9. Refresh PR status once:
   - Confirm mergeability, current checks, and remaining `chatgpt-codex-connector[bot]` threads.
   - Resolve only bot threads addressed by the pushed changes.
   - Do not wait for newly pending checks to finish.

## Review Thread Resolution

Use `.agents/skills/repair-pr/scripts/review_threads.mjs` for inline review threads when available:

```bash
node .agents/skills/repair-pr/scripts/review_threads.mjs <pr-number>
node .agents/skills/repair-pr/scripts/review_threads.mjs <pr-number> --json
node .agents/skills/repair-pr/scripts/review_threads.mjs <pr-number> --resolve <thread-id>
```

Add `--repo OWNER/REPO` when the current checkout does not resolve to the target repository.

Follow this sequence:

1. Before editing, list unresolved `chatgpt-codex-connector` threads and record the thread id, URL, file/line, and short summary for each actionable thread.
2. Keep an addressed-thread list during the repair. Include only threads fixed by committed changes or proven stale/non-actionable from current source and diff evidence.
3. Commit and push the repair before resolving any thread.
4. Re-read the thread list after pushing. Resolve only addressed, still-unresolved `chatgpt-codex-connector` thread ids with `--resolve <thread-id>`.
5. Do not resolve human reviewer threads, unverified thread ids, ambiguous feedback, or threads that were only inspected.

If a thread is stale, duplicate, or incorrect, collect the evidence before resolving it and mention that evidence in the finish report. If GraphQL resolution fails, leave the thread open and report the exact blocker.

## Manual Testing Section

Use this shape when adding or replacing the section:

```markdown
## Manual Testing

1. Open ...
2. Verify ...
3. Confirm ...
```

Make the steps executable by a human reviewer. Include commands only when the expected human verification is command-line based.

## Finish Report

Finish with:

- PR URL and branch.
- Merge conflict or branch update result.
- Bot review feedback applied or left unresolved, with reasons.
- CI failures fixed, pending, or blocked.
- Local validation run.
- Whether `Manual Testing` was added or updated.
- Any remaining blocker.
