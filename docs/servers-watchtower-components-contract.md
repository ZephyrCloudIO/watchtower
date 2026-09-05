# Watchtower Component and Deployment Boundary Contract

## Scope and Authority

This contract defines the authoritative component, route, data, dependency,
failure, and deployment boundaries for Watchtower. It is documentation only;
it does not create a server, application, protocol, persistence, queue, or
deployment implementation.

Watchtower consists of six independently scalable and failure-isolated
deployment units:

- `watchtower-ingest`
- `watchtower-api`
- `watchtower-processor`
- `watchtower-query`
- `watchtower-jobs`
- `watchtower-web`

The six units use one coordinated release train. They receive and roll back
the same release, but retain independent scaling, readiness, and failure
domains. Detailed product decisions are owned by the downstream contracts
listed in `docs/project-watchtower.md`.

## Boundary Invariants

- Every authoritative data class has exactly one writer.
- Cross-component SQL, object-store access, shared repository
  implementations, and persistence fallbacks are prohibited.
- Cross-component access occurs only through versioned unary Protobuf HTTP,
  versioned durable messages, or consumer-owned projections.
- Compatibility DTOs exist only at external adapters. They never become
  canonical Watchtower domain or persistence models.
- Browsers and external clients never consume internal messages or invoke
  internal RPCs.
- No component bypasses an unavailable owner through direct storage access.

## Component Ownership

| Component | Public surface and responsibilities | Must not own |
| --- | --- | --- |
| `watchtower-ingest` | Public write-only telemetry routes, protocol admission, raw accepted records, and the recoverable handoff/outbox to processing. | Normalization, enrichment, grouping, control-plane state, analytical queries, or another component's storage. |
| `watchtower-api` | Native `/api/v1` control-plane and release/artifact commands, every Sentry-compatible management REST route, control-plane and artifact authority, and versioned change events. | Telemetry admission, canonical telemetry processing, analytical storage, or direct query-store access. |
| `watchtower-processor` | Asynchronous normalization, privacy processing, enrichment, symbolication execution, canonical telemetry, processing state, and derived domain aggregates. | Public business routes, control-plane authority, query serving, job scheduling, or another owner's store. |
| `watchtower-query` | Native `/api/v1` read/query routes, Prometheus-, Loki-, and Tempo-compatible query routes, read projections, search and analytical indexes, caches, and provider query orchestration. | Canonical, control-plane, or raw writes, and fallback persistence access. |
| `watchtower-jobs` | Scheduling, leases, retries, dead-letter state, execution history, and asynchronous orchestration. | Public business routes, domain business logic, or direct writes to domain-owned storage. |
| `watchtower-web` | The React browser experience, static assets, and bounded client-local UI state. | Server-authoritative state, Sentry DTOs, internal RPCs, persistence, or durable-log access. |

The L7 routing layer may route traffic but owns no business behavior. It sends
telemetry writes to Ingest, Sentry management and native control or
release/artifact commands to API, and native or compatible queries to Query.
Web serves the browser experience and static assets; browser actions use the
public API boundaries above.

Processor and Jobs expose only health and authenticated internal interfaces.
They have no public business routes.

## Owned State and Projections

| Component | Authoritative state, owned projection, or cache |
| --- | --- |
| Ingest | Raw accepted records, recoverable processing handoff/outbox, and local projections of API-published security or control changes. |
| API | Control-plane state, artifact authority, and versioned change events describing those authoritative changes. |
| Processor | Canonical telemetry, processing state, and derived domain aggregates. |
| Query | Query-owned read projections, search and analytical indexes, caches, and provider query orchestration state. |
| Jobs | Durable scheduling requests, leases, retry state, dead-letter state, and execution history. |
| Web | Released static assets and bounded client-local UI state only; it has no server-authoritative data. |

An event producer remains authoritative for the data it changes, while the
consumer owns and writes its local projection. Security-sensitive projections
must complete an initial snapshot before readiness and must fail closed when
unavailable or older than the maximum freshness established by the
authorization PRD.

## Scaling and Failure Matrix

| Component | Independent scaling boundary | Failure behavior and customer-visible owner |
| --- | --- | --- |
| Ingest | Protocol admission, raw-record writes, and recoverable handoff capacity. | Ingest owns admission outcomes and stops successful admission when safe capacity is exhausted; accepted raw records and handoffs remain recoverable. |
| API | Control-plane, artifact, release, and Sentry management request load. | API owns control mutations and management compatibility responses; API failure does not stop valid Ingest admission or Query reads while their security projections remain fresh. |
| Processor | Asynchronous normalization, privacy, enrichment, symbolication, and aggregate processing backlog. | Processor owns processing lag and recovery; failure preserves durable handoff work and does not create public business routes or direct storage fallbacks. |
| Query | Native and compatible read load, projection consumption, indexes, and caches. | Query owns query results and projection freshness; Query failure stops query routes and Sentry management reads but not API-owned mutations. |
| Jobs | Scheduling, lease, retry, dead-letter, and asynchronous execution load. | Jobs owns scheduling and execution outcomes; failure preserves durable requests and domain owners remain the only writers of domain state. |
| Web | Browser asset delivery and client-local UI work. | Web owns the browser experience and static assets; Web failure does not grant the browser server authority or stop server-owned mutations and processing. |

