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
| API | Control-plane state, artifact authority, versioned change events describing those authoritative changes, the append-only contract-level audit event boundary, and restore-independent audit, export-hold/expiry, authorization-revocation, and active-project lifecycle registry state. |
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
   corresponding raw state. A `RawRetentionExpiryV1` command may carry either
   the class-default or an active shortened-policy basis; Ingest's matching
   durable fence is terminal for that handoff. Processor retrieves referenced
   raw bytes only through Ingest's authenticated `RawPayloadFetchV1` interface,
   and Ingest's
   durable expiry fence rejects late fetches or dispositions. Ingest also
   publishes the durable `RawHandoffExpiryFenceV1` to Processor when it
   records an expiry fence.
3. API accepts control-plane, release, artifact, and Sentry management
   commands. It publishes versioned change events. API may call Query's
   authenticated internal interfaces for Sentry management reads and authorized
   export download-gateway issuance and `AuthorizationRevocationFenceV1` for
   immediate revocation across affected Query admissions, reads, caches, and
   downloads, and Processor's authenticated
   `ExportSnapshotHoldInstallV1` interface at export creation. API also receives
   Query's authenticated `ExportRecoveryInvalidationV1` result when restored
   completed-export materialization cannot be verified. For a canceled
   export, including one invalidated by ordinary source expiry or retention
   activation, API also sends the
   revision-fenced `ExportCancellationV1` handoff to Jobs before releasing the
   snapshot hold. If retention preparation fences an unexpired completed export,
   API keeps the export transition and artifact reversible until the active
   generation is committed; it then advances the export to `expired` and waits
   for Query's artifact invalidation acknowledgement in the post-commit phase,
   but never reads another component's persistence directly.
4. Processor consumes Ingest handoff work and relevant API changes. It
   publishes canonical and derived changes, installs the export-scoped hold and
   returns the authoritative canonical partition-sequence vector, immutable
   selection-snapshot descriptor, derived revision snapshot descriptor, and
   earliest held-source
   expiry for API's versioned
   `ExportSnapshotHoldInstallV1` request, accepts Query's authorized
   `ProjectionRebuildV1` requests, captures a fixed available,
   published-contiguous target watermark for each requested partition and, when
   derived data is selected, an immutable bounded derived key/revision target
   descriptor plus a monotonically ordered durable `derived_change_sequence`
   target at request acceptance. It emits a matching
   `ProjectionRebuildBaselineV1` marker before the first retained sequence or
   at that watermark for an empty rebuild, and emits contiguous change or
   authenticated skip coverage through each fixed target. Processor retains
   every selected-scope derived change after the descriptor target, including a
   newly created aggregate, in a rebuild-scoped durable buffer or replay stream.
   It seals that buffer with an authenticated
   `ProjectionRebuildDerivedCutoverV1` marker carrying a later derived cursor;
   Query applies the descriptor and every buffered change through that cursor
   before recording the derived cutover and declaring the rebuild complete.
   Changes after the cutover remain on the normal live-change path. A
   retention-expired
   staged live write uses an idempotent no-row `CanonicalChangeSkipV1` marker
   for its reserved sequence only when no authoritative ClickHouse row exists;
   if the row was committed while still within its cutoff and publication then
   failed, Processor reconciles and publishes the row; if the cutoff arrives
   after commit but before publication, recovery removes the row, verifies its
   absence, and publishes the skip. Live consumers therefore receive
   contiguous coverage, and Processor persists each live skip marker in the
   retained canonical replay class so it remains available through the replay
   horizon.
   It publishes a
   terminal
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
   vectors, bounded snapshot descriptors, and an optional source-expiry
   deadline, and Jobs-dispatched `ExportExecutionSourceExpiryFenceV1` and
   `ExportExecutionCancellationV1` terminal fences,
   publishes versioned export outcomes for API to record customer-visible
   lifecycle transitions, submits authorized `ProjectionRebuildV1` requests to
   Processor, sends `ExportRecoveryInvalidationV1` to API when restored completed
   materialization is missing or conflicting, and does not call another component
   for persistence fallback.
