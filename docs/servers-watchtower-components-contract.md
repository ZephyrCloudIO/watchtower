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
| API | Control-plane state, artifact authority, versioned change events describing those authoritative changes, the append-only contract-level audit event boundary, and restore-independent audit journal and export-hold/expiry registry state. |
| Processor | Canonical telemetry, processing state, and derived domain aggregates. |
| Query | Query-owned read projections, search and analytical indexes, PostgreSQL export metadata including `snapshot_generation`, caches, and provider query orchestration state. |
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
   messages or Jobs' `RawRetentionExpiryV1` commands before retiring the
   corresponding raw state. Processor retrieves referenced raw bytes only
   through Ingest's authenticated `RawPayloadFetchV1` interface, and Ingest's
   durable expiry fence rejects late fetches or dispositions. Ingest also
   publishes the durable `RawHandoffExpiryFenceV1` to Processor when it
   records an expiry fence.
3. API accepts control-plane, release, artifact, and Sentry management
   commands. It publishes versioned change events. API may call Query's
   authenticated internal interfaces for Sentry management reads and authorized
   export download-gateway issuance and `AuthorizationRevocationFenceV1` for
   immediate revocation across affected Query admissions, reads, caches, and
   downloads, and Processor's authenticated
   `ExportSnapshotHoldInstallV1` interface at export creation. For a canceled
   export, including one invalidated by ordinary source expiry or retention
   activation, API also sends the
   revision-fenced `ExportCancellationV1` handoff to Jobs before releasing the
   snapshot hold. If retention activation fences an unexpired completed export,
   API advances it to `expired` and waits for Query's artifact invalidation
   acknowledgement before activating the policy, but never reads another
   component's persistence directly.
4. Processor consumes Ingest handoff work and relevant API changes. It
   publishes canonical and derived changes, installs the export-scoped hold and
   returns the authoritative export watermark vector and earliest held-source
   expiry for API's versioned
   `ExportSnapshotHoldInstallV1` request, accepts Query's authorized
   `ProjectionRebuildV1` requests, emits a matching per-partition
   `ProjectionRebuildBaselineV1` marker before the first retained sequence of
   each rebuild stream, and emits contiguous change or authenticated skip
   coverage for every subsequent sequence in that stream. It publishes a terminal
   `RawHandoffDispositionV1` to Ingest for every completed,
   shortened-policy-rejected, or default-expired raw handoff when it remains
   authoritative. It suppresses late processing for an Ingest expiry fence,
   persists the highest `RawHandoffExpiryFenceV1` for each handoff, and performs
   the authoritative cutoff and local-fence check immediately before canonical
   commit and publication. Canonical changes use the Processor-owned
   `(tenant_id, project_id, signal_family)` partition and monotonic sequence
   defined by the canonical storage contract.
5. Query consumes API changes and Processor changes into its own projections,
   indexes, PostgreSQL export metadata, and caches. It enforces installed
   authorization-revocation fences on every affected native and compatible
   admission, read, provider/index, and cache path until the matching security
   projection revision is installed. It consumes Jobs-dispatched revision-fenced
   `ExportExecutionV1` commands carrying API-persisted Processor watermark
   vectors and Jobs-dispatched `ExportExecutionCancellationV1` terminal fences,
   publishes versioned export outcomes for API to record customer-visible
   lifecycle transitions, submits authorized `ProjectionRebuildV1` requests to
   Processor, and does not call another component for persistence fallback.
