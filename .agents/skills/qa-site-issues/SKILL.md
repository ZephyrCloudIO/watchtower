---
name: qa-site-issues
description: Browser-driven QA issue filing for websites and local web apps. Use only when a human explicitly invokes `$qa-site-issues`; never select this skill automatically from a URL, QA request, or task similarity. When explicitly invoked, roam the provided URL, find reachable bugs and UX, UI, accessibility, navigation, console, runtime, or flow problems, capture screenshots, and create GitHub issues as each finding is confirmed.
---

# QA Site Issues

## Overview

Use this skill to continuously test a website with the Browser skill and turn each confirmed bug, inconvenient UX problem, visual/accessibility issue, or unattractive UI polish problem into a GitHub issue immediately.

Default to the current repository's GitHub issues. Ask only when the target issue repository is ambiguous or when the site under test clearly belongs to a different repository and the user did not specify one.

## Required Setup

- Load and follow the Browser skill before opening or interacting with the target URL.
- Use `gh` for GitHub issue operations when possible.
- Resolve the default issue repository from the current git remote unless the user specifies another issue target.
- Do not start development servers. If a local URL is unreachable, the connection is refused, or no app appears to be running, tell the user and ask them to start the server or provide a reachable URL.
- If authentication blocks coverage, tell the user what page or flow is blocked and ask them to log in through the browser, provide test credentials, or provide another authorized session path before continuing protected areas.
- For local development URLs such as `localhost`, `127.0.0.1`, `::1`, `file://`, or user-provided local origins, treat the QA request as authorization to exercise every reachable app feature, including external integrations, sends, saves, and other state-changing flows needed to verify behavior. Pause only if an action would affect production billing, secrets, or irreversible third-party resources outside the QA target.
- For non-local targets, keep browser work non-destructive. Do not submit purchases, send real messages, delete data, invite users, change billing, rotate secrets, or run irreversible workflows unless the user explicitly authorizes that action.

## QA Loop

Repeat until the user stops the run, the user-provided limit is reached, or a real blocker prevents progress:

1. Open the target URL and identify the current product surface, route, auth state, viewport, and visible navigation options.
2. Move through every reachable visible link, button, form, menu, dialog, setting, empty state, loading state, error state, and responsive layout. Prefer realistic user flows over synthetic URL guessing.
3. When something looks broken or unintuitive, reproduce it once before filing.
4. Capture durable evidence: exact URL, viewport, screenshot, steps, visible text, expected behavior, actual behavior, console errors or failed network requests when relevant, and why the issue affects a user.
5. Check only for an existing open duplicate issue with a targeted `gh issue list` search using the product surface and symptom.
6. If there is no open duplicate, create the GitHub issue immediately, even when a similar closed or resolved issue exists. Do not wait to collect more findings.
7. Return to the browser and continue exploring from the last useful state or the nearest navigation surface.

## What To File

File issues for confirmed, user-relevant problems:

- Broken navigation, dead links, incorrect redirects, missing route guards, or impossible flows.
- Runtime errors, failed required requests, loading states that never resolve, or stale data that blocks use.
- Form validation, save, authentication, authorization, or permission behavior that contradicts visible UI expectations.
- Visual problems that materially harm use, such as overlap, clipped text, inaccessible contrast, unusable mobile layout, or controls hidden behind other UI.
- Concrete unattractive or unfinished UI polish issues, such as poor spacing, weak alignment, confusing hierarchy, inconsistent styling, cramped layouts, awkward empty states, or surfaces that look visibly incomplete.
- Unintuitive UX where a reasonable user cannot tell what happened, what to do next, or how to recover.

Do not file issues for mere preference, speculative implementation ideas, transient network failures without product impact, or findings that cannot be reproduced once. For UI polish findings, file only when the issue is concrete enough to describe with a screenshot, affected surface, and user impact.

## Issue Contract

Follow the repository issue style contract:

- Title format: `<domain>: <description>`
- Use a stable lowercase project or component identifier from the repository contracts when possible.
- Make the description concise, specific, and start with a lowercase verb phrase when natural.
- Create one issue per distinct problem.
- Never reopen an existing issue or ask for an existing issue to be reopened. Use `gh issue create` for each confirmed finding that has no open duplicate; do not use `gh issue reopen`.

Use this body shape:

```markdown
## Summary
Describe the user-facing problem in one short paragraph.

## Evidence
- URL:
- Browser/viewport:
- Screenshot:
- Steps to reproduce:
- Observed:
- Expected:
- Supporting evidence:

## Current Gap
Explain why the current behavior is broken or unintuitive.

## Proposed Scope
Describe the smallest product or implementation change that would address the problem.

## Acceptance Criteria
- A user can ...
- The page ...
- Regression coverage or manual verification covers ...

## Test Scenarios
- Reproduce the original path and confirm the issue is fixed.
- Check the nearest adjacent route or state for regression.

## Out of Scope
- Unrelated redesigns, copy rewrites, or backend changes not required for this issue.
```

Add `## Additional Notes` only when it contains useful context that does not fit the required sections.

## Operating Notes

- Be direct about uncertainty. If evidence is partial, keep exploring before filing.
- Screenshots are required for confirmed issues and blockers. Include screenshot evidence in the GitHub issue body when it can be attached or linked durably; otherwise include it in the running status and keep text evidence complete in the issue.
- Prefer text evidence and URLs in issue bodies. Do not rely on local-only screenshot paths as the only durable GitHub evidence unless the user asked for local artifacts too.
- If authentication blocks coverage, report the blocker and continue with accessible areas unless the user logs in, provides credentials or an authorized session path, or asks to stop.
- For non-local targets, if a destructive action is the only way to confirm a finding, file only when the non-destructive evidence is already sufficient; otherwise ask for authorization.
- Treat closed or resolved issues as historical references only. If useful, mention the old issue in `## Additional Notes`, but still file a new issue for the current confirmed finding.
- After each issue is created, keep the issue URL in the running status and continue QA rather than summarizing a batch.