6. Jobs receives durable requests, owns scheduling and retry state, and
   dispatches versioned commands to the component owning the affected data.
   Jobs owns baseline lifecycle-purge schedules even when no shortened policy is
   active. It also owns export completion terminalization, source-expiry
   scheduling, cancellation, lease fencing, and retry fencing:
   an idempotent `ExportCompletionV1` from API durably terminalizes the
   corresponding execution before API exposes the successful completion or
   schedules artifact expiry. It fences queued, leased, retry, and in-flight
   work; retries are safe and cannot redispatch a completed revision. An
   `ExportExecutionV1` command carries the present source-expiry deadline and
   basis when one exists. At that deadline, Jobs also dispatches an idempotent
   `ExportExecutionSourceExpiryFenceV1` directly to Query, so owner-side
   fencing does not wait for API recovery; Query retries or applies the same
   deadline before readiness after its own outage.
   idempotent `ExportCancellationV1` from API durably records the terminal
   export revision, cancels queued, leased, retry, and in-flight work, and
   dispatches `ExportExecutionCancellationV1` to Query before acknowledging the
   cancellation to API. An idempotent `ExportFailureV1` from API durably
   terminalizes the corresponding execution, fences queued, leased, retry, and
   in-flight work, and is acknowledged before API releases the held revision.
   During retention preparation, generation-matched
   export fences are reversible and Jobs performs no terminal cancellation,
   hold release, or artifact invalidation until API commits the active
   generation. The post-commit cancellation fences, hold releases, and
   completed-artifact invalidations must complete before the lifecycle operation
   is reported complete. During the API `project_create` barrier, each
   applicable data owner sends an idempotent baseline
   `LifecyclePurgeRegistrationV1` request for the default-policy generation,
   so Jobs has a versioned registration for every baseline schedule before API
   exposes the project.
   During a lifecycle prepare phase, API's local lifecycle participant, Ingest,
   Processor, and Query send a
   versioned `LifecyclePurgeRegistrationV1` request to Jobs for the affected
   policy or project-deletion purge work. Jobs durably creates the paused
   registration and returns its `purge_registration_id` and paused state; the
   owner persists that result with its pending fence before returning a matching
   `phase=prepared` `LifecycleMutationAcknowledgementV1`. Jobs records its own
   scheduling registration in the same transaction. While the generation is
   non-active, each owner, including API's local participant, sends the matching
   registration ID back to Jobs for
   activation; Jobs returns an armed, non-dispatchable state before the owner
   acknowledges `phase=active`. API commits activation only after every required
   armed acknowledgement. API then emits a durable post-commit enable signal;
   owners resend the matching registration with `registration_phase=enable`,
   and Jobs verifies the committed generation before enabling dispatch. Each of
   Ingest, Processor, Query, and Jobs obtains the current retention-policy,
   deletion-tombstone, and applicable authorization-revocation snapshots through
   an authenticated `ControlRegistrySnapshotV1` request to API before readiness
   or after restoration. The response is an immutable owner-scoped snapshot
   descriptor containing the snapshot identity, registry generation and digest,
   bounded page parameters, entry/page counts, and final digest; it does not
   inline the deployment-wide entries. Each owner retrieves bounded ordered
   authenticated versioned `ControlRegistrySnapshotPageV1` pages using the
   descriptor and validates the
   owner scope, cursor order, page digests, counts, and final digest before
   persisting the complete snapshot. A new registry generation creates a new
   immutable descriptor; it cannot mutate pages already being restored.
   Processor and Query also obtain their owner-scoped export-hold,
   terminal-fence, and completed-materialization recovery pages through that
   interface, while Jobs obtains its owner-scoped export-schedule, non-terminal
   execution, and terminal-fence pages. Query's pages include every unresolved
   desired authorization-revocation fence as well as resolved tombstones.
   After reconciliation, each owner sends a final
   `ControlRegistryReadinessCommitV1` acknowledgement with the descriptor
   generation and digest. API atomically compares that pair with the current
   registry and records the owner-ready cutover: a concurrent mutation either
   waits behind that cutover or causes the acknowledgement to fail and the owner
   to remain unready until it installs a fresh descriptor. Owners become ready
   only after this acknowledgement. API and Query apply resolved
   authorization-revocation tombstones before readiness, and Query installs all
   unresolved revocation fences before readiness and enforces them on affected
   paths. Query installs a terminal execution fence before releasing a projection
   hold, and Jobs installs every restored terminal fence before re-enabling export
   dispatch or scheduling.
7. Before Ingest, Processor, Query, or Jobs begins a break-glass, restoration,
   key, replication, backup, restore, or other audited side effect, it sends a
   versioned `AuditIntentV1` to API and waits for a durable acknowledgement.
   API validates the producer, context, correlation, and idempotency data,
   appends the intent to its restore-independent immutable S3 audit journal
   before committing the PostgreSQL audit row, and acknowledges only after both
   boundaries are durable. A new audited side effect fails closed while API is
   unavailable; valid ordinary Ingest admission and Query reads retain their
   existing outage behavior. After the acknowledgement, the component may
   retain and retry local `AuditEvidenceV1` delivery, but API remains the sole
   component that appends the contract-level audit event. If a component loses
   its local evidence during recovery, API retains the pre-action intent and
   records an explicit unknown outcome before considering the action complete.
   A restore or replacement of a component's own database therefore requires
   the API acknowledgement before the target store is replaced. For an API
   PostgreSQL restore or replacement, the intent is written first to the
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
Processor disposition or its own expiry fence from `RawRetentionExpiryV1`,
whether the fence basis is class-default or an active shortened policy.

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
complete authoritative canonical partition-sequence vector and creates an
immutable `SelectionSnapshotDescriptorV1` for per-record default-generation
selections plus a `DerivedRevisionSnapshotDescriptorV1` when derived results
are selected. It computes the optional earliest effective expiry among all
held canonical rows, selection entries, and derived contributions, and
installs the export-scoped hold before returning a correlated versioned
response. The selection descriptor contains only bounded metadata: snapshot
identity, request scope, fixed-size page parameters, entry count, page count,
and final selection digest; it never inlines one entry or an unbounded
page-digest list for every record. The derived revision descriptor uses the
same bounded metadata shape and never inlines aggregate entries or an
unbounded page-digest list. Processor freezes each captured derived aggregate's
state, selected source set, and `authoritative_revision`, including explicit
empty revision entries, until the matching export hold is released; updates for
those aggregates are queued and cannot publish a higher revision during the
hold. The source-expiry value is absent
when the requested snapshot has no eligible canonical rows, selection entries,
or derived contributions. API persists the canonical partition-sequence
vector, the selection descriptor and digest, and, when present, the derived
revision descriptor and digest, plus the present source-expiry deadline in the
restore-independent hold registry and the durable scheduling request sent to
Jobs; Jobs owns the
lease, retry, source-expiry, and cancellation state and dispatches a
revision-fenced `ExportExecutionV1` command to Query carrying that bounded
snapshot evidence, the
authorized scope, range, selected signals, and `export_revision`. Query treats
that command as its explicit hold-install handoff, durably installing the
matching projection hold before reading or writing an artifact. Query never
receives a direct API execution dispatch or infers an authoritative watermark
from its local projection. Query fails the export without an artifact if its
hold or any requested vector member cannot be materialized.