6. Jobs receives durable requests, owns scheduling and retry state, and
   dispatches versioned commands to the component owning the affected data.
   Jobs owns baseline lifecycle-purge schedules even when no shortened policy is
   active. It also owns export source-expiry scheduling, cancellation, lease
   fencing, and retry fencing:
   an idempotent `ExportCancellationV1` from API durably records the terminal
   export revision, cancels queued, leased, retry, and in-flight work, and
   dispatches `ExportExecutionCancellationV1` to Query before acknowledging the
   cancellation to API. During retention activation, Jobs keeps the mutation
   pending until affected export cancellation fences and hold-release
   acknowledgements and completed-artifact invalidation acknowledgements
   complete. During the API `project_create` barrier, each
   applicable data owner sends an idempotent baseline
   `LifecyclePurgeRegistrationV1` request for the default-policy generation,
   so Jobs has a versioned registration for every baseline schedule before API
   exposes the project.
   During a lifecycle prepare phase, Ingest, Processor, and Query send a
   versioned `LifecyclePurgeRegistrationV1` request to Jobs for the affected
   policy or project-deletion purge work. Jobs durably creates the paused
   registration and returns its `purge_registration_id` and paused state; the
   owner persists that result with its pending fence before returning a matching
   `phase=prepared` `LifecycleMutationAcknowledgementV1`. Jobs records its own
   scheduling registration in the same transaction. After API commits
   activation, each owner sends the matching registration ID back to Jobs for
   activation; Jobs returns the enabled state before the owner acknowledges
   `phase=active`. Owners use the matching registration ID for activation or
   idempotent cleanup. Each of Ingest, Processor, Query, and Jobs obtains the current
   retention-policy and deletion-tombstone snapshots through an authenticated
   `ControlRegistrySnapshotV1` request to API before readiness or after
   restoration. Processor and Query also obtain their owner-scoped export-hold
   and terminal-fence snapshot through that request. Each owner persists the
   snapshot before readiness, performs the idempotent side effect, and publishes
   the outcome. Processor and Query remain unready until their local hold/fence
   inventory matches the API registry generation and digest; Query installs a
   terminal execution fence before releasing a projection hold.
7. Ingest, Processor, Query, and Jobs submit required evidence for break-glass,
   restoration, key, replication, backup, and restore actions to API through a
   versioned durable audit-evidence message. API validates the producer,
   context, correlation, and idempotency data and is the only component that
   appends the contract-level audit event; components do not write API audit
   storage directly. API appends each acknowledged audit event to its
   restore-independent immutable S3 audit journal before acknowledging the
   PostgreSQL audit commit. After an API PostgreSQL restore, API replays journal
   entries missing from the restored boundary before accepting traffic. A restore or replacement of a component's own database
   requires a durable audit intent before the target store is replaced. For an
   API PostgreSQL restore or replacement, the intent is written first to the
   restore-independent API audit-intent prefix and survives any API database
   backup rollback; API records the resulting evidence in its audit boundary
   after recovery.

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
Processor disposition or its own class-default expiry fence from
`RawRetentionExpiryV1`.

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

The export snapshot-hold installation is a versioned unary
`ExportSnapshotHoldInstallV1` Protobuf-over-HTTP call under `/internal/v1` from
API to Processor. API sends the canonical lowercase UUID v7 `export_id` (stored
as PostgreSQL `uuid` in API state) and `export_revision`, authorized tenant and
project scope, `accepted_at` range, selected signals, derived-selection flag,
correlation identifier, and idempotency key. Processor atomically captures the
complete authoritative watermark vector, computes the earliest effective expiry
among all held canonical rows, selection entries, and derived contributions,
and installs the export-scoped hold before returning a correlated versioned
response. API persists the response and includes the exact vectors and
source-expiry deadline only in the durable scheduling request sent to Jobs;
Jobs owns the lease, retry, source-expiry, and cancellation state and dispatches
a
revision-fenced `ExportExecutionV1` command to Query carrying those vectors, the
authorized scope, range, selected signals, and `export_revision`. Query treats
that command as its explicit hold-install handoff, durably installing the
matching projection hold before reading or writing an artifact. Query never
receives a direct API execution dispatch or infers an authoritative watermark
from its local projection. Query fails the export without an artifact if its
hold or any requested vector member cannot be materialized.

Jobs schedules the source-expiry deadline from the hold-install response using
`ExportExpiryScheduleV1` with `expiry_basis=source_retention`. At that deadline,
`ExportExpiryV1` is delivered to API; API advances a still-non-terminal export
to a revision-fenced cancellation with `cancellation_reason=source_expiry`,
then uses the existing `ExportCancellationV1` and
`ExportExecutionCancellationV1` fences before releasing the held revision. A
stale source-expiry delivery cannot cancel a newer revision or retain a source
past its effective cutoff.

When API records a canceled export, including one caused by ordinary source
expiry, it sends an idempotent, revision-fenced
`ExportCancellationV1` command to Jobs containing `export_id`, the held export
revision, the terminal export revision, terminal outcome, authorized scope,
cancellation reason, correlation, and idempotency context. Jobs durably records the terminal fence,
cancels queued, leased, retry, and in-flight execution state, and sends Query a
revision-fenced `ExportExecutionCancellationV1` command containing the same
export and terminal revision. Query durably records the terminal execution
fence before acknowledging it and rejects any `ExportExecutionV1` command for
that terminal export whose revision is stale or whose delivery occurs after
the terminal fence. API does not release the held revision until Jobs and Query
have acknowledged the cancellation fence.

