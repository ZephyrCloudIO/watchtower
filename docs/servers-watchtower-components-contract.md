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
- An owner-mediated data retrieval interface does not grant another component
  direct storage access; the owning component remains the only storage reader.
- Compatibility DTOs exist only at external adapters. They never become
  canonical Watchtower domain or persistence models.
- Browsers and external clients never consume internal messages or invoke
  internal RPCs.
- No component bypasses an unavailable owner through direct storage access.

## Component Ownership

| Component | Public surface and responsibilities | Must not own |
| --- | --- | --- |
| `watchtower-ingest` | Public write-only telemetry routes, protocol admission, raw accepted records, and the recoverable handoff/outbox to processing. | Normalization, enrichment, grouping, control-plane state, analytical queries, or another component's storage. |
| `watchtower-api` | Native `/api/v1` control-plane and release/artifact commands, every Sentry-compatible management REST route, control-plane and artifact authority, versioned change events, and contract-level audit authority. | Telemetry admission, canonical telemetry processing, analytical storage, or direct query-store access. |
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
| API | Control-plane state, artifact authority, versioned change events describing those authoritative changes, and the append-only contract-level audit event boundary. |
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
| Query | Native and compatible read load, projection consumption, indexes, and caches. | Query owns query results and projection freshness; Query failure stops query routes and Sentry management reads. Ordinary API-owned mutations continue, but mutations that require Query's synchronous durable fence or acknowledgement fail closed while Query is unavailable. |
| Jobs | Scheduling, lease, retry, dead-letter, and asynchronous execution load. | Jobs owns scheduling and execution outcomes; failure preserves durable requests and domain owners remain the only writers of domain state. |
| Web | Browser asset delivery and client-local UI work. | Web owns the browser experience and static assets; Web failure does not grant the browser server authority or stop server-owned mutations and processing. |

## Routing and Dependency Direction

The allowed protocol and data-flow direction is:

1. Browsers and external clients reach public routes through the shared L7
   routing layer. They cannot reach internal messages or RPCs.
2. Ingest accepts telemetry and consumes API-published changes for local
   authorization-related projections. It publishes recoverable processing
   handoff work and consumes Processor's terminal `RawHandoffDispositionV1`
   messages before retiring the corresponding raw state. Processor retrieves
   referenced raw bytes only through Ingest's authenticated
   `RawPayloadFetchV1` interface.
3. API accepts control-plane, release, artifact, and Sentry management
   commands. It publishes versioned change events. API may call Query's
   authenticated internal interfaces for Sentry management reads and authorized
   export download-gateway issuance and `AuthorizationRevocationFenceV1` for
   immediate export-download revocation, and Processor's authenticated
   `ExportWatermarkV1` interface at export creation, but never reads another
   component's persistence directly.
4. Processor consumes Ingest handoff work and relevant API changes. It
   publishes canonical and derived changes, answers API's versioned
   export-watermark requests, accepts Query's authorized `ProjectionRebuildV1`
   requests, and publishes a terminal `RawHandoffDispositionV1` to Ingest for
   every completed, shortened-policy-rejected, or default-expired raw handoff.
5. Query consumes API changes and Processor changes into its own projections,
   indexes, and caches. It consumes Jobs-dispatched revision-fenced
   `ExportExecutionV1` commands carrying API-persisted Processor watermarks,
   publishes versioned export outcomes for API to record customer-visible
   lifecycle transitions, submits authorized `ProjectionRebuildV1` requests to
   Processor, and does not call another component for persistence fallback.
6. Jobs receives durable requests, owns scheduling and retry state, and
   dispatches versioned commands to the component owning the affected data.
   Jobs owns baseline lifecycle-purge schedules even when no shortened policy is
   active. During a lifecycle prepare phase, data owners durably register paused
   policy or project-deletion purge work with Jobs before returning a matching
   `phase=prepared` `LifecycleMutationAcknowledgementV1`; Jobs enables the
   schedule only after API commits activation. Each of Ingest, Processor, Query,
   and Jobs obtains the current
   retention-policy and deletion-tombstone snapshots through an authenticated
   `ControlRegistrySnapshotV1` request to API before readiness or after
   restoration. The owner performs the idempotent side effect and publishes
   the outcome.