Query obtains selection pages through the authenticated versioned unary
`ExportSelectionSnapshotPageV1` Protobuf-over-HTTP interface from Query to
Processor. Each request carries the export ID and revision, descriptor ID, and
bounded page cursor; each response carries a bounded set of
`(partition, watchtower_id, selection_revision, processing_generation)` entries,
the page digest, next cursor, and final digest when complete. Query verifies the
descriptor scope, cursor order, page digests, entry count, and final selection
digest before materializing any canonical row. A missing, repeated, conflicting,
or unauthorized page fails the export without an artifact. Processor remains
the only reader of its selection state, and API and Jobs persist and forward
only the bounded descriptor and its integrity evidence.

Query obtains derived revision pages through the authenticated versioned unary
`ExportDerivedRevisionSnapshotPageV1` Protobuf-over-HTTP interface from Query to
Processor. Each request carries the export ID and revision, derived descriptor
ID, and bounded page cursor; each response carries a bounded set of fully
qualified aggregate keys and `authoritative_revision` values, including
explicit empty revision entries, the page digest, next cursor, and final
descriptor digest when complete. Query verifies descriptor scope, cursor order,
page digests, entry count, and final digest before materializing any derived
row. A missing, repeated, conflicting, or unauthorized page fails the export
without an artifact. API and Jobs persist and forward only the descriptor and
its integrity evidence.

Jobs schedules a present source-expiry deadline from the hold-install response
using `ExportExpiryScheduleV1` with `expiry_basis=source_retention`; no
source-retention schedule is created when the value is absent. The
Jobs-to-Query `ExportExecutionV1` command carries that optional deadline and
basis, and Query durably stores it with the projection hold before
materialization. At the deadline, Jobs delivers an idempotent
`ExportExecutionSourceExpiryFenceV1` directly to Query. Query's persisted
deadline guard applies the same fence even when Jobs or API is unavailable:
it stops execution, removes or invalidates partial artifacts, fences its local
projection hold, and rejects delayed execution commands, outcomes, and
downloads. Query does not advance API lifecycle state or release Processor's
authoritative hold through this owner-side path. When API is available,
`ExportExpiryV1` still reaches API; API advances a still-non-terminal export
to a revision-fenced cancellation with `cancellation_reason=source_expiry`,
then uses the existing `ExportCancellationV1` and
`ExportExecutionCancellationV1` fences before releasing the held revision.
API rejects a successful Query completion outcome received at or after the
persisted source deadline regardless of delivery order, and a stale
source-expiry delivery cannot cancel a newer revision or retain a source past
its effective cutoff.

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

When Query emits a terminal `failed` outcome, API appends the failure intent to
the restore-independent hold registry and sends a revision-fenced
`ExportFailureV1` command to Jobs containing the held and terminal export
revisions, failure reason, authorized scope, correlation, and idempotency
context. Jobs durably fences queued, leased, retry, and in-flight execution
state and acknowledges terminalization before API releases the held revision.
Query's failed terminal fence continues to reject stale or post-terminal
`ExportExecutionV1` commands.

After API records any terminal `completed`, `failed`, or `canceled` export
transition and the required terminalization fences have been acknowledged, it
publishes an idempotent versioned
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

