---
name: add-issue
description: Evidence-driven GitHub issue creation for confirmed bugs and decision-complete future work. Use only when a human explicitly invokes `$add-issue`; never select this skill automatically from bug reports, feature ideas, TODOs, URLs, issue references, or task similarity. When explicitly invoked, classify each independently implementable candidate as Bug, Feature, or Task; prove root causes for defects; compare deployed revisions with freshly fetched latest main and skip defects already fixed there; resolve research and design decisions for planned work; restore temporary instrumentation; and create or update a self-contained GitHub record without implementing the work.
---

# Add Issue

## Goal

Create one durable, implementation-ready GitHub record per independently implementable item. Classify each item as `Bug`, `Feature`, or `Task`, establish all facts and decisions the implementer needs, and never implement the recorded work in the same invocation.

## Non-Negotiable Boundaries

- Follow all active system, developer, repository, and scoped `AGENTS.md` instructions. List `docs/` before investigating in this repository and treat applicable contracts as authoritative.
- Use `gh` for the bounded GitHub writes defined by this skill when possible. Resolve the target from an explicit repository or issue URL, otherwise use the current Git remote.
- Do not implement the recorded work, leave permanent source or documentation changes, update dependencies, generate committed artifacts, commit, push, create a pull request, deploy, or mutate production.
- Do not transition into implementation later in the same invocation. Finish the issue record and require a separate explicit implementation task such as `$fix-issue`.
- Treat creating an issue, correcting an open duplicate to the selected issue type, or adding one implementation-handoff comment to that duplicate as the only intended persistent mutations.
- Prefer read-only investigation. Obtain separate authorization before any state-changing reproduction outside a local or isolated test environment.
- Preserve secrets, credentials, personal data, customer data, and sensitive request values. Redact them from commands, logs, screenshots, artifacts, comments, and issue bodies.
- Treat provider-console links, log queries, database rows, customer environments, reporter sessions, and local artifacts as supplementary evidence. Make the GitHub record actionable after those sources become inaccessible.
- Do not invoke `$write-prd`, apply its `PRD` label, or set labels, assignees, milestones, projects, or other metadata unless the human explicitly invokes that skill or an applicable repository contract requires the metadata.

## Investigation Tool Selection

- Use non-browser investigation paths in this order: a purpose-built connector or MCP tool, the provider's or project's official CLI, an authenticated direct API, then a browser.
- Prefer a purpose-built connector or MCP tool when it supports the required evidence and scope. Otherwise use the official CLI, including `gh`, `aws`, `pscale`, `wrangler`, or another CLI identified from the target system; load and follow any applicable CLI skill first.
- Before invoking a CLI, confirm that it is installed, inspect its current help or version when command support is uncertain, and verify the authenticated identity, account, repository, region, branch, or other target with the narrowest safe read-only command. Do not assume a configured default identifies the intended target.
- Use an authenticated direct API only when the higher-priority tools are unavailable or cannot obtain the required evidence safely.
- Use a browser only when the preceding paths are unavailable or insufficient, or when browser-only session state or visual evidence is itself necessary. Record why the non-browser paths were insufficient and what evidence the browser supplied, and obey any active instruction that prohibits browser workflows.
- Keep every investigation read-only unless the user separately authorizes a state-changing reproduction. A missing CLI, expired login, or unsupported command does not justify skipping another available non-browser path.
- Preserve the same secret, credential, personal-data, customer-data, and restricted-log protections across every tool and fallback.

## Classification and Partitioning

Classify by the requested behavior, not by the user's preferred type name:

- Select `Bug` for unexpected current behavior, a regression, a failure, or a violated existing invariant. Always investigate and confirm the root cause, identify the affected deployed or reported revision, and compare it with freshly fetched latest main before recording it, even when the user says to leave the problem for later. If the cause remains unconfirmed or latest main already fixes it, do not create or comment on an issue for that candidate.
- Select `Feature` for new user-visible functionality or a material expansion of existing product behavior.
- Select `Task` for maintenance, refactoring, documentation, testing, security hardening, operations, cleanup, migrations, or other work that adds no new product behavior and does not correct a confirmed defect.
- Ask the user before any GitHub write when the classification or intended behavior remains ambiguous after repository investigation.

Maintain one candidate ledger across all three types. Split candidates when they can be implemented and verified independently. Keep them together only when the same intended outcome, change boundary, and verification require one implementation. Apply readiness, duplicate, type, and write checks independently so one blocked candidate does not prevent other ready candidates from being recorded.

## Decision-Complete Handoff Standard