## Routing and Dependency Direction

The allowed protocol and data-flow direction is:

1. Browsers and external clients reach public routes through the shared L7
   routing layer. They cannot reach internal messages or RPCs.
2. Ingest accepts telemetry and consumes API-published changes for local
   authorization-related projections. It publishes recoverable processing
   handoff work.
3. API accepts control-plane, release, artifact, and Sentry management
   commands. It publishes versioned change events. API may call Query's
   internal read interface for Sentry management reads, but never reads Query
   persistence directly.
4. Processor consumes Ingest handoff work and relevant API changes. It
   publishes canonical and derived changes.
5. Query consumes API changes and Processor changes into its own projections,
   indexes, and caches. It does not call another component for persistence
   fallback.
6. Jobs receives durable requests, owns scheduling and retry state, and
   dispatches versioned commands to the component owning the affected data.
   That owner performs the idempotent side effect and publishes the outcome.

This direction contains no circular protocol or persistence dependency. API
outages do not immediately stop valid Ingest admission or Query reads while
their security projections remain valid. Query outages stop Query routes and
Sentry management reads, but not API-owned mutations. Processor or Jobs
outages preserve durable work for later processing.

## Data Flow and Failure Boundaries

Ingest may acknowledge a successful telemetry write only after both the raw
accepted record and a recoverable processing handoff/outbox are durably
established. Processor or broker outages may accumulate bounded backlog. When
safe capacity is exhausted, Ingest must stop returning successful admissions
until capacity is recovered.

Processor owns asynchronous normalization, privacy processing, enrichment,
symbolication execution, canonical telemetry, processing state, and derived
aggregates. Query consumes Processor's canonical and derived changes and owns
all resulting read projections, indexes, and caches.

Sentry management reads enter through API's compatibility boundary. API
translates external DTOs and calls Query's internal interface; it never accesses
Query persistence directly. The compatibility DTO remains at that adapter.

Jobs receives durable requests and owns scheduling, leases, retries,
dead-letter state, execution history, and orchestration. It dispatches a
versioned command to the data owner. The owner executes the side effect
idempotently and publishes the outcome; Jobs never writes domain-owned storage.

Diagnostic and recovery ownership follows data ownership:

- The L7 layer owns route selection and edge diagnostics.
- Ingest owns admission, raw records, handoffs, outboxes, and their recovery.
- API owns control-plane and artifact authority and its change publication.
- Processor owns canonical processing and derived aggregate recovery.
- Query owns projection, index, cache, and provider-query recovery from
  replayable upstream changes.
- Jobs owns scheduling, lease, retry, dead-letter, and execution-history
  recovery.
- `watchtower-web` owns its released static assets; server components own all
  server authority used by the browser.

Each implementation must have concrete diagnostic and recovery runbooks before
it is production-ready.

## Interface Contracts

Native public business routes use `/api/v1`. Sentry-compatible routes retain
the upstream route and request behavior required by the supported compatibility
contract. The exact endpoint and compatibility matrices remain downstream
decisions.

Initial synchronous component calls use unary Protobuf-over-HTTP under
`/internal/v1`. Internal streaming, gRPC, and Connect RPC are not part of
version 1. A future server-streaming PRD must update this contract and prefer
Connect RPC over gRPC only after renewed Rust and Pingora maturity validation.

The callee owns each Protobuf service contract. Sources live under
`protos/<service-name>/v1`; synchronized generated bindings are required for
consumers. Internal errors use a safe Protobuf envelope containing a canonical
code, safe message, retryability, and correlation identifier. Original causes
remain in structured logs.

| Canonical code | HTTP status |
| --- | ---: |
| `canceled` | 499 |
| `unknown` | 500 |
| `invalid_argument` | 400 |
| `deadline_exceeded` | 504 |
| `not_found` | 404 |
| `already_exists` | 409 |
| `permission_denied` | 403 |
| `resource_exhausted` | 429 |
| `failed_precondition` | 400 |
| `aborted` | 409 |
| `out_of_range` | 400 |
| `unimplemented` | 501 |
| `internal` | 500 |
| `unavailable` | 503 |
| `data_loss` | 500 |
| `unauthenticated` | 401 |

Deadlines and cancellation propagate across synchronous calls. Automatic
retries are budget-limited and permitted only for operations explicitly
declared idempotent.

Every asynchronous message uses a common versioned envelope containing:

- a canonical lowercase UUID v7 message ID;
- message type and schema version;
- producer;
- tenant and project context;
- event time;
- causation and correlation identifiers;
- W3C trace context;
- an idempotency key; and
- either a bounded payload or an authorized payload reference.

Credentials and unrestricted customer payloads are prohibited. Delivery is at
least once and consumers are idempotent. There is no global ordering guarantee
unless a downstream domain PRD explicitly declares ordering for an aggregate
partition.