API records an export-hold intent, including the present source-expiry deadline,
before installing a Processor or Query hold in its restore-independent encrypted
S3 export-hold registry. Before API
persists any terminal export transition or dispatches its cleanup command, it
also appends the matching cancellation, failure, or release intent to that
registry; the intent precedes `ExportCancellationV1`, `ExportFailureV1`, or
`ExportSnapshotHoldReleaseV1` dispatch. Before sending `ExportCompletionV1`, API
sets `completed_at` to the canonical UTC timestamp of the durable
completion/expiry intent append and records that value, the export revision,
effective export-object expiry deadline, desired `ExportExpiryScheduleV1`
handoff, and a recovery copy of Query's materialization metadata: manifest
content and digest, artifact object references and digests, complete watermark
vectors, and `snapshot_generation`. The recovery copy remains in the registry
until the associated artifact expires or is durably invalidated and removed;
reconciliation or replay alone does not permit cleanup. The same
`completed_at` is carried in
`ExportCompletionV1`, written to API state only if the final source and
export-object expiry checks succeed, and used for the export-object expiry
schedule. Processor and
Query provide an authenticated versioned
`ExportHoldInventoryV1` reconciliation
response containing each held `export_id`, held revision, and registry digest;
they do not expose their storage. API loads its registry before accepting
traffic after an API database restore, reconciles both inventories, and retries
the matching completion, hold install, cancellation, failure, release, or
expiry-schedule
command for every unresolved intent. For an unresolved completion intent, API
replays the idempotent `ExportCompletionV1` handoff to Jobs and resumes the same
final expiry-and-fence check and commit-or-cleanup sequence; it does not replace
completion with an expiry schedule. A hold or expiry schedule is not orphaned merely
because it is absent from the restored API PostgreSQL backup. Terminal export
tombstones remain in the restore-independent registry through the restore
horizon for backups that may contain non-terminal state. Before traffic is
accepted, API applies each tombstone to the restored export state, preventing
status regression or redispatch at a lower revision.
When Processor or Query restores its own store, it instead receives the
owner-scoped desired holds, every terminal fence that can coexist with a
restorable backup, and completed-export materialization recovery metadata in
the immutable, paginated `ControlRegistrySnapshotV1` descriptor and pages.
When Jobs restores its own store, it receives the owner-scoped export-expiry
schedules and every terminal execution fence that can coexist with a restorable
backup through the same descriptor and pages. Each owner persists the complete
snapshot before readiness and reconciles missing or stale local state against
it; Jobs reinstalls missing schedules idempotently and installs terminal fences
before re-enabling dispatch. The owner then completes the atomic
`ControlRegistryReadinessCommitV1` generation check before readiness. This
owner-store recovery does not depend on an API database restore.

After the completion intent is durable, API sends Jobs an idempotent versioned
`ExportCompletionV1` request containing `export_id`, the held and terminal
`export_revision` values, authorized scope, the intent's `completed_at`,
correlation, and idempotency context. Jobs durably marks the corresponding
execution terminal, fences queued, leased, retry, and in-flight work, and
acknowledges the completion. API then atomically rechecks that the optional
source-expiry deadline and the persisted export-object expiry deadline have not
passed, and that no newer retention, deletion, cancellation, or authorization
fence applies immediately before committing `completed`. A failed check does not
expose the artifact and follows the corresponding revision-fenced expiry
cancellation, artifact cleanup, and hold-release path. Only after the check
succeeds does API commit the
customer-visible transition and send Jobs an idempotent versioned
`ExportExpiryScheduleV1` request with
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

Query recovery uses the authenticated, idempotent versioned unary
`ExportRecoveryInvalidationV1` Protobuf-over-HTTP handoff under `/internal/v1`
from Query to API. It carries the canonical lowercase UUID v7 `export_id`, the
observed completed `export_revision`, authorized tenant and project scope, the
recovery failure classification and observed materialization or registry
generation/digest, correlation identifier, and idempotency context. Query sends
the result before remaining unready for the affected completed export and
retries it while API is unavailable. API validates the matching completed
revision, durably records the recovery invalidation, advances the export to
terminal `expired` through its existing revision-fenced artifact invalidation
and hold-release path, and returns a correlated acknowledgement. Query never
changes API lifecycle state or serves the artifact while this handoff is
pending.

The projection-rebuild handoff is a versioned unary Protobuf-over-HTTP call
under `/internal/v1` from Query to Processor. Query sends a canonical lowercase
UUID v7 `rebuild_id`, authorized tenant and project scope, `accepted_at` range,
selected signals, derived-selection flag, correlation identifier, and
idempotency key. Processor validates the authorization, retention, and deletion
fences, durably records the request and its idempotency state with `rebuild_id`
stored as PostgreSQL `uuid` before acknowledging it. At durable request
acceptance, Processor captures the current available, published-contiguous
watermark as an immutable `target_sequence` for every requested canonical
partition. When derived data is selected, it also captures an immutable bounded
derived key/revision target descriptor of every eligible aggregate key and its
`authoritative_revision` at acceptance, with bounded authenticated pages and a
final descriptor digest, plus a monotonically ordered durable
`derived_change_sequence` target for the selected scope. Processor retains
every derived change after that target, including a newly created aggregate,
in a rebuild-scoped durable buffer or replay stream rather than allowing a
staged projection to omit it. Before republishing eligible versioned
canonical or derived changes through its normal change path, Processor emits a
matching `ProjectionRebuildBaselineV1` marker for each requested canonical
partition.
The marker establishes the first retained sequence (or an explicit empty
partition), carries the fixed target sequence, and is accepted only for its
matching rebuild and active fences. For every sequence after the baseline
through that fixed target, Processor emits either the canonical change or a
versioned authenticated `ProjectionRebuildSkipV1` record covering a contiguous
range excluded by the requested range or retention state. Each skip record is
bound to the rebuild, partition, active fences, exclusion basis, and integrity
digest. A rebuild that initializes or advances a partition's global checkpoint
must cover the entire currently eligible retained window; a narrower subrange
request is rejected for checkpoint recovery and leaves the checkpoint
unchanged. An unexpired row omitted by a narrower request is not a valid skip.
Query verifies complete contiguous canonical coverage and complete
digest-verified coverage of every derived target descriptor page, advances its
checkpoint over changes and retention-excluded skip ranges, and writes every
eligible row in the covered window; missing, stale, conflicting, unauthorized,
or incomplete derived coverage fails the rebuild safely. Query marks the rebuild
complete only after coverage reaches the authenticated target sequence for every
requested partition and every derived descriptor entry is covered. Processor
then seals the rebuild-scoped derived buffer with an authenticated
`ProjectionRebuildDerivedCutoverV1` marker carrying a later
`derived_cutover_sequence` and the descriptor/fence digest. Query validates the
marker, applies every buffered derived change through that cursor, atomically
records the derived cursor and cutover fence, and only then declares the rebuild
complete. Changes published after that cursor remain on the normal live-change
path; missing, repeated, conflicting, stale, or incomplete cutover coverage
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