- Assume the implementer can read the complete issue thread and check out the identified repository revision but cannot access the original database, cloud logs, provider console, external account, customer environment, reporter session, or temporary investigation files.
- Pin facts to repository and environment evidence. Convert inaccessible source-dependent facts into a minimal sanitized fixture, test vector, generator, excerpt, or exact local setup whose causal or behavioral equivalence is explained.
- Identify the responsible code, contracts, configuration, data, or operational boundaries and cite authoritative evidence for every material behavioral decision.
- Resolve the selected smallest change, affected and deliberately unaffected behavior, compatibility and migration consequences, failure behavior, rollout needs, and exact regression coverage before writing.
- Define each test with concrete setup, input or fixture, action, and assertion.
- Do not leave the implementer to recover inaccessible evidence, investigate the cause, choose between material alternatives, or obtain product, architecture, scope, rollout, or verification decisions.
- Ask the user only for decisions that repository, runtime, issue history, or supplied evidence cannot determine. If a required fact or decision remains unresolved, mark that candidate `failed` and perform no GitHub write for it.

For `Feature` candidates, resolve the relevant product outcome, actors, UX and errors, interfaces, data and ownership, authorization and privacy, integrations, compatibility, operations, observability, documentation, and rollout decisions. Resolve a feature-flag contract whenever an applicable repository contract requires one; do not invent flag names, targeting, timing, or removal criteria.

For `Task` candidates, resolve the current state, intended maintenance outcome, exact implementation boundary, preserved behavior, dependencies, compatibility or migration handling, operational impact, and verification. Do not turn an unresolved bug hypothesis into a `Task` merely to bypass the root-cause standard.

## Bug Root-Cause Standard

- Distinguish the user-visible symptom, trigger, propagation path, and underlying root cause.
- Require causal evidence, not a plausible hypothesis or timing correlation. Confirm the cause through a minimal reproduction, controlled counterfactual, or deterministic code, configuration, or runtime trace corroborated by logs or tests.
- Test material competing explanations and record why they were excluded.
- Classify a cause as `confirmed` only when the evidence explains why the failure occurs and why the observed trigger produces the symptom.
- Maintain a separate evidence-ledger entry for every candidate defect, including its causal chain, selected correction, supporting and contradicting evidence, and outcome.
- Create one record per confirmed, independently fixable root cause. Multiple symptoms may share one issue only when the same cause and correction explain them.

## Deployment and Latest-Main Gate for Bugs

- For every `Bug`, distinguish the revision where the failure was observed from the revision being inspected locally. For deployed behavior, identify the exact environment and deployed version, release tag, image digest, task definition, build identifier, or equivalent artifact, and trace it to the exact repository commit through deployment or build provenance. Never assume the current checkout is deployed.
- Freshly fetch the target repository's `main` branch before the final classification. Record the fetched `origin/main` commit and fetch time; do not rely on a stale local branch or remote-tracking ref. If the repository genuinely has no `main` branch, resolve its authoritative default branch and record the exception.
- Establish the root cause against the deployed or reported commit, then evaluate the same trigger and causal boundary on fetched latest main in an isolated worktree or other workspace-safe checkout. Use the smallest equivalent reproduction, counterfactual, deterministic trace, or regression test.
- Treat a defect as fixed on latest main only when causal evidence shows that the confirmed root-cause condition is absent and the expected behavior holds. A changed file, merged pull request, closed issue, or plausible patch without verification is insufficient.
- When latest main already fixes the defect, classify the outcome as `already fixed` and skip it before duplicate search or handoff drafting. Do not create an issue, change an issue type, or comment on an existing issue, even when the fix is not deployed yet.
- Report the affected deployment and commit, fetched main commit, fixing commit or pull request when traceable, verification performed on both revisions, and any remaining deployment lag. Report the lag only; do not turn it into another issue in the same invocation.
- If the affected deployed or reported revision cannot be established, latest main cannot be fetched, or the comparison cannot prove whether the root cause remains, mark the candidate `failed` and perform no GitHub write.

## Workspace Integrity for Bug Investigation

1. Capture the starting branch or detached commit, `git status --porcelain=v1 --untracked-files=all`, staged diff, unstaged diff, and relevant untracked-file inventory before instrumenting anything.
2. Preserve every pre-existing user change. Use an isolated temporary worktree or copy when ownership overlaps or cannot be distinguished safely.
3. Inspect existing source, tests, and logs first. Add bounded temporary instrumentation only when needed to establish causality, follow repository logging rules, record every temporary patch or file, and never stage it.
4. Remove only agent-created instrumentation and temporary files after collecting evidence. Never use a broad reset or overwrite concurrent user edits.
5. Before any GitHub write, prove that the workspace matches its baseline except for independently made user changes. If cleanup cannot be proven, perform no GitHub write and report the discrepancy.

## Runtime Evidence for Bug Investigation