After API records any terminal `completed`, `failed`, or `canceled` export
transition, it publishes an idempotent versioned
`ExportSnapshotHoldReleaseV1` command to Processor and Query. The command
contains `held_export_revision` for the hold being released, the current
terminal `export_revision`, terminal outcome, correlation, and idempotency
context. Each owner durably releases the hold keyed by
`held_export_revision` before acknowledging the command; retries are safe, and
a stale release cannot remove a hold for a newer revision. API retains and
retries undelivered release commands until both owners confirm them, so
cancellation or owner failure cannot strand an inferred hold indefinitely.
Query installs the terminal execution fence before releasing its projection
hold, so a delayed execution command cannot recreate a hold or artifact after
the terminal transition.

API records an export-hold intent before installing a Processor or Query hold
in its restore-independent encrypted S3 export-hold registry. Before API
persists any terminal export transition or dispatches its cleanup command, it
also appends the matching cancellation or release intent to that registry;
the intent precedes `ExportCancellationV1` or
`ExportSnapshotHoldReleaseV1` dispatch. Before API commits a successful
`completed` transition, it also appends a completion/expiry intent containing
the authoritative `completed_at`, export revision, effective export-object
expiry deadline, and desired `ExportExpiryScheduleV1` handoff. Processor and
Query provide an authenticated versioned `ExportHoldInventoryV1` reconciliation
response containing each held `export_id`, held revision, and registry digest;
they do not expose their storage. API loads its registry before accepting
traffic after an API database restore, reconciles both inventories, and retries
the matching hold install, cancellation, release, or expiry-schedule command for
every unresolved intent. A hold or expiry schedule is not orphaned merely
because it is absent from the restored API PostgreSQL backup. Terminal export
tombstones remain in the restore-independent registry through the restore
horizon for backups that may contain non-terminal state. Before traffic is
accepted, API applies each tombstone to the restored export state, preventing
status regression or redispatch at a lower revision.
When Processor or Query restores its own store, it instead receives the
owner-scoped desired holds and unresolved terminal fences in
`ControlRegistrySnapshotV1`, persists that snapshot before readiness, and
reconciles missing or stale local state against it. This owner-store recovery
does not depend on an API database restore.

When API records a successful `completed` transition, it sends Jobs an
idempotent versioned `ExportExpiryScheduleV1` request with
`expiry_basis=export_object` containing `export_id`, the current
`export_revision`, authoritative `completed_at`, and the effective
export-object expiry deadline. The deadline is the earlier of
`completed_at + 7 days` and the active export-object policy cutoff, using
`completed_at` as the export-object lifecycle anchor. Jobs persists that
timestamp and schedules an idempotent `ExportExpiryV1` handoff for exactly that
deadline, then sends it to API. API alone advances a still-completed export to
`expired` and publishes the invalidation to Query at the scheduled deadline or
before shortened-retention activation when the selected source or export-object
cutoff makes it ineligible; Query invalidates the artifact and rejects expired
downloads even if the object is already inaccessible. A shortened policy
reschedules every still-downloadable completed artifact whose effective
export-object deadline moves earlier, and expires and invalidates any artifact
whose new deadline has already passed.

The projection-rebuild handoff is a versioned unary Protobuf-over-HTTP call
under `/internal/v1` from Query to Processor. Query sends a canonical lowercase
UUID v7 `rebuild_id`, authorized tenant and project scope, `accepted_at` range,
selected signals, derived-selection flag, correlation identifier, and
idempotency key. Processor validates the authorization, retention, and deletion
fences, durably records the request and its idempotency state with `rebuild_id`
stored as PostgreSQL `uuid` before acknowledging it. Before republishing
eligible versioned canonical or derived changes through its normal change path,
Processor emits a matching `ProjectionRebuildBaselineV1` marker for each
requested canonical partition. The marker establishes the first retained
sequence (or an explicit empty partition) and is accepted only for its matching
rebuild and active fences. For every sequence after the baseline through the
requested rebuild target, Processor emits either the canonical change or a
versioned authenticated `ProjectionRebuildSkipV1` record covering a contiguous
range excluded by the requested range or retention state. Each skip record is
bound to the rebuild, partition, active fences, exclusion basis, and integrity
digest. A rebuild that initializes or advances a partition's global checkpoint
must cover the entire currently eligible retained window; a narrower subrange
request is rejected for checkpoint recovery and leaves the checkpoint
unchanged. An unexpired row omitted by a narrower request is not a valid skip.
Query verifies complete contiguous coverage, advances its checkpoint over
changes and retention-excluded skip ranges, and writes every eligible row in
the covered window; missing, stale, conflicting, or unauthorized coverage
fails the rebuild safely.
The correlated response reports durable acceptance or a terminal safe error;
Query never accesses Processor persistence directly.

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