The raw-expiry path is a versioned `RawRetentionExpiryV1` command from Jobs
to Ingest. It carries the authorized tenant and project scope, raw data class,
effective cutoff, `expiry_basis=class_default` or
`expiry_basis=retention_policy`, the matching policy generation when
applicable, correlation identifier, and idempotency key; it is a project-scoped
sweep and does not require Jobs to know individual `watchtower_id` values.
Ingest enumerates its own acceptance state, durably records a terminal
`default_expired` or `policy_rejected` fence for each eligible handoff, and
retires each matching raw object, acceptance metadata, and outbox entry without
waiting for Processor. A later `RawPayloadFetchV1` request or
`RawHandoffDispositionV1` delivery for a fenced handoff is rejected as stale
and cannot publish or revive canonical work.

When Ingest records a class-default or shortened-policy expiry fence, it also
publishes a versioned durable `RawHandoffExpiryFenceV1` message to Processor.
The message carries the scoped `watchtower_id`, accepted-at cutoff, retention
policy or class-default basis, fence generation, correlation identifier, and
idempotency key. Processor persists the highest fence and must perform a
final authoritative cutoff and local-fence check immediately before canonical
or derived commit and
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
requests the current retention-policy, deletion-tombstone, and applicable
authorization-revocation snapshots, plus the active-project baseline
lifecycle-registration inventory with its authenticated owner identity,
correlation, and idempotency context. The inventory covers every active project
and applicable data class, including default-policy projects that have no
shortened-retention policy row. API persists that inventory in its
restore-independent lifecycle registry before a project is exposed, with the
project scope, project-creation generation, lifecycle state, and applicable data
classes. The entry remains available until no restorable API or Jobs backup can
predate it, including while a project deletion tombstone is being reconciled.
API loads this registry before accepting traffic after an API restore and
materializes each immutable owner-scoped
snapshot and returns a descriptor containing its snapshot identity, registry
generation and digest, bounded page parameters, entry/page counts, and final
digest. The descriptor has no unbounded page-digest list and the unary response
contains no deployment-wide entries. The owner retrieves the snapshot through
bounded, ordered `ControlRegistrySnapshotPageV1` responses. Each page carries a
bounded set of entries, its page digest, cursor/next cursor, and terminal final
digest; the owner rejects missing, repeated, reordered, out-of-scope,
conflicting, or digest-invalid pages and persists the complete snapshot before
readiness. Large completed-export manifests are represented by bounded ordered
recovery entries or chunks covered by the same descriptor digest.

The owner-scoped Processor and Query snapshot pages include desired export holds
and every terminal execution fence from the restore-independent completion
intent. The owner-scoped Jobs pages include each desired
`ExportExpiryScheduleV1` with its export revision, authoritative `completed_at`,
expiry basis, and effective deadline, each desired non-terminal
`ExportExecutionV1` request with its held revision, canonical partition-sequence
vector, derived revision snapshot descriptor, selection-snapshot descriptor,
and execution state, plus every terminal execution fence and its terminal
revision. These entries include acknowledged terminal tombstones retained until
no restorable API, Processor, Query, or Jobs backup can predate the
corresponding terminal transition, resolved authorization-revocation tombstones
through their applicable owner horizon, every unresolved desired Query
revocation fence, and non-terminal execution requests, not only unresolved
intents. Query's pages also include completed-export materialization recovery
metadata: manifest content or bounded manifest chunks and digest, artifact object
references and digests, canonical partition-sequence vectors, derived revision
snapshot descriptors and digests, selection-snapshot descriptors and digests,
export and terminal revisions, and Query's `snapshot_generation`.

After the owner rebuilds or verifies its local metadata and reconciles the
complete snapshot, it sends an authenticated `ControlRegistryReadinessCommitV1`
acknowledgement containing the descriptor generation and digest. API atomically
compares those values with the current registry before recording the owner-ready
cutover. A mutation that wins that serialization makes the acknowledgement fail
and the owner remains unready until it installs a fresh descriptor; a mutation
after a successful cutover is delivered through the normal generation-aware
handoff to the now-ready owner. Query persists and enforces unresolved revocation
fences before this acknowledgement. If a completed artifact or its metadata is
missing or conflicting, Query sends the authenticated
`ExportRecoveryInvalidationV1` handoff to API before remaining unready for that
completed export. API validates the matching completed revision, advances it
through the existing revision-fenced terminal `expired` invalidation and hold-
release path, and Query does not serve the artifact while the handoff is
pending. Jobs reconciles its schedules, non-terminal execution requests, and
fences before re-enabling dispatch. Subsequent policy and deletion mutations use
the same generation-aware durable handoffs, while this request repairs state
after restoration or rebuild.

