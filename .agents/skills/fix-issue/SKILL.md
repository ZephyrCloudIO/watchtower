---
name: fix-issue
description: Fix GitHub issues end-to-end and open ready, non-draft pull requests. Use only when a human explicitly invokes `$fix-issue`; never select this skill automatically from issue references or task similarity. When explicitly invoked, use it to fix, implement, resolve, close, or address one or more GitHub issues when the expected result is working branch(es) plus non-draft PR(s) rather than only analysis or patches.
---

# Fix Issue

## Goal

Resolve one or more GitHub issues completely enough to open ready PRs. Own the whole loop: understand the requested issue set, inspect repository contracts, implement focused fixes, verify them, commit them, push them, and create non-draft pull requests.

## Operating Rules

- Require at least one target issue. If the user did not provide issue numbers, URLs, or unambiguous repository issue references, ask for them before changing files.
- Use `gh` for GitHub operations when possible.
- Follow all repository instructions before editing, including root and scoped `AGENTS.md` files and authoritative docs.
- Preserve unrelated local changes. Stage and commit only files that belong to the requested issue set.
- Group multiple issues by repository, base branch, and coherent implementation scope before editing. Use one PR for a coherent issue group; use separate branches and PRs for unrelated issue groups or different repositories.
- Work on issue branches unless the user explicitly asks to use the current branch. Follow repository branch naming rules; otherwise use `fix/issues-<numbers>-<short-slug>` for a group or `fix/issue-<number>-<short-slug>` for one issue.
- Create ready PRs. Do not create draft PRs, and do not mark the task complete until every target issue is covered by a non-draft PR, proven already fixed/non-actionable, or blocked with evidence.
- Do not merge, close, approve, or request review unless the user explicitly asks.
- Do not use `--no-verify`.

## Workflow

1. Inspect the issue set.
   - Resolve each issue repository from the URL, issue reference, or current Git remote.
   - Read each issue title, body, labels, comments, linked PRs, referenced commits, logs, screenshots, and acceptance criteria before editing.
   - Identify whether the issues are one coherent fix, multiple independent fixes, or conflicting requests.
   - If an issue is closed, stale, duplicate, already fixed, or blocked by missing product decisions, verify that from source evidence and report how it affects the issue set before creating new work.

2. Prepare the workspace.
   - Check the working tree and identify unrelated user changes.
   - Create or switch to the branch for the current issue group.
   - Read the docs and contracts for every touched area, using repository docs as source of truth when the repository says to do so.
   - If issues span multiple repositories, process each repository's coherent issue groups separately unless the user requested a coordinated cross-repository change.

3. Implement the fix.
   - Search the current code before assuming issue descriptions are still accurate.
   - Keep changes scoped to the issue group and its direct dependencies.
   - Update tests, docs, generated artifacts, contracts, and fixtures when the behavior or repository rules require it.
   - Add or improve diagnostic logging when it materially helps debug the changed behavior, following the repository's logging conventions.

4. Verify the work.
   - Run the smallest reliable checks that cover the change, plus any repository-mandated tests for touched languages or areas.
   - For UI changes, verify the relevant page or flow in a browser when a local target is available or required.
   - If a required check cannot run, record the exact blocker and run the closest useful alternative.

5. Commit promptly.
   - Review the diff and stage only files related to the current issue group.
   - Commit soon after staging so the work is preserved in history.
   - Use the repository's commit style. If none is specified, use a concise Conventional Commits title such as `fix(<domain>): <summary>`.

6. Push and open the PR.
   - Push the issue-group branch to the appropriate remote.
   - Open a non-draft PR against the correct base branch.
   - Use the repository's PR title and body conventions. When unspecified, use a Conventional Commits title and include `Closes #<number>` for every covered issue, a concise summary, tests run, and any real residual risk.
   - If any issue is in a different repository from the current checkout, confirm that the pushed branch and PR target that issue's repository.

7. Report the result.
   - Give every PR URL, branch name, commit hash, covered issue list, and checks run.
   - Mention only real residual risk or skipped verification. Do not present unfinished work as fixed.

## Useful Commands

```bash
gh issue view "$ISSUE" --comments
gh issue view "$ISSUE" --json number,title,body,state,labels,assignees,milestone,comments,url
gh pr create --fill
```

Ensure PR creation stays ready/non-draft: omit `--draft` and avoid any API field that marks the PR as draft.