The class-default raw-expiry path is a versioned `RawRetentionExpiryV1`
command from Jobs to Ingest. It carries the authorized tenant and project
scope, raw data class, effective class cutoff, `expiry_basis=class_default`,
correlation identifier, and idempotency key; it is a project-scoped sweep and
does not require Jobs to know individual `watchtower_id` values. Ingest
enumerates its own acceptance state, durably records a terminal
`default_expired` fence for each eligible handoff, and retires each matching
raw object, acceptance metadata, and outbox entry without waiting for
Processor. A later `RawPayloadFetchV1` request or `RawHandoffDispositionV1`
delivery for a fenced handoff is rejected as stale and cannot publish or revive
canonical work.

When Ingest records a class-default or shortened-policy expiry fence, it also
publishes a versioned durable `RawHandoffExpiryFenceV1` message to Processor.
The message carries the scoped `watchtower_id`, accepted-at cutoff, policy or
class-default basis, fence generation, correlation identifier, and idempotency
key. Processor persists the highest fence and must perform a final authoritative
cutoff and local-fence check immediately before canonical or derived commit and
publication; a denied check records the matching terminal disposition without
publishing canonical changes.

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
requests the current retention-policy and deletion-tombstone snapshots plus the
active-project baseline lifecycle-registration inventory with its authenticated
owner identity, correlation, and idempotency context. The inventory covers every
active project and applicable data class, including default-policy projects that
have no shortened-retention policy row. API returns the versioned snapshots,
inventory, and their highest generations; the requesting owner persists them
before readiness and fails closed if the snapshot cannot be installed.
Subsequent policy and deletion mutations use the same generation-aware durable
handoffs, while this request repairs state after restoration or rebuild.

Retention-policy and project-deletion barriers use a versioned unary
`LifecycleMutationV1` Protobuf-over-HTTP request from API to each of Ingest,
Processor, Query, and Jobs under `/internal/v1`. The request carries the
mutation kind, `phase` (`prepare` or `activate`), authorized scope, monotonic
mutation generation, the complete immutable proposed retention policy when the
mutation is a retention change, the policy's per-class proposed cutoffs,
policy digest, correlation identifier, and idempotency key. During `prepare`,
each data owner durably installs a non-destructive pending fence from that
policy and sends Jobs a versioned unary `LifecyclePurgeRegistrationV1` request under
`/internal/v1` containing the owner, mutation kind, authorized scope,
generation, `registration_phase=prepare`, affected data classes, correlation
identifier, and idempotency key.
For project creation, API uses the same request with
`mutation_kind=project_create` and the project-creation generation. Each
applicable owner prepares its project fence and baseline registration, then
activates that registration through Jobs. API exposes the project only after
all applicable owners return generation-matched active
`LifecycleMutationAcknowledgementV1` responses; Jobs returns its
`purge_registration_id` before the owner acknowledges the active creation
barrier.
During prepare, Jobs durably persists the registration in `paused` state and returns its
`purge_registration_id`; the owner persists that ID and the paused confirmation
before acknowledging the lifecycle prepare. Jobs handles its own local
registration in the same durable operation. After API commits the active
generation, each owner sends the same registration ID with
`registration_phase=activate`; Jobs transitions the registration to `active`,
enables the schedule, and returns that state before the owner acknowledges
`phase=active`. The correlated
`LifecycleMutationAcknowledgementV1` carries the owner, mutation kind,
generation, phase, `fence_installed`, `purge_registration_id`, registration
state, and the acknowledged policy digest when applicable.
`purge_registration_id` is a canonical lowercase UUID v7 at this boundary and
is stored as PostgreSQL `uuid` in Jobs state. API commits the
active registry generation only after all required `phase=prepared`
acknowledgements match; only then may the activation handshake enable purge,
anonymization, raw retirement, or other irreversible work. API returns
`accepted_pending` while either phase is incomplete and reports success only
after all required active acknowledgements match. Stale, conflicting, or
incomplete acknowledgements fail closed, and no purge or anonymization caused
by the pending mutation may run from a pending registration. Previously active
baseline and retention-policy schedules continue to enforce their own effective
cutoffs during a stalled prepare.