Retention-policy and project-deletion barriers use a versioned unary
`LifecycleMutationV1` Protobuf-over-HTTP request from API to each of Ingest,
Processor, Query, and Jobs under `/internal/v1`, with API also participating as
an explicit local lifecycle owner. The request carries the
mutation kind, `phase` (`prepare` or `activate`), authorized scope, monotonic
mutation generation, the complete immutable proposed retention policy when the
mutation is a retention change, the policy's per-class proposed cutoffs,
policy digest, correlation identifier, and idempotency key. During `prepare`,
each data owner durably installs a non-destructive pending fence from that
policy and sends Jobs a versioned unary `LifecyclePurgeRegistrationV1` request under
`/internal/v1` containing the owner, mutation kind, authorized scope,
generation, `registration_phase=prepare`, affected data classes, correlation
identifier, and idempotency key. During `prepare`, API records its own
generation-matched pending fence and `LifecyclePurgeRegistrationV1` in the
restore-independent lifecycle registry; that registration covers API-owned
project control-plane rows, export-hold registry entries, and erasable audit
context. Jobs schedules the API registration and dispatches the corresponding
owner-specific purge command back to API after activation.
For project creation, API uses the same request with
`mutation_kind=project_create` and the project-creation generation. Each
applicable owner prepares its project fence and baseline registration. API first
records the project inventory as a pending generation in the
restore-independent lifecycle registry; after all required owner
acknowledgements and the active-generation commit, it marks that inventory
active before exposing the project. Owners then
activates that registration through Jobs. API exposes the project only after
all applicable owners return generation-matched active
`LifecycleMutationAcknowledgementV1` responses; Jobs returns its
`purge_registration_id` before the owner acknowledges the active creation
barrier.
During prepare, Jobs durably persists the registration in `paused` state and returns its
`purge_registration_id`; the owner persists that ID and the paused confirmation
before acknowledging the lifecycle prepare. Jobs handles its own local
registration in the same durable operation. While the generation remains
non-active, each owner sends the same registration ID with
`registration_phase=activate`; Jobs transitions the registration to `armed`,
keeps it non-dispatchable, and returns that state before the owner acknowledges
`phase=active`. API commits the active generation only after every required
armed acknowledgement matches, then emits a durable post-commit enable signal.
Each owner, including API's local lifecycle participant, resends the matching
registration with `registration_phase=enable`;
Jobs verifies the committed generation, transitions the registration to
`active`, enables the schedule, and returns that state. Jobs checks the
committed generation before every irreversible dispatch. Owners and Jobs may
perform irreversible work only after both the active-generation commit and
matching enablement.
The correlated
`LifecycleMutationAcknowledgementV1` carries the owner, mutation kind,
generation, phase, `fence_installed`, `purge_registration_id`, registration
state, and the acknowledged policy digest when applicable.
`purge_registration_id` is a canonical lowercase UUID v7 at this boundary and
is stored as PostgreSQL `uuid` in Jobs state. API returns `accepted_pending`
while prepare, activation, or post-commit enablement is incomplete and reports
success only after all required armed acknowledgements match, the active
generation is committed, and enablement is acknowledged. Stale,
conflicting, or incomplete acknowledgements fail closed, and no purge or
anonymization caused by the pending mutation may run from a pending registration.
Previously active baseline and retention-policy schedules continue to enforce
their own effective cutoffs during a stalled prepare or activation. API does
not report project deletion complete until its purge acknowledgement joins the
Ingest, Processor, Query, and Jobs acknowledgements. The API registration and
minimal deletion tombstone remain restore-independent and retryable if API
crashes before or during its cleanup; append-only audit rows retain only the
existing minimal post-deletion evidence after their project context key is
destroyed.

The authorization-revocation fence is a versioned unary Protobuf-over-HTTP call
under `/internal/v1` from API to Query. API first appends a durable pre-commit
revocation intent to its restore-independent authorization-revocation registry,
then sends the affected actor, project or export scope, the monotonic
authorization revision, correlation identifier, and idempotency key. Query
durably persists the highest fence and acknowledges it; only then may API commit
the authoritative revocation or acknowledge it. API retains a minimal resolved
revocation tombstone, containing the scope, authorization revision, registry
generation, and integrity digest but no customer payload, until no restorable
API or Query backup can predate it. API reloads unresolved intents
before accepting traffic after recovery, reapplies the highest fences, and
retries unresolved commits. Every affected native and compatible Query
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