7. Ingest, Processor, Query, and Jobs submit required evidence for break-glass,
   restoration, key, replication, backup, and restore actions to API through a
   versioned durable audit-evidence message. API validates the producer,
   context, correlation, and idempotency data and is the only component that
   appends the contract-level audit event; components do not write API audit
   storage directly.

This direction contains no circular protocol or persistence dependency. API
outages do not immediately stop valid Ingest admission or Query reads while
their security projections remain valid. Query outages stop Query routes and
Sentry management reads, but not ordinary API-owned mutations. API-owned
mutations that require Query's synchronous durable fence or acknowledgement,
including retention-policy shortening, project deletion, and
authorization-revocation fencing, fail closed while Query is unavailable.
Processor or Jobs outages preserve durable work for later processing.

## Data Flow and Failure Boundaries

Ingest may acknowledge a successful telemetry write only after both the raw
accepted record and a recoverable processing handoff/outbox are durably
established. Processor or broker outages may accumulate bounded backlog. When
safe capacity is exhausted, Ingest must stop returning successful admissions
until capacity is recovered. Ingest does not retire the raw object, acceptance
metadata, or handoff outbox until it durably records the matching terminal
Processor disposition.

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

The export-time watermark handoff is a versioned unary Protobuf-over-HTTP call
under `/internal/v1` from API to Processor. API sends the canonical lowercase
UUID v7 `export_id` (stored as PostgreSQL `uuid` in API state) and
`export_revision`, authorized tenant and project scope, `accepted_at` range,
selected signals, derived-selection flag, correlation identifier, and idempotency
key.
Processor returns a correlated versioned response containing the canonical
change watermark for that scope and, when applicable, the authoritative
derived-state revision watermark. API persists the response and includes the
watermarks only in the durable scheduling request sent to Jobs; Jobs owns the
lease, retry, and cancellation state and dispatches a revision-fenced
`ExportExecutionV1` command to Query carrying those watermarks, the authorized
scope, range, selected signals, and `export_revision`. Query never receives a
direct API execution dispatch or infers an authoritative watermark from its
local projection. Before execution, Processor and Query install an
export-scoped snapshot hold keyed by `export_id` and `export_revision`; Query
fails the export without an artifact if the hold or any requested watermark
cannot be materialized.

Jobs schedules an idempotent versioned `ExportExpiryV1` handoff for
`completed_at + 7 days` and sends it to API. API alone advances a still-
completed export to `expired` and publishes the invalidation to Query; Query
invalidates the artifact and rejects expired downloads even if the object is
already inaccessible.

The projection-rebuild handoff is a versioned unary Protobuf-over-HTTP call
under `/internal/v1` from Query to Processor. Query sends a canonical lowercase
UUID v7 `rebuild_id`, authorized tenant and project scope, `accepted_at` range,
selected signals, derived-selection flag, correlation identifier, and
idempotency key. Processor validates the authorization, retention, and deletion
fences, durably records the request and its idempotency state with `rebuild_id`
stored as PostgreSQL `uuid` before acknowledging it, and republishes eligible
versioned canonical or derived changes through its normal change path. The
correlated response reports durable acceptance or a terminal safe error; Query
never accesses Processor persistence directly.

The raw payload retrieval path is a versioned unary `RawPayloadFetchV1`
Protobuf-over-HTTP call under `/internal/v1` from Processor to Ingest. A raw
handoff may carry an opaque, owner-issued `RawPayloadReferenceV1` containing
only the scope, `watchtower_id`, object digest, size, and expiry needed for
this handoff. Processor presents that reference with an idempotent bounded
byte-range or chunk cursor request. Ingest authenticates the Processor
workload, validates the reference against its acceptance record and current
retention and deletion fences, reads its own S3 object, and returns a bounded
chunk with the verified digest, size, and next cursor. Processor receives no
S3 credentials or usable object-store grant, and the reference is not
customer-readable, reusable by another component, or written to logs.