The authorization-revocation fence is a versioned unary Protobuf-over-HTTP call
under `/internal/v1` from API to Query. API sends the affected actor, project or
export scope, the monotonic authorization revision, correlation identifier, and
idempotency key before acknowledging the revocation. Query durably persists the
highest fence and acknowledges it; every affected native and compatible Query
admission, read, provider/index, cache lookup, cache use, gateway issuance, and
download request must reject authorization at or below that fence until the
matching security projection revision is installed, even when the asynchronous
security projection is still within its normal freshness boundary.

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
partition. The canonical telemetry contract additionally defines ordering for
each Processor-owned `(tenant_id, project_id, signal_family)` canonical-change
partition: its unsigned 64-bit `canonical_change_sequence` is allocated by
Processor, persisted with the durable outbox and replay metadata, published in
the canonical change, and applied contiguously by Query. Partition sequences
are never compared as one global order.

Before a component begins a break-glass or other audited side effect, it
durably commits an `AuditIntentV1` record in its own transactional outbox. The
intent has a canonical lowercase UUID v7 `audit_intent_id`, stored as PostgreSQL
`uuid` wherever it is held in repository-owned relational outbox or state, plus
producer, action, target resource, actor or workload identity, tenant and
project context when applicable, correlation identifier, and idempotency key.
For a restoration or replacement of non-API component PostgreSQL state, the
intent is durably recorded in API's audit boundary and API acknowledges it
before the target store is replaced. API PostgreSQL restoration is the
exception: its `AuditIntentV1` record is durably written to the
restore-independent API audit-intent prefix before the target store is
replaced, and API records the eventual `AuditEvidenceV1` outcome after
recovery. Other components publish at-least-once `AuditEvidenceV1` that
references the intent and records the eventual outcome; crash recovery retries
the evidence or records an explicit unknown outcome before considering the
action complete.
Neither intent nor evidence contains raw payloads or secrets. A component may
retain and retry its local outbox while API is unavailable; API remains the sole
audit writer and correlates the intent with its immutable audit event. API also
records each audit event in the restore-independent immutable audit journal
before acknowledging the PostgreSQL audit commit. After restoring API
PostgreSQL, API replays journal entries missing from the restored audit
boundary before accepting traffic. Component logs and Jobs execution history
are not audit records.

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
   data remains recoverable until a matching terminal disposition or the
   Ingest-authoritative project-scoped `RawRetentionExpiryV1` sweep durably
   records `default_expired` fences for Ingest-enumerated state, including
   `policy_rejected` and `default_expired`, and late Processor fetches or
   dispositions are rejected; admission stops at the documented capacity
   boundary.
3. Follow a native control command from Web to API through defense-in-depth
   authorization, authoritative persistence, and change publication.
4. Follow a Sentry management read through API compatibility translation and
   unary Protobuf HTTP to Query without direct Query persistence access.
5. Perform a native or compatible query during API outage with a valid
   security projection, then cross its freshness boundary and fail closed.