Before a component begins a break-glass, restoration, key, replication, backup,
restore, or other audited side effect, it sends a versioned `AuditIntentV1` to
API and waits for a durable acknowledgement. The
intent has a canonical lowercase UUID v7 `audit_intent_id`, stored as PostgreSQL
`uuid` wherever it is held in repository-owned relational outbox or state, plus
producer, action, target resource, actor or workload identity, tenant and
project context when applicable, correlation identifier, and idempotency key.
API validates the producer, context, correlation, and idempotency data, appends
the intent to its restore-independent immutable S3 audit journal before
committing the PostgreSQL audit row, and acknowledges only after both
boundaries are durable. A new audited side effect fails closed while API is
unavailable. For a restoration or replacement of non-API component PostgreSQL
state, the API acknowledgement is required before the target store is
replaced. API PostgreSQL restoration is the exception: its `AuditIntentV1`
record is durably written to the restore-independent API audit-intent prefix
before the target store is replaced, and API records the eventual
`AuditEvidenceV1` outcome after recovery. Other components publish at-least-once
`AuditEvidenceV1` that references the intent and records the eventual outcome;
crash recovery retries the evidence or API records an explicit unknown outcome
for an intent whose local evidence was lost before considering the action
complete.
Neither intent nor evidence contains raw payloads or secrets. After API
acknowledges an intent, a component may retain and retry its local evidence
outbox while API is unavailable; API remains the sole audit writer and
correlates the evidence with its immutable audit event. After restoring API
PostgreSQL, API replays journal entries missing from the restored audit boundary
before accepting traffic. Component logs and Jobs execution history are not
audit records.

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
   and returns an active acknowledgement. Verify the project-generation
   inventory is durable outside API PostgreSQL before exposure and is used to
   recreate a default-policy baseline after an API and Jobs restore. Redeliver a retention or deletion
   request and verify each data owner uses `LifecyclePurgeRegistrationV1` to
   obtain a durable paused Jobs registration before acknowledging prepare, keeps
   the generation non-active while sending the matching registration ID for
   activation, and receives the armed, non-dispatchable state before
   acknowledging active. API commits the active barrier only after every owner
   has acknowledged that armed state. Post-commit enablement then transitions
   the matching registration to enabled before purge or anonymization may run;
   an unavailable owner
   leaves a durable `accepted_pending`
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
    API-to-Processor `ExportSnapshotHoldInstallV1` request/response, canonical
    partition-sequence vector, bounded derived-revision and immutable
    selection-snapshot descriptors, authenticated paginated derived-revision
    and selection pages with complete digest validation, API-to-Jobs scheduling, Jobs-to-Query
    `ExportExecutionV1` hold installation, and an export snapshot hold that
    preserves inputs through completion or fails without an artifact when any
    vector member or selection page cannot be materialized; verify terminal
    `ExportSnapshotHoldReleaseV1` delivery for completion, failure, and
    cancellation, including the revision-fenced API-to-Jobs
    `ExportCancellationV1` and Jobs-to-Query `ExportExecutionCancellationV1`
    fences before cancellation releases the originally held revision after API
    advances the terminal revision; verify that a rebuild whose first retained
    canonical sequence is greater than one installs the matching
    `ProjectionRebuildBaselineV1` marker before applying changes, captures and
    authenticates a fixed available target watermark for each partition and an
    immutable bounded derived key/revision target descriptor of every eligible
    aggregate key and `authoritative_revision` when selected, retains post-target
    derived changes including newly created aggregates in a durable rebuild
    buffer, and emits an authenticated
    `ProjectionRebuildDerivedCutoverV1` through a later derived cursor;
    verifies complete digest-checked coverage through every canonical and
    derived target and every buffered change through that cutover before declaring
    completion, and emits
    contiguous `ProjectionRebuildSkipV1` coverage only for retention-excluded
    sequences, writes every eligible row before advancing the global checkpoint,
    leaves that checkpoint unchanged for an incomplete subrange request, and
    fails safely when coverage is missing, incomplete, or mismatched.
14. Race export cancellation and terminal completion or failure, then verify
    the completion/expiry intent and recovery copy are durable before
    `ExportCompletionV1`, its `completed_at` is reused through API and Jobs,
    and the final optional-source, export-object-expiry, and retention-fence
    check occurs immediately
    before API commits `completed`; Jobs then terminalizes execution before API
    exposes completion or schedules object expiry, and cancels and fences queued,
    leased, retry, and in-flight execution, and for a Query failure verifies the
    restore-independent failure intent, `ExportFailureV1` dispatch, and Jobs
    terminal-fence acknowledgement before hold release,
    Query rejects delayed post-terminal `ExportExecutionV1` commands, and
    revision fencing prevents a stale outcome from changing API state or making
    an invalid artifact issuable; partial failed or canceled objects are
    removed at terminal transition. Jobs delivers `ExportExpiryV1` through the
    `ExportExpiryScheduleV1` handoff with an explicit expiry basis at the
    earlier of the seven-day default and export-object policy cutoff; API alone
    advances a still-completed export to `expired` and publishes Query
    invalidation. A restored API replays an
    unresolved completion handoff before resuming its final check and commit;
    it replays an unresolved expiry schedule only after completion succeeds. An
    export whose held source reaches its ordinary
    effective cutoff before completion is revision-fenced-canceled and its
    hold is released only after the Jobs and Query fences are acknowledged;
    completion at or after the persisted source deadline is rejected regardless
    of delivery order; when API is unavailable at that cutoff, Query applies the
    durable source-expiry deadline and Jobs-to-Query fence, removes partial
    artifacts, and rejects delayed execution before later API cancellation
    reconciliation. Completion after the export-object deadline is rejected
    and cleaned up. An empty export has no source deadline or source-retention
    schedule or source-deadline check but still receives ordinary
    completed-object expiry. Shortened-retention preparation installs reversible
    fences for otherwise downloadable completed artifacts whose selected source
    crosses the new cutoff without expiring or invalidating them before the
    mutation commits; post-commit processing expires and invalidates those
    artifacts, reschedules existing artifacts whose export-object cutoff moves
    earlier, and invalidates artifacts whose new cutoff has already passed;
    the restore-independent hold registry records source deadlines and
    cancellation, failure, and release intents before dispatch and replays
    unresolved intents after API restore, retains the completed-materialization recovery
    copy while the artifact remains accessible even after reconciliation, and
    sends `ExportRecoveryInvalidationV1` before leaving Query unready when a
    restored artifact or metadata is missing or conflicting.
