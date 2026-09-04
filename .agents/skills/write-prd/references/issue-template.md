# PRD GitHub Issue Template

Create one issue per coherent feature or implementation slice. Follow the target repository's issue style contract when it differs from this reference.

## Title

Use:

```text
<domain>: <description>
```

- `<domain>` must be a stable lowercase identifier from the relevant repository contract when available.
- `<description>` should be concise, specific, and start with a lowercase verb phrase when natural.
- Do not use bracket-style project prefixes.

## Body

Use the following section order.

```markdown
## Summary
State the requested feature, target users, core value, and success criteria in one or two concise paragraphs.

## Evidence
- Source:
- Current gap:
- Users or actors affected:
- Repository or contract evidence:
- Duplicate search:

## Current Gap
Explain the current behavior, missing capability, or operational gap that makes the feature necessary.

## Proposed Scope
Describe the exact functional and operational scope to implement. Include interfaces, data/state, UX, security/privacy, integrations, rollout, observability, docs, and support decisions that are in scope.

## Acceptance Criteria
- A user or system can ...
- Authorization, data ownership, and error behavior are ...
- Observability and operational controls are ...
- Documentation or support artifacts are ...

## Test Scenarios
- Verify the main happy path.
- Verify permission, validation, and error handling.
- Verify contract, data, migration, or integration behavior.
- Verify rollout, rollback, observability, and support scenarios where applicable.
- Verify non-regression for preserved behavior.

## Out of Scope
- List adjacent capabilities, migrations, redesigns, compatibility promises, or operational work that the user explicitly excluded.
```

Append this section only when it contains useful context that does not fit the required sections:

```markdown
## Additional Notes
- Link related issues, PRs, docs, logs, screenshots, or decisions.
```

## Filing Checklist

Before running `gh issue create`, verify:

- Every decision ledger row is closed without inferred defaults.
- The title follows the target repository's issue contract.
- The issue body contains all required sections in order.
- Acceptance criteria and test scenarios are concrete enough for implementation and QA.
- Out-of-scope decisions are explicit.
- Exactly the `PRD` label will be applied.
- No assignee, milestone, project field, issue type, other label, or other metadata will be set during or after creation.