6. Create a project through the generation-matched `project_create`
   `LifecycleMutationV1` barrier and verify the project remains unavailable
   until each applicable owner registers an active baseline schedule with Jobs
   and returns an active acknowledgement. Redeliver a retention or deletion
   request and verify each data owner uses `LifecyclePurgeRegistrationV1` to
   obtain a durable paused Jobs registration before acknowledging prepare, sends
   the matching registration ID for activation, and receives the enabled state
   before acknowledging active. Activation commits the barrier before purge or
   anonymization, and an unavailable owner leaves a durable `accepted_pending`
   mutation; verify canonical lowercase UUID v7 purge-registration IDs and
   baseline default-lifecycle schedules, while previously active baseline and
   retention-policy schedules continue during a stalled deletion prepare and
   the data owner performs one idempotent effect without Jobs writing its store.
   When Query is unavailable, the barriered API mutation fails closed while
   unrelated API-owned mutations retain normal failure isolation.
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
    API-to-Processor `ExportSnapshotHoldInstallV1` request/response, complete
    watermark vectors, API-to-Jobs scheduling, Jobs-to-Query
    `ExportExecutionV1` hold installation, and an export snapshot hold that
    preserves inputs through completion or fails without an artifact when any
    vector member cannot be materialized; verify terminal
    `ExportSnapshotHoldReleaseV1` delivery for completion, failure, and
    cancellation, including the revision-fenced API-to-Jobs
    `ExportCancellationV1` and Jobs-to-Query `ExportExecutionCancellationV1`
    fences before cancellation releases the originally held revision after API
    advances the terminal revision; verify that a rebuild whose first retained
    canonical sequence is greater than one installs the matching
    `ProjectionRebuildBaselineV1` marker before applying changes, emits
    contiguous `ProjectionRebuildSkipV1` coverage only for retention-excluded
    sequences, writes every eligible row before advancing the global checkpoint,
    leaves that checkpoint unchanged for an incomplete subrange request, and
    fails safely when coverage is missing or mismatched.
14. Race export cancellation and terminal completion or failure, then verify
    Jobs cancels and fences queued, leased, retry, and in-flight execution,
    Query rejects delayed post-terminal `ExportExecutionV1` commands, and
    revision fencing prevents a stale outcome from changing API state or making
    an invalid artifact issuable; partial failed or canceled objects are
    removed at terminal transition, API records the authoritative `completed_at`
    and desired expiry schedule in the restore-independent hold registry before
    committing completion, and Jobs advances a completed export to `expired`
    through the `ExportExpiryScheduleV1` handoff with an explicit expiry basis
    at the earlier of the
    seven-day default and export-object policy cutoff. A restored API replays an
    unresolved schedule. An export whose held source reaches its ordinary
    effective cutoff before completion is revision-fenced-canceled and its
    hold is released only after the Jobs and Query fences are acknowledged.
    Shortened-retention activation expires and invalidates an otherwise
    downloadable completed artifact whose selected source crosses the new
    cutoff before the mutation becomes active, reschedules existing artifacts
    whose export-object cutoff moves earlier, and invalidates artifacts whose
    new cutoff has passed; the restore-independent hold registry records
    cancellation and release intents before dispatch and replays unresolved
    intents after API restore.
15. Perform a required component break-glass or backup action while API is
    unavailable, verify the durable audit intent was committed before the
    action with its relational `uuid` type, and for an API PostgreSQL restore
    verify the intent is durable in the restore-independent API audit-intent
    prefix before replacement; retry correlated versioned audit evidence after
    a crash and verify API alone appends the resulting audit event without
    direct storage writes.
16. Revoke authorization after a native or compatible Query read, cache entry,
    or export URL exists and verify the synchronous revision fence blocks every
    affected admission, read, cache lookup/use, issuance, and download despite
    stale asynchronous projection state; when Query is unavailable, API fails
    closed rather than acknowledging the revocation.
17. Restore Ingest, Processor, Query, and Jobs independently and verify each
    obtains and persists current retention-policy, deletion-tombstone, and
    active-project baseline-registration snapshots before readiness; restore
    Processor and Query from backups predating an active export hold or
    completed, failed, canceled, or expired terminal execution fence and verify
    their owner-scoped hold/fence snapshot
    reconciliation completes before readiness, with Query installing the
    terminal fence before releasing its projection hold; when Jobs' backup
    predates an ordinary default-policy project creation, verify it recreates
    the missing baseline registration idempotently from the inventory before
    enabling schedules. When replacing a component store, verify the applicable
    audit intent survives a backup that predates the replaced store, including
    the API audit-intent prefix for an API PostgreSQL restore.

## Deferred Decisions and Non-Goals

This contract does not select exact databases, analytical stores, object
stores, durable-log products, deployment platforms, or numeric SLO targets. It
does not define endpoint catalogs, Sentry compatibility versions, canonical
telemetry fields, authorization roles, PII policy, query semantics, UI states,
alert behavior, or job retry numbers owned by downstream PRDs.

It does not create server, application, Protobuf, storage, queue, or
deployment scaffolds, and it does not implement public routes, internal RPCs,
adapters, projections, processing, jobs, or UI.