The raw-handoff completion path is a versioned durable `RawHandoffDispositionV1`
message from Processor to Ingest using the common asynchronous envelope. Its
bounded payload contains the canonical lowercase UUID v7 `watchtower_id`, a
terminal `disposition` of `completed`, `policy_rejected`, or `default_expired`,
and the generation context for the result: canonical lowercase UUID v7
`processing_generation` is required for `completed`, `policy_rejected` includes
the `retention_policy_generation`, and `default_expired` includes a bounded
rejection reason with `expiry_basis=class_default` and no policy generation.
The Processor publishes the message through its durable outbox after recording
the terminal result; transient processing failures publish no terminal
disposition. Ingest
transactionally persists the disposition and idempotency state before retiring
the matching outbox entry and raw acceptance data. Redelivery of the same
message is idempotent, and a conflicting disposition or generation is an
integrity failure that cannot retire raw state.

The registry-snapshot handoff is a versioned unary Protobuf-over-HTTP call under
`/internal/v1` from each of Ingest, Processor, Query, and Jobs to API. Each owner
requests the current retention-policy and deletion-tombstone snapshots with its
authenticated owner identity, correlation, and idempotency context. API returns
the versioned snapshots and their highest generations; the requesting owner
persists them before readiness and fails closed if the snapshot cannot be
installed. Subsequent policy and deletion mutations use the same
generation-aware durable handoffs, while this request repairs state after
restoration or rebuild.

Retention-policy and project-deletion barriers use a versioned unary
`LifecycleMutationV1` Protobuf-over-HTTP request from API to each of Ingest,
Processor, Query, and Jobs under `/internal/v1`. The request carries the
mutation kind, `phase` (`prepare` or `activate`), authorized scope, monotonic
mutation generation, correlation identifier, and idempotency key. During
`prepare`, each owner durably installs a non-destructive pending fence and Jobs
creates a paused purge registration. The correlated
`LifecycleMutationAcknowledgementV1` carries the owner, mutation kind,
generation, phase, `fence_installed`, `purge_registration_id`, and registration
state. `purge_registration_id` is a canonical lowercase UUID v7 at this
boundary and is stored as PostgreSQL `uuid` in Jobs state. API commits the
active registry generation only after all required `phase=prepared`
acknowledgements match; only then may the `activate` phase enable purge,
anonymization, raw retirement, or other irreversible work. API returns
`accepted_pending` while either phase is incomplete and reports success only
after all required active acknowledgements match. Stale, conflicting, or
incomplete acknowledgements fail closed, and no destructive work may run from a
pending registration.

The authorization-revocation fence is a versioned unary Protobuf-over-HTTP call
under `/internal/v1` from API to Query. API sends the affected actor, project or
export scope, the monotonic authorization revision, correlation identifier, and
idempotency key before acknowledging the revocation. Query durably persists the
highest fence and acknowledges it; gateway issuance and every download request
must reject URLs at or below that fence even when the asynchronous security
projection is still within its normal freshness boundary.

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

An authorized payload reference is an owner-issued capability for one scoped
handoff, not a storage credential or a permission to read another component's
object store. Its only permitted use is the matching owner-mediated interface.

Credentials and unrestricted customer payloads are prohibited. Delivery is at
least once and consumers are idempotent. There is no global ordering guarantee
unless a downstream domain PRD explicitly declares ordering for an aggregate
partition.