- Actively inspect authenticated read-only runtime and provider state when it can confirm or reject a hypothesis, using the tool-selection order above.
- For AWS-backed paths, use a purpose-built connector or MCP tool when it can obtain the required evidence; otherwise use the AWS CLI with an explicitly selected profile and region. Authenticate the selected profile when needed. Query only the narrowest relevant logs, metrics, task state, stack events, load-balancer state, or provider metadata; never mutate resources, enter production workloads, retrieve decrypted secrets, or publish restricted raw logs.
- For database-backed paths, load the repository `postgres` skill and use its purpose-built connector or MCP tool when available; otherwise use `pscale` for read-only metadata, schema, connection, backup, or query-insights evidence. Restrict SQL to `SELECT`, catalog inspection, or `EXPLAIN` inside a read-only transaction; never run DDL, DML, maintenance, or locking statements.
- Record sanitized command shape, target, region or branch, time window, filters, and the result needed to reproduce the evidence. Never record credentials, connection strings, tokens, decrypted configuration, or unrelated customer rows.

## Workflow

1. Ground and classify each candidate.
   - Identify the target repository, affected domain, intended or expected behavior, current state, impact, environment, evidence, and requested outcome. For a `Bug`, identify the affected deployed version and commit or the exact non-deployed reported revision.
   - Read applicable `AGENTS.md` files, `docs/` contracts, nearby source, tests, configuration, and relevant issue history before asking questions.
   - Select `Bug`, `Feature`, or `Task` using the classification rules and partition independently implementable candidates.

2. Establish readiness.
   - For a `Bug`, reproduce and isolate the failure on the affected revision, query relevant read-only runtime evidence, exclude competing explanations, and confirm the complete causal chain. Freshly fetch latest main and evaluate the same cause there. Mark a verified mainline fix `already fixed`; otherwise select the smallest supported correction.
   - For a `Feature` or `Task`, establish the current state and authoritative constraints, evaluate material alternatives, ask for undiscoverable intent, and resolve every implementation, compatibility, rollout, operational, and verification decision that applies.
   - Reduce inaccessible evidence to a portable sanitized representation and prepare exact test setups, actions, and assertions.

3. Build and audit each handoff.
   - Draft one complete new issue or duplicate comment per ready candidate using only facts that can remain in the issue thread and repository.
   - Audit the draft from the perspective of an engineer with no other context. Verify that they can locate the boundary, implement the selected change, and prove it without further research or decisions.
   - Mark unconfirmed bugs as `unconfirmed`, verified mainline fixes as `already fixed`, and decision-incomplete planned work as `failed`; do not write them to GitHub.

4. Restore the workspace.
   - Remove temporary instrumentation and agent-owned artifacts.
   - Compare the branch or commit, status, staged and unstaged diffs, and relevant untracked files with the captured baseline.
   - Continue to GitHub only after cleanup is proven.

5. Check for duplicates.
   - Search open issues separately for each ready candidate using the domain, intended or visible behavior, affected boundary, and root-cause terms when applicable.
   - Treat an issue as a duplicate only when it covers the same root cause or intended outcome and implementation boundary, not merely a similar symptom or theme.
   - Audit the existing body and thread against the handoff standard. Identify the exact evidence or decisions, if any, that the new report must add.
   - Treat closed issues as history. Link a relevant closed issue under `## Additional Notes`, but create a new issue for current work.

6. Record every ready candidate.
   - If Plan Mode is active, perform no GitHub write. Return the exact repository, selected type, title, complete body or duplicate comment, and the later `gh` action. When execution resumes from that complete plan, write without another confirmation.
   - Otherwise, verify that the authenticated viewer has `WRITE`, `MAINTAIN`, or `ADMIN` permission. For an organization-owned target, derive the organization login from the repository owner and query the organization's issue-types endpoint to verify that the exact selected type is enabled. If the target is not organization-owned, the endpoint is unavailable, or either check fails, perform no writes in that repository.
   - For an open duplicate, correct its type when needed and verify the re-fetched type. Add one self-contained comment only when the new report supplies missing evidence or decisions; if the existing thread is already complete and has the correct type, perform no write and return the existing issue. Do not create another issue.
   - Without an open duplicate, create the issue with the exact selected type in the same API request as its title and body, then re-fetch and verify the type before reporting success.
   - If one record fails, retain its failure details and continue with other independently audited candidates when safe. Never merge candidates or undo successful records to compensate.
   - Do not ask for another confirmation immediately before the bounded GitHub write; explicit human invocation authorizes it.