15. Attempt a required component break-glass or backup action while API is
    unavailable and verify the action fails before its side effect; with API
    available, verify the API-durable `AuditIntentV1` acknowledgement precedes
    the action and preserves its relational `uuid` type. Restore the component
    from a backup predating its local evidence outbox and verify the API intent
    remains, API records an explicit unknown outcome when evidence is lost, and
    API alone appends the resulting audit event. For an API PostgreSQL restore,
    verify the intent is durable in the restore-independent API audit-intent
    prefix before replacement, and verify API journals each audit event before
    committing the PostgreSQL audit row and acknowledges only after both
    boundaries are durable.
16. Revoke authorization after a native or compatible Query read, cache entry,
    or export URL exists and verify the restore-independent pre-commit intent is
    durable, Query's synchronous revision fence is installed before the
    authoritative revocation commit, and the fence blocks every affected
    admission, read, cache lookup/use, issuance, and download despite stale
    asynchronous projection state; recover after each boundary and verify an
    unresolved intent retries the fence and commit, a resolved minimal tombstone
    remains through the applicable restorable-backup horizon and is reapplied before API or
    Query readiness, and a restored Query receives and enforces every unresolved
    desired revocation fence before its readiness cutover; Query unavailability leaves API durably fail-closed
    rather than acknowledging the revocation.
17. Restore Ingest, Processor, Query, and Jobs independently and verify each
    obtains and persists immutable, paginated current retention-policy,
    deletion-tombstone, resolved and unresolved authorization-revocation, and
    active-project baseline-registration snapshots sourced from API's
    restore-independent lifecycle inventory before readiness; validate
    bounded page ordering, per-page digests, counts, and the final digest, then
    require the atomic `ControlRegistryReadinessCommitV1` generation check;
    restore
    Processor and Query from backups predating an active export hold or
    completed, failed, canceled, or expired terminal execution fence and verify
    their owner-scoped hold/fence and completed-materialization snapshot
    reconciliation completes before readiness, including terminal tombstones
    retained through the latest restorable backup horizon across API, Processor,
    Query, and Jobs, with Query rebuilding or verifying manifests, artifact
    references, the canonical vector, derived revision descriptor,
    selection-snapshot pages, and their digests, and
    `snapshot_generation` before serving a completed export; a concurrent
    registry mutation must either be serialized after the readiness cutover or
    reject the stale acknowledgement and require a fresh descriptor; restore Jobs from
    a backup predating an acknowledged export schedule, non-terminal execution
    request, or terminal fence and verify its owner-scoped schedule, execution,
    and fence snapshot recreates missing schedules and exact revision-fenced
    execution requests, installs every terminal fence before readiness, and
    prevents late execution redispatch; when verification fails, Query retries
    `ExportRecoveryInvalidationV1` to API while remaining unready and API
    performs the terminal invalidation before the artifact can be served; Query
    installs the terminal fence before releasing its projection hold; when
    Jobs' backup predates an ordinary default-policy project creation, verify it
    recreates the missing baseline registration idempotently from the inventory
    before enabling schedules. For project deletion, verify API's own purge
    registration cleans its control-plane rows, export-hold registry entries,
    and erasable audit context, survives an API crash, and joins the four owner
    acknowledgements before deletion completes. When replacing a component store, verify the
    API-acknowledged audit intent survives a backup that predates the replaced
    store, including the API audit-intent prefix for an API PostgreSQL restore,
    and a lost local evidence outbox produces an explicit unknown outcome.

## Deferred Decisions and Non-Goals

This contract does not select exact databases, analytical stores, object
stores, durable-log products, deployment platforms, or numeric SLO targets. It
does not define endpoint catalogs, Sentry compatibility versions, canonical
telemetry fields, authorization roles, PII policy, query semantics, UI states,
alert behavior, or job retry numbers owned by downstream PRDs.

It does not create server, application, Protobuf, storage, queue, or
deployment scaffolds, and it does not implement public routes, internal RPCs,
adapters, projections, processing, jobs, or UI.