## Security and Configuration

Every public component authenticates its protocol and performs the initial
authorization check. The final data owner independently validates tenant,
actor, action, and resource context. Web client behavior never replaces these
server-side checks.

Internal HTTP requires mTLS workload identity and explicit caller policy.
Durable-log producers and consumers require equivalent ACLs. Bearer tokens,
private keys, opaque session material, and unrestricted customer payloads must
not be forwarded in messages or written to logs.

Each component uses typed startup configuration and fails startup validation
safely. Each receives separate least-privilege credentials. Production and
non-production credentials and trust roots remain isolated.

Live reload is limited to mTLS certificates, CA bundles, and broker, storage,
or service credentials. Invalid reloads retain the last-known-good value and
emit an operational alert. All other configuration changes require deployment.

Detailed roles, WorkOS behavior, credential lifecycle, PII handling, retention,
deletion, abuse controls, and compliance gates remain owned by issues #15 and
#18.

## Deployment and Operations

The six units scale and fail independently but share one coordinated release
train. All units receive the same release and roll back together. Long-lived
independent version skew is unsupported.

Ordered rollout and rollback require bounded N/N-1 compatibility. Consumers
must understand every message version still inside the replay horizon.
Persistence changes use expand/contract sequencing so rollout and whole-stack
rollback remain safe without destructive storage changes.

Each component exposes separate liveness, readiness, and dependency
diagnostics. Readiness reflects only capabilities required by the component's
owned paths and does not transitively require unrelated downstream workers.
Security-sensitive projections must have completed their initial snapshot and
remain within the authorization PRD's maximum freshness boundary before they
can authorize affected paths.

Graceful shutdown removes readiness, stops new work, drains in-flight work to a
configured deadline, persists checkpoints and outboxes, releases leases, and
only then exits. Shutdown diagnostics record whether draining completed or the
deadline was reached.

Structured logs, metrics, and distributed spans propagate W3C trace context
plus UUID v7 request, operation, and message identifiers. Required metrics
include request latency and errors, admission outcomes, backlog and projection
lag, processing lag, retries and dead letters, resource saturation, readiness,
and shutdown drain results.

Numeric availability, latency, throughput, backlog, capacity, and cost targets
are production gates owned by relevant downstream PRDs. This contract does
not invent platform-wide numbers.

Split a unit only after measured repeated SLO, capacity, cost,
security/isolation, ownership, or deployment-cadence evidence plus a contract
update. Merge units only after sustained evidence that their scaling, failure,
security, and ownership boundaries coincide.

## Feature Flags and Rollout Controls

A feature flag is not applicable. This issue changes only authoritative
contracts and introduces no executable behavior, staged runtime rollout, kill
switch, or PostHog flag. Future implementations must define their own rollout
controls without replacing authorization, tenancy, quota, resource-state, or
safety enforcement.

## Contract Walkthroughs

The following walkthroughs are required review cases for this contract and
become runtime acceptance criteria for the owning implementation issues:

1. Follow a Sentry SDK request through routing, Ingest, durable raw and
   handoff records, Processor, Query projection, and visible query results.
2. Stop Processor delivery before and after Ingest acknowledgement; accepted
   data remains recoverable, and admission stops at the documented capacity
   boundary.
3. Follow a native control command from Web to API through defense-in-depth
   authorization, authoritative persistence, and change publication.
4. Follow a Sentry management read through API compatibility translation and
   unary Protobuf HTTP to Query without direct Query persistence access.
5. Perform a native or compatible query during API outage with a valid
   security projection, then cross its freshness boundary and fail closed.
6. Redeliver a retention or deletion request and verify Jobs schedules it while
   the data owner performs one idempotent effect without Jobs writing its store.
7. Reject forged tenant context, invalid workload identity, unauthorized
   broker access, and cross-tenant projection data.
8. Exercise every canonical error mapping, deadline, cancellation, retryable
   failure, exhausted retry budget, and non-idempotent retry rejection.
9. Perform a coordinated N-to-N+1 rollout and whole-stack rollback while old
   messages remain replayable and storage changes use expand/contract.
10. Remove readiness and shut down while requests, messages, checkpoints,
    outboxes, or leases are active.
11. Add a future telemetry adapter and verify it changes only the external
    adapter and downstream domain contract, not canonical ownership.
12. Review every ownership and failure entry for an unowned path, shared
    writer, circular dependency, or undocumented fallback.

## Deferred Decisions and Non-Goals

This contract does not select exact databases, analytical stores, object
stores, durable-log products, deployment platforms, or numeric SLO targets. It
does not define endpoint catalogs, Sentry compatibility versions, canonical
telemetry fields, authorization roles, PII policy, query semantics, UI states,
alert behavior, or job retry numbers owned by downstream PRDs.

It does not create server, application, Protobuf, storage, queue, or
deployment scaffolds, and it does not implement public routes, internal RPCs,
adapters, projections, processing, jobs, or UI.
