---
name: write-prd
description: Product requirements decision capture and GitHub issue creation. Use only when a human explicitly invokes `$write-prd`; never select this skill automatically from feature, planning, PRD, or issue-creation task similarity. When explicitly invoked, write, define, scope, or finalize a PRD; turn a feature idea into a GitHub issue; or collect product, technical, operational, rollout, observability, support, documentation, and testing decisions.
---

# Write PRD

## Goal

Turn a feature request into a complete PRD-backed GitHub issue. Do not invent defaults. Every functional and operational decision must be answered by the user or explicitly marked not applicable by the user before creating the issue.

## Required References

Read these files before asking PRD questions or writing the issue:

- `references/question-ledger.md` for the required decision ledger.
- `references/issue-template.md` for the GitHub issue shape.

## Operating Rules

- Follow all active system, developer, repository, and scoped `AGENTS.md` instructions.
- Read the repository docs and contracts for the affected area before finalizing decisions. If the repository requires listing `docs/`, do that first.
- Use the current repository's GitHub issue target by default. If the target repository is ambiguous, ask before filing.
- Use `gh` for GitHub issue operations when possible.
- Apply exactly the `PRD` label when filing an issue. Do not ask for or set assignees, milestones, project fields, issue types, any other labels, or other issue metadata, and do not add them after creation.
- If the target repository requires metadata other than the `PRD` label, report the conflict and do not file the issue until the user resolves it.
- Ask questions in small batches. Prefer grouped, concrete questions that close decision-ledger rows.
- Do not close a ledger row with an inferred default, common practice, or agent preference. A row is closed only by explicit user answer, explicit user-approved not applicable, or a repository contract that directly determines the answer.
- If a repository contract determines a row, cite the path or command evidence in the ledger and ask the user only when product intent still remains open.
- If the user asks to skip a category, record that category as explicitly out of scope or not applicable with the user's stated reason.
- Do not create the GitHub issue while any ledger row remains open.

## Workflow

1. Ground the request.
   - Identify the feature idea, affected product/domain, likely repository contracts, and issue target.
   - Read applicable docs, schemas, route/API contracts, existing issues, or nearby code needed to avoid asking discoverable questions.
   - Initialize a visible decision ledger using `references/question-ledger.md`.

2. Collect decisions.
   - Ask only questions that materially close open ledger rows.
   - Keep asking until every required row is answered, explicitly not applicable, or contract-determined.
   - Reconcile contradictions immediately; do not proceed with conflicting answers.
   - Track evidence, open questions, and user answers separately so the final issue does not blur facts with assumptions.

3. Handle Plan Mode.
   - In Plan Mode, do not create the issue or otherwise mutate external state.
   - When the ledger is complete, produce the final Plan Mode output with the exact issue title, body, issue target, and post-plan action to run `gh issue create`.
   - When later running outside Plan Mode from a complete prior plan, create the issue immediately without asking for another confirmation.

4. Write the PRD issue.
   - Use `references/issue-template.md` and the repository issue style contract.
   - Include functional and operational decisions in the required sections without adding unsupported decisions.
   - Keep the issue implementation-ready: concrete scope, acceptance criteria, test scenarios, and explicit out-of-scope boundaries.

5. File the issue.
   - If not in Plan Mode and the ledger is complete, create the issue immediately with `gh issue create`.
   - Pass `--label "PRD"` and no other issue metadata flags.
   - Use a temporary body file or another safe shell quoting approach for multiline Markdown.
   - Report the created issue URL, title, target repository, and any follow-up risk.

## Useful Commands

```bash
gh repo view --json nameWithOwner -q .nameWithOwner
gh issue list --repo "$OWNER_REPO" --search "$SEARCH_TERMS" --state open
gh issue create --repo "$OWNER_REPO" --title "$TITLE" --body-file "$BODY_FILE" --label "PRD"
```

Use quoted shell variables and file paths in commands.