7. Report every outcome.
   - Report `new issue`, `duplicate comment`, `existing issue`, `already fixed`, `unconfirmed`, or `failed` for each candidate.
   - Include the issue or comment URL, selected type, title, target repository, strongest evidence, and root cause for a `Bug`.
   - For `already fixed`, include the affected deployment or reported revision, fetched latest-main commit, fixing change when traceable, comparison evidence, and deployment lag without performing any GitHub write.
   - State clearly when no successful GitHub write occurred and give the exact uncertainty, decision gap, cleanup discrepancy, or write failure.
   - Report the shared workspace cleanup result once.

## GitHub Issue Contract

Use a title in the repository format `<domain>: <description>`. Select a stable lowercase domain from repository contracts, and make the description concise, specific, and start with a lowercase verb phrase when natural.

Use these sections in this exact order:

```markdown
## Summary
State the requested outcome, affected users or systems, impact, and confirmed root cause for a Bug.

## Evidence
- Affected environment and repository revision:
- Deployed version and commit, latest-main commit, and comparison result for a Bug:
- Source provenance and implementer access assumptions:
- Current behavior or state:
- Authoritative expected or intended behavior:
- Portable reproduction, fixture, test vector, or repository evidence:
- Responsible files, symbols, configuration, data, or contract boundaries:
- Decision provenance and resolved alternatives:
- Supporting commands, logs, tests, or code references:
- Duplicate search:

## Current Gap
Identify the violated invariant, missing capability, or maintenance gap and its exact boundary.

## Proposed Scope
Specify the selected implementation, affected contracts, preserved behavior, compatibility or migration handling, and applicable rollout, operations, observability, documentation, and support work. Leave no material alternative open.

## Acceptance Criteria
- Define exact observable results and boundary invariants.
- Define preserved behavior and any compatibility or migration result.
- Define the regression evidence that proves the requested outcome.

## Test Scenarios
- Give concrete setup, fixture or input, action, and assertion for the primary path.
- Cover relevant failure, permission, boundary, migration, rollout, or counterfactual behavior.
- Cover the nearest preserved or non-failing path for regression.

## Out of Scope
- List adjacent work, redesigns, or behavior deliberately excluded from this issue.
```

For a `Bug`, include the trigger, observed and expected results, confirmed causal chain, redactions or synthetic substitutions, runtime evidence, and excluded alternatives in `## Evidence`. For `Feature` and `Task`, include the problem evidence, affected actors, authoritative constraints, resolved decisions, and why rejected alternatives were not selected.

Replace every prompt with candidate-specific content. Use an explicit, justified `Not applicable` only when a field genuinely does not apply and omission cannot shift work or decisions to the implementer. Append `## Additional Notes` only for useful context such as a related closed issue. If required evidence cannot be represented safely and self-sufficiently, do not write the issue or comment.

## Useful Commands

```bash
gh repo view --json nameWithOwner,url
git fetch --no-tags origin main
git rev-parse refs/remotes/origin/main
git merge-base --is-ancestor "$AFFECTED_COMMIT" refs/remotes/origin/main
gh issue list --repo "$OWNER_REPO" --state open --search "$SEARCH_TERMS"
gh repo view "$OWNER_REPO" --json viewerPermission --jq '.viewerPermission'
gh api -H "X-GitHub-Api-Version: 2026-03-10" "repos/$OWNER_REPO" --jq '.owner | [.login, .type] | @tsv'
OWNER="${OWNER_REPO%%/*}"
gh api -H "X-GitHub-Api-Version: 2026-03-10" "orgs/$OWNER/issue-types" --jq '.[] | select(.is_enabled == true) | .name'
gh api --method POST -H "X-GitHub-Api-Version: 2026-03-10" "repos/$OWNER_REPO/issues" -f "title=$TITLE" -F "body=@$BODY_FILE" -f "type=$ISSUE_TYPE"
gh api --method PATCH -H "X-GitHub-Api-Version: 2026-03-10" "repos/$OWNER_REPO/issues/$ISSUE_NUMBER" -f "type=$ISSUE_TYPE"
gh api -H "X-GitHub-Api-Version: 2026-03-10" "repos/$OWNER_REPO/issues/$ISSUE_NUMBER" --jq '.type.name'
gh issue comment "$ISSUE" --repo "$OWNER_REPO" --body-file "$COMMENT_FILE"
aws sts get-caller-identity --profile "$AWS_PROFILE"
aws logs filter-log-events --log-group-name "$LOG_GROUP" --start-time "$START_MS" --end-time "$END_MS" --region "$AWS_REGION" --profile "$AWS_PROFILE"
pscale database list --org "$PLANETSCALE_ORG" --format json
pscale branch schema "$DATABASE" "$BRANCH" --org "$PLANETSCALE_ORG"
```

Use safely quoted variables and temporary files for multiline Markdown.
