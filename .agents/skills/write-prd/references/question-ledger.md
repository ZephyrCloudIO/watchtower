# PRD Decision Ledger

Use this ledger to force explicit decisions before writing or filing the PRD issue.

## Ledger Rules

- Keep a row for every category below.
- Mark each row as `open`, `answered`, `not applicable`, or `contract-determined`.
- Do not use defaults. Do not infer intent from general best practices.
- For `contract-determined` rows, record the source path, issue, command output, or API/schema evidence.
- For `not applicable` rows, record the user's explicit reason.
- If the requested feature crosses multiple products, services, users, or rollout paths, duplicate the relevant rows per affected area.

Use this compact ledger shape during the conversation:

```markdown
| Category | Status | Decision | Evidence or user answer |
| --- | --- | --- | --- |
| Goal | open |  |  |
```

## Required Categories

### Product Intent

- Goal: the user-visible outcome and why this feature should exist.
- Problem evidence: current gap, source issue, user report, metric, support case, screenshot, log, or other evidence.
- Target users and actors: primary users, secondary users, operators, admins, systems, and excluded users.
- Success criteria: measurable or observable signals that the feature worked.
- Priority and urgency: release driver, deadline, dependency, or explicit lack of deadline.

### Scope

- In scope: exact capabilities, flows, commands, screens, APIs, jobs, or documents to change.
- Out of scope: adjacent ideas, future work, migrations, redesigns, or behavior intentionally excluded.
- Non-goals: what the feature must not solve.
- Dependencies: upstream or downstream work required before implementation can finish.
- Existing behavior preservation: behavior, data, or contracts that must remain unchanged.

### User Experience

- Entry points: navigation, command, API call, automation, event, or integration that starts the flow.
- Happy path: ordered user/system steps and expected results.
- Empty, loading, error, permission, and recovery states.
- Copy and terminology: labels, messages, user-facing names, and domain terms.
- Accessibility and localization requirements.
- Mobile, desktop, CLI, API, or operator-surface requirements.

### API and Contracts

- Public interfaces: Connect RPCs, REST exceptions, CLI flags, routes, events, headers, streams, files, or webhooks.
- Request, response, stream, and error shapes.
- Identifier formats and externally visible references.
- Authorization and tenancy boundaries in each interface.
- Backward compatibility, breaking-change intent, and client migration expectations.
- Contract documentation that must change.

### Data and State

- Data model, persistence, retention, deletion, and archival decisions.
- Source of truth and ownership boundaries.
- Read models, caches, denormalized state, and invalidation behavior.
- Idempotency, concurrency, ordering, replay, and retry semantics.
- Import/export, backfill, migration, and rollback data handling.

### Security, Privacy, and Compliance

- Authentication and authorization rules.
- Tenant, workspace, enterprise, project, or user isolation.
- Secret, token, credential, and key handling.
- PII, sensitive data, audit, privacy, retention, and deletion requirements.
- Abuse, rate limit, quota, and fraud controls.
- Security review or compliance gates.

### Integrations

- Internal services, external systems, queues, databases, object stores, email, billing, AI providers, or third-party APIs involved.
- Failure behavior and retry limits for each integration.
- Webhook/event delivery guarantees and duplicate handling.
- Environment variables, credentials, or configuration required.

### Rollout

- Initial availability, staged rollout, promotion signals, pause conditions, and success gates.

### Operations

- Deployment unit, runtime, worker, cron, queue, stream, database, or infrastructure changes.
- Deployment and operational rollback behavior.
- SLOs, latency, throughput, capacity, cost, and scaling expectations.
- Runbooks, operator actions, support workflows, and escalation paths.
- Backward and forward compatibility during deploy and rollback.

### Observability

- Logs required for debugging and incident analysis.
- Metrics, traces, dashboards, alerts, and audit events.
- Error classification and alert thresholds.
- Debug identifiers that must appear in logs or user/operator views.

### Edge Cases and Failure Modes

- Validation failures and malformed input.
- Partial success, timeout, cancellation, duplicate submission, stale state, and race conditions.
- Offline, degraded dependency, rate limit, permission change, and deleted-resource behavior.
- Multi-tenant, cross-workspace, cross-region, or high-volume edge cases.

### Documentation and Support

- Repository docs, project docs, API docs, user docs, changelog, or release notes to update.
- Support scripts, admin tooling, FAQ, or troubleshooting notes.
- Training or migration communication needed for users or operators.

### Testing and Acceptance

- Acceptance criteria expressed as observable outcomes.
- Unit, integration, contract, E2E, migration, load, security, accessibility, or manual test scenarios.
- Fixtures, seeded data, mocks, or test environments required.
- Explicit non-regression scenarios.

### Issue Filing

- Target GitHub repository.
- Issue domain prefix and title description.
- Issue metadata: apply exactly the `PRD` label; do not ask for or set assignees, milestones, project fields, issue types, other labels, or other metadata.
- Duplicate issue search terms and result.