Before a component begins a break-glass, restoration, or other required audited
side effect, it durably commits an `AuditIntentV1` record in its own transactional
outbox. The intent has a canonical lowercase UUID v7 `audit_intent_id`, producer,
action, target resource, actor or workload identity, tenant and project context
when applicable, correlation identifier, and idempotency key. The side effect
cannot begin until that intent is durable. The component then publishes
at-least-once `AuditEvidenceV1` that references the intent and records the
eventual outcome; crash recovery must retry the evidence or record an explicit
unknown outcome from the durable intent before considering the action complete.
Neither intent nor evidence contains raw payloads or secrets. A component may
retain and retry its local outbox while API is unavailable; API remains the sole
audit writer and correlates the intent with its immutable audit event. Component
logs and Jobs execution history are not audit records.

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

Detailed roles, WorkOS behavior, credential lifecycle, PII handling, abuse
controls, and compliance gates remain owned by issues #15 and #18. Canonical
storage lifecycle, retention, deletion, restoration, and replay mechanics
remain owned by #14.

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
   handoff records, the authenticated `RawPayloadFetchV1` path when a bounded
   payload is insufficient, Processor, its `RawHandoffDispositionV1` completion
   path back to Ingest, Query projection, and visible query results.
2. Stop Processor delivery before and after Ingest acknowledgement; accepted
   data remains recoverable until a matching terminal disposition is durably
   recorded, including `policy_rejected` and `default_expired`, and admission
   stops at the documented capacity boundary.
3. Follow a native control command from Web to API through defense-in-depth
   authorization, authoritative persistence, and change publication.
4. Follow a Sentry management read through API compatibility translation and
   unary Protobuf HTTP to Query without direct Query persistence access.
5. Perform a native or compatible query during API outage with a valid
   security projection, then cross its freshness boundary and fail closed.
6. Redeliver a retention or deletion request and verify prepare acknowledgements
   install only non-destructive pending fences and paused Jobs registrations,
   activation commits the barrier before purge or anonymization, and an
   unavailable owner leaves a durable `accepted_pending` mutation; verify
   canonical lowercase UUID v7 purge-registration IDs and baseline default-
   lifecycle schedules, while the data owner performs one idempotent effect
   without Jobs writing its store. When Query is unavailable, the barriered API
   mutation fails closed while unrelated API-owned mutations retain normal
   failure isolation.
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
13. Create an export while Processor is publishing, verify the correlated
    API-to-Processor watermark request/response, API-to-Jobs scheduling,
    Jobs-to-Query `ExportExecutionV1` dispatch, and an export snapshot hold that
    preserves inputs through completion or fails without an artifact when a
    watermark cannot be materialized.
14. Race export cancellation and terminal completion or failure, then verify
    revision fencing prevents a stale outcome from changing API state or
    making an invalid artifact issuable, partial failed or canceled objects are
    removed at terminal transition, and Jobs advances a completed export to
    `expired` through the authoritative API handoff at `completed_at + 7 days`.
15. Perform a required component break-glass or backup action while API is
    unavailable, verify the durable audit intent was committed before the
    action, retry its correlated versioned audit evidence after a crash, and
    verify API alone appends the resulting audit event without direct storage
    writes.
16. Revoke export authorization after URL issuance and verify the synchronous
    revision fence blocks the next issuance and download despite stale
    asynchronous projection state; when Query is unavailable, API fails closed
    rather than acknowledging the revocation.
17. Restore Ingest, Processor, Query, and Jobs independently and verify each
    obtains and persists current retention-policy and deletion-tombstone
    snapshots before readiness.

## Deferred Decisions and Non-Goals

This contract does not select exact databases, analytical stores, object
stores, durable-log products, deployment platforms, or numeric SLO targets. It
does not define endpoint catalogs, Sentry compatibility versions, canonical
telemetry fields, authorization roles, PII policy, query semantics, UI states,
alert behavior, or job retry numbers owned by downstream PRDs.

It does not create server, application, Protobuf, storage, queue, or
deployment scaffolds, and it does not implement public routes, internal RPCs,
adapters, projections, processing, jobs, or UI.
