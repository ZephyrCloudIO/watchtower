---
name: handle-qa-issue
description: QA existing GitHub issues and report the result back to the issue. Use only when a human explicitly invokes `$handle-qa-issue`; never select this skill automatically from QA requests, issue references, or task similarity. When explicitly invoked, inspect the issue, run targeted site QA through qa-site-issues, post a QA result comment, and close the issue only when QA passes.
---

# Handle QA Issue

## Overview

Use this skill to verify an existing GitHub QA issue against the product surface it describes, leave a durable QA result comment, and close the issue only when the original report is proven fixed or no longer reproducible.

This skill is for validation and reporting. Do not implement fixes, merge PRs, or reopen closed issues unless the user explicitly asks for that separate action.

## Required Setup

- Require a GitHub issue number or issue URL before doing GitHub work. If only a number is provided, resolve it against the current repository.
- Use `gh` for issue view, comment, and close operations whenever possible.
- List `docs/` before doing work in this repository, then follow all applicable root and scoped `AGENTS.md` instructions.
- Read the target issue title, body, comments, labels, linked PRs, screenshots, and acceptance criteria before starting QA.
- Read and follow `.agents/skills/qa-site-issues/SKILL.md` for browser-driven site QA. That skill owns the browser QA rules, evidence expectations, destructive-action limits, and duplicate issue filing behavior.
- Default GitHub operations to the current repository. If the issue URL names another repository, target that repository explicitly with `gh --repo`.
- If the target issue is already closed, still post the QA result comment when useful, but do not reopen it unless the user explicitly asks.

Useful commands:

```bash
gh issue view "$ISSUE" --comments
gh issue view "$ISSUE" --json number,title,body,state,labels,comments,url
gh issue comment "$ISSUE" --body-file "$COMMENT_FILE"
gh issue close "$ISSUE" --comment "$PASS_SUMMARY"
```

## Workflow

1. Resolve and inspect the issue.
   - Capture the issue repository, number, URL, state, reported product surface, expected behavior, observed behavior, reproduction steps, and any test environment hints.
   - If the issue lacks a testable URL or route, infer it from repository docs or the app contract. Ask only when no reasonable target can be derived.

2. Define the QA target.
   - Scope QA to the original issue plus the nearest adjacent route, state, or responsive layout needed to prove the fix did not break the same flow.
   - Treat QA success as: the original behavior is fixed or not reproducible, and no directly blocking related defect remains in the tested scope.

3. Run targeted QA with `qa-site-issues`.
   - Load the QA Site Issues skill before using a browser.
   - Capture durable evidence: URL, browser and viewport, steps, observed result, expected result, screenshots or artifact links when available, console/runtime errors, and failed network requests when relevant.
   - Do not duplicate the target issue. If the QA scope reveals a distinct confirmed problem that is not the target issue, file a separate issue according to `qa-site-issues` and include its URL in the QA result comment.

4. Decide the result.
   - Use `pass` only when the original issue is fixed or not reproducible under the tested scope.
   - Use `fail` when the original issue still reproduces or a directly blocking related defect prevents the original flow from working.
   - Use `blocked` when authentication, missing environment, unavailable local server, missing test data, or unsafe/destructive action limits prevent reliable verification.
   - Treat partial or ambiguous evidence as `blocked` or `fail`; do not close the issue.

5. Comment on the issue.
   - Always post a Markdown QA result comment before closing or finishing.
   - Include enough evidence that another maintainer can understand what was tested without reading local-only artifacts.
   - Do not rely on local screenshot paths as the only evidence; attach or link durable artifacts when possible, or describe the screenshot evidence in text.

6. Close only on pass.
   - If the result is `pass` and the issue is open, close it after posting the QA result comment, or close it with the same concise pass summary.
   - If the result is `fail`, `blocked`, partial, or ambiguous, leave the issue open and state exactly what remains.
   - If the issue is already closed, do not change state unless explicitly instructed.

## QA Result Comment

Use this shape:

```markdown
## QA Result

Status: pass|fail|blocked

### Tested Scope
- Issue:
- Target:
- Environment:
- Browser/viewport:

### Evidence
- Steps:
- Observed:
- Expected:
- Screenshots/artifacts:
- Console/network notes:

### Outcome
- Closure decision:
- Remaining findings or blocker:
```

Keep the comment factual. If separate issues were created during QA, list their URLs under `Remaining findings or blocker`.

## Finish Report

Finish with:

- Target issue URL and final state.
- QA status and the key evidence.
- Comment URL when available.
- Any newly filed related issue URLs.
- Any blocker or skipped verification.
