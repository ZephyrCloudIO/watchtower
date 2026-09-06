# Watchtower Canonical Telemetry and Storage Contract

## Scope and Authority

This contract defines Watchtower's protocol-neutral canonical telemetry model,
data classes, storage topology, ownership, lifecycle, replay, export, and
integrity rules. It is documentation only; it does not create services,
schemas, migrations, buckets, topics, adapters, routes, or deployment
infrastructure.

The component and deployment boundary is authoritative in
[`servers-watchtower-components-contract.md`](servers-watchtower-components-contract.md).
The shared runtime, message envelope, security, health, and shutdown rules are
authoritative in
[`servers-watchtower-runtime-contract.md`](servers-watchtower-runtime-contract.md).
This contract selects the canonical data and storage decisions those contracts
leave to downstream ownership. A downstream contract may refine behavior in
its assigned domain but must not move ownership across the component boundary.

## Canonical Model

### Physical signal schemas

Processor owns four separate physical canonical table families in ClickHouse:

| Physical canonical schema | Signal-specific authority | Required common context |
| --- | --- | --- |
| `canonical_error_occurrences` | #19, error intelligence and issue lifecycle | Yes |
| `canonical_metric_points` | #23, metrics ingestion, storage, and querying | Yes |
| `canonical_log_records` | #24, log ingestion, storage, and querying | Yes |
| `canonical_spans` | #25, tracing and application performance monitoring | Yes |

Each family has its own physical schema, signal-specific columns, validation,
and semantics. There is no generic physical event table, generic payload column,
or cross-signal row shape. Signal contracts may add fields and semantics inside
their family, but may not replace the shared context or make another protocol's
DTO the canonical model.

### Required common fields

Every canonical record contains the following typed fields:

| Field | Contract |
| --- | --- |
| `tenant_id` | The authorized tenant owning the record. |
| `project_id` | The authorized project owning the record. |
| `watchtower_id` | A Watchtower-generated canonical lowercase UUID v7 logical-record identifier. It is stable across reprocessing and is never supplied by an external protocol. |
| `processing_generation` | A Processor-assigned immutable canonical lowercase UUID v7 identifier for a canonical result. It is serialized as a canonical lowercase UUID v7 at external boundaries and stored as PostgreSQL `uuid` in Processor selection state. Together with `watchtower_id`, it identifies a canonical row version. |
| `accepted_at` | The time Watchtower durably accepts the record, serialized as UTC RFC 3339 with nanosecond precision. It is the retention and partitioning clock. |
| `observed_at` | The source observation time serialized as UTC RFC 3339 with nanosecond precision, or an explicit typed `not_applicable` value. A missing field is not a not-applicable value. |
| `environment` | A typed environment value. |
| `service` | A typed service identity and version context. |
| `resource` | A typed resource context; it is not an arbitrary JSON object. |
| `instrumentation_scope` | A typed instrumentation library or scope context. |
| `correlation` | Typed request, operation, trace, span, parent, causation, and correlation context where supplied. |
| `source_timezone` | Optional compatibility metadata only. It never changes UTC interpretation or ordering. |
| `external_keys` | Scoped compatibility or correlation keys, each bound to a protocol and scope. They are never Watchtower primary keys. |

Canonical and message timestamps use UTC RFC 3339 with nanosecond precision.
Storage must preserve nanosecond precision even where the physical type is not
the wire representation. Watchtower IDs are globally non-reused across tenants
and the four signal families. External keys are scoped by tenant, project,
protocol, and source namespace, so equal external values in different scopes
remain distinct. W3C trace context and external protocol identifiers remain
correlation or compatibility material; a Sentry event ID, OpenTelemetry trace
or span ID, or any other external ID cannot be used interchangeably with
`watchtower_id`.

### Extension attributes

Extension attributes are a flat, typed, namespaced collection. A value is only
one of `null`, boolean, string, integer, float, or a homogeneous array of one
primitive kind. Arrays cannot contain nested arrays or objects. Attribute names
must include an owning namespace, and the namespace does not permit an
unbounded raw structure.

Arbitrary nested JSON, opaque maps, unbounded payload fragments, credentials,
and unrestricted customer payloads do not enter canonical storage. Values that
cannot be represented by the extension type set are handled by the owning
normalization and privacy contract rather than retained as raw canonical data.

## Data Classes and Ownership

Each class has one authoritative writer and one storage boundary. A projection,
cache, compatibility representation, or audit record is never treated as
canonical telemetry.

| Data class | Writer and authority | Storage boundary | Lifecycle |
| --- | --- | --- | --- |
| Raw accepted records and attachments | Ingest; authoritative for raw acceptance | Encrypted immutable S3 objects plus Ingest PostgreSQL acceptance metadata and outbox state | Seven days from `accepted_at` by default, subject to a successfully installed shortened project policy, and longer until Processor durably confirms handoff completion when still permitted by that policy; never customer-downloadable |
| Normalized records | Processor; authoritative only as processing input | Processor-owned encrypted S3 replay-batch prefix, with separate class metadata | Retained only as needed for replay, no longer than 90 days |
| Enriched records | Processor; authoritative only as processing input | Processor-owned encrypted S3 replay-batch prefix, with separate class metadata | Retained only as needed for replay, no longer than 90 days |
| Canonical telemetry | Processor; authoritative for the four signal histories | Four independent ClickHouse canonical table families | Immutable history for 90 days from `accepted_at` |
| Canonical replay representations | Processor; non-authoritative, immutable replay copies of canonical changes | Processor-owned encrypted project-scoped S3 replay-batch prefix with separate class metadata | 90 days from each represented record's `accepted_at`; purged with its project |
| Default-generation selections | Processor; authoritative mapping of each `watchtower_id` to its promoted `processing_generation` | Processor-owned PostgreSQL selection state with `processing_generation` stored as `uuid`, plus monotonically revisioned selection changes in Processor canonical replay batches | Retained while its canonical record is eligible; rebuilt from retained selection changes and validated against canonical history before Processor republishes it to Query after recovery |
| Derived aggregates | Processor; authoritative for mutable derived results | Processor-owned PostgreSQL schemas and encrypted project-scoped derived replay batches | Retention-windowed to thirteen months from `accepted_at` by default or the shortened project policy; expired contributions are removed before they can remain represented in the aggregate, replay batches, or Query projections |
| Compatibility-only representations | The sole owning adapter for each protocol interface; authoritative only for that boundary | Request-scoped memory or an adapter-owned boundary defined by #16 or its signal contract | No canonical retention; never a shared persistence model |
| Query projections | Query; authoritative only for read projection state | Query-owned ClickHouse databases or schemas | Rebuildable canonical-signal projections are retained for 90 days; derived-aggregate projections use their authoritative aggregate's lifecycle and retention window; all are purged with the project |
| Query cache | Query; never authoritative | Encrypted Query-owned cache | At most 15 minutes; immediately invalidated for retention, deletion, or authorization changes |
| Export objects | Query; non-authoritative customer-download artifacts | Encrypted Query-owned project-scoped S3 export prefix | Seven days from API `completed_at`; canceled, expired, retention-fenced, and deleted-project exports are removed or made inaccessible |
| Audit events | API for contract-level lifecycle and access audit authority | API-owned append-only PostgreSQL audit boundary | Detailed history follows #15; deleted projects retain only minimal anonymous evidence |
| Retention policy registry | API; authoritative for shortened-retention duration policies, their current-time effective cutoffs, and restore cleanup | API-owned encrypted immutable S3 control-registry prefix, independent of API PostgreSQL backups | The active policy persists until superseded and its effective cutoff is computed from that duration at enforcement time; superseded versioned policy records are retained for 13 months and the active policy is loaded before restored owners accept traffic |
| Deletion tombstone registry | API; authoritative for deletion fencing and restore cleanup | API-owned encrypted immutable S3 control-registry prefix, independent of API PostgreSQL backups | Non-customer-readable keyed tombstones retained for 13 months; loaded before restored owners accept traffic |
| Processing and operational state | The component performing the operation | Its own PostgreSQL database or explicitly owned state boundary | Owned and retained by that component; no cross-component writer |

Jobs owns scheduling, leases, execution history, and other job operational
state in its own PostgreSQL boundary. Jobs does not write Processor, Query,
Ingest, or API domain data. API owns the contract-level audit event authority;
Jobs execution history is operational state, not a second audit writer.

## Storage Topology and Isolation

Watchtower uses the following managed services in `us-east-1`:

- Amazon RDS for PostgreSQL with multi-AZ deployment;
- ClickHouse Cloud on AWS with replicated clusters or organizations;
- Amazon S3 Standard; and
- Amazon MSK with multi-AZ deployment.

S3 Standard durability, multi-AZ RDS and MSK, and replicated ClickHouse are
selected for in-region resilience. Watchtower makes no cross-region recovery,
RPO, RTO, or scheduled-restore commitment. Cross-region replication and
customer-managed keys are out of scope.

Production and non-production use separate AWS accounts, storage resources,
ClickHouse organizations or clusters, KMS keys, and workload credentials.
Customer data is never copied into non-production; non-production uses
synthetic or independently sourced data.

Shared infrastructure is permitted only when each component has exclusive
databases or schemas, S3 buckets or prefixes, MSK topics, ACLs, and workload
credentials. A shared physical service does not create shared ownership.
Cross-component SQL, object-store access, persistence fallbacks, and direct
access to another component's storage are prohibited.

### Component storage boundaries

| Component | Owned storage and writes |
| --- | --- |
| Ingest | Encrypted immutable raw S3 objects, PostgreSQL acceptance metadata, and the transactional processing outbox. |
| Processor | The four immutable canonical ClickHouse histories, encrypted project-scoped non-authoritative replay batches, PostgreSQL processing state, and mutable derived aggregates. |
| Query | Independently owned ClickHouse read projections, encrypted non-authoritative cache, and encrypted project-scoped S3 export prefix. |
| API | Authoritative control-plane and audit state in its own PostgreSQL boundary, plus encrypted immutable S3 control-registry prefixes for restore-independent retention policies and deletion tombstones. |
| Jobs | Scheduling, leases, retries, dead-letter state, execution history, and orchestration state in its own PostgreSQL boundary. |
| Web | No server-authoritative storage. |

Raw S3 writes use immutable UUID v7-keyed objects under:

```text
environment/component/tenant/project/accepted-date/<watchtower-uuid-v7>
```

The Ingest PostgreSQL acceptance record stores the object key, SHA-256 digest,
size, `accepted_at`, tenant, project, Watchtower ID, and outbox state. A raw
record is not successfully acknowledged unless the immutable object exists,
its digest and size have been verified, and the acceptance metadata and
transactional outbox commit. Orphaned or incomplete attempts are reconciled
without being reported as successful acceptance. The raw object, acceptance
metadata, and recoverable handoff remain until Processor durably confirms
completion; Ingest redelivers and reconciles pending handoffs if the seven-day
MSK window expires.

Canonical ClickHouse tables are partitioned monthly by `accepted_at` and
ordered by:

```text
tenant_id, project_id, observed_at, watchtower_id, processing_generation
```

Every PostgreSQL multi-tenant table enables row-level security. Tenant-scoped
rows and queries require an authorized tenant predicate; project-scoped rows
and queries require authorized tenant and project predicates. RLS is defense in
depth, not a replacement for authorization. Equivalent tenant and, where
applicable, project isolation is required in ClickHouse policies, S3 prefixes
and KMS permissions, MSK ACLs, exports, and break-glass workflows.

## Consistency, Messages, and Replay

Storage changes use local storage transactions, transactional outboxes,
versioned messages, idempotent retry, and reconciliation. There are no
distributed transactions and no best-effort cross-store writes.

Ingest acknowledgement means only that durable raw acceptance and durable
handoff have succeeded. It does not mean that canonical telemetry or a Query
projection is visible. Canonical and Query visibility are asynchronous and
eventually consistent.

The existing versioned message envelope remains authoritative for message
identity, producer, tenant/project context, event time, causation,
correlation, W3C trace context, idempotency, and bounded payload or authorized
payload reference. Message timestamps use the same UTC RFC 3339 nanosecond
format as canonical timestamps. Delivery is at least once and consumers are
idempotent.

MSK handoff and canonical-change topics retain data for seven days and use:

- replication factor `3`;
- `min.insync.replicas=2`; and
- producer `acks=all`.

Processor owns encrypted, project-scoped canonical replay batches in S3 for 90
days and derived replay batches for their authoritative aggregate lifecycle.
When committing each normalized or enriched processing-input replay batch,
Processor records the immutable object's SHA-256 digest and byte size in its
separate class metadata, and verifies both before any replay or reprocessing
use. A verification failure makes the batch unusable and cannot create,
publish, or promote a canonical result.
Each immutable replay batch is retention-homogeneous: every represented item
has the same effective lifecycle expiry, and Processor does not place items
with different expiry deadlines in one object.
Canonical replay batches are non-authoritative immutable copies, not a second
canonical store; their separate metadata identifies the represented canonical
versions for reconciliation and deletion. Derived aggregates are
retention-windowed: Processor removes expired contributions by recomputing or
deleting each aggregate before they can outlive the applicable thirteen-month
default or shortened project policy. Their replay batches and Query projections
contain only that recomputed result. Processor assigns each derived aggregate
change a strictly monotonic per-project, per-aggregate `authoritative_revision`,
persists it with the aggregate state and selected source set, and emits it with
derived change and replay metadata. Query and every recovery or rebuild consumer
retain the highest applied revision for each aggregate, ignore lower revisions,
and apply an equal revision only when the aggregate state and selected source
set match; a conflicting equal revision is rejected as an integrity conflict.
Query projection rebuilds submit an authorized request for Processor to
republish the eligible versioned canonical or derived changes. Query never reads
Processor S3, Processor PostgreSQL, or Processor ClickHouse directly. Rebuilds
are idempotent and cannot republish a deleted project. Consumers must understand
every message schema version retained in the applicable replay horizon.

## Retention, Deletion, and Reprocessing

Retention is calculated from `accepted_at`, except that derived aggregates and
their replay batches and Query projections use the retention-windowed lifecycle
defined above, and export objects use the `completed_at` lifecycle anchor defined
in the Export Contract. Authorized project administrators may shorten a project
retention policy but may not extend it through this contract. API assigns every
project policy a strictly monotonic generation and records each versioned shortened
duration policy in its restore-independent retention policy registry. Ingest,
Processor, and Query each durably retain the highest installed generation, ignore
lower-generation deliveries, and acknowledge installation only for the matching
or an idempotent equal generation. Each owner computes its effective cutoff from
that duration and current time whenever enforcing admission, read, processing,
replay, export, or rebuild behavior. API reports success only after each owner
durably installs and enforces the policy. Until acknowledgement, the mutation
fails closed. Before
its acknowledgement, Ingest stops admitting excess records and serving excess raw
data, Processor durably fences queued, pending-handoff, and replayed work whose
`accepted_at` falls outside the new limit, prevents canonical or derived
publication, and recomputes or removes derived results with expired
contributions, and Query denies excess reads, exports, and rebuilds. Processor
returns a durable terminal policy-fenced disposition for each rejected raw
handoff; Ingest records that disposition as completed, retires its outbox entry,
and purges the corresponding raw object and acceptance metadata under the new
policy. After installing its fence, each owner submits a durable recurring
active-store purge schedule to Jobs for as long as the shortened policy remains
active. Jobs must durably persist that schedule before the owner acknowledges the
policy. Jobs owns scheduling and retrying each purge dispatch; on every run, the
data owner applies the current-time effective cutoff and idempotently purges all
newly expired data within 14 days. Before any restored or rebuilt API, Ingest,
Processor, Query, or Jobs owner becomes ready, it obtains current retention-policy
and deletion-tombstone registry snapshots from API and enforces them: each data
owner reapplies its effective cutoff, fences excess data, and submits its durable
recurring active-store purge schedule to Jobs; Jobs restores the associated
scheduling and deletion fences. There is no cold archive.

Project deletion is project-wide. API creates a versioned deletion generation
and keyed project tombstone in its append-only restore-independent registry,
then requires durable acknowledgement from Ingest, Processor, Query, and Jobs
before accepting the deletion; it fails closed until all acknowledge. Each owner
fences the project for that generation before acknowledgement: Ingest rejects
collection and pending raw handoffs, Processor rejects pending or replayed work
and canonical or derived republishing, Query rejects reads, restoration, exports,
and new projection rebuilds, and Jobs cancels and fences queued, retry,
dead-letter, dispatchable, leased, and in-flight project work. Before Jobs
acknowledges, it prevents further dispatch for that generation and rejects late
execution outcomes so they cannot recreate project-scoped execution state. Query
invalidates cache entries immediately. Active stores, including raw, canonical,
derived, projections,
replay batches, export objects, and Jobs project-scoped operational state, are
purged or irreversibly anonymized within 14 days. Backups are purged within 90
days, and deleted project data is not restored from a backup. Before a restored API
database accepts traffic, API loads the current registry and reapplies every
current tombstone to identify, fence, and purge deleted-project rows. Before
accepting deletion, API irreversibly removes every retention-policy registry
version for the project. API retains the non-customer-readable registry tombstone
for 13 months. Only irreversible minimal evidence remains after project deletion:
deletion timestamp, result, correlation ID, and the keyed tombstone, without
tenant-identifying or customer-payload content.

Reprocessing is bounded by project and `accepted_at` range. Each attempt records
source data class, source and target schema or normalization versions,
processor release, request or job identity, correlation ID, checksums, counts,
and outcome. Raw data is the source for ranges within the project's applicable
raw-retention window, which is seven days by default; after that, an eligible
retained safe normalized replay batch is the source.

A new result uses a new UUID v7 `processing_generation` and is a candidate until
the complete requested range passes integrity validation. Processor records the
authoritative default-generation mapping for each `watchtower_id`; promotion
updates that mapping only after full-range success. A partial or failed range
never becomes the default and the prior default result remains active. Derived
aggregate computation and publication use only rows selected by the authoritative
default-generation mapping; candidate generations are excluded until promotion.
Processor assigns every selection change a strictly monotonic per-`watchtower_id`
selection revision, persists that revision with the mapping, and emits it with
canonical replay metadata. Query and every recovery or rebuild consumer retain
the highest applied revision for each record, ignore lower revisions, and treat
an equal revision as an idempotent replay only when it has the same selection.
After recovery or rebuild, Processor replays retained selection changes,
validates the resulting mapping against canonical history, and only then
republishes the selection to Query. External historical imports are not supported.

## Export Contract

API owns export authorization and customer-visible status. Jobs schedules the
work. API assigns each export a canonical lowercase UUID v7 `export_id`, stores
it as PostgreSQL `uuid` in API state, and uses that canonical lowercase UUID v7
representation at every external boundary. Query produces selected-signal
canonical and derived snapshots from its own projections into its encrypted
project-scoped S3 export prefix. At export creation, API sends Processor an
authenticated, versioned export-watermark request containing `export_id` and
`export_revision`, authorized tenant and project scope, `accepted_at` range,
selected signals, and whether derived results are selected. Processor returns a
correlated, versioned response with
the canonical change watermark for that scope and, when applicable, the
authoritative derived-state revision watermark. API persists those watermarks
and carries them in the versioned work dispatched to Jobs and Query; Query does
not infer them from its local projection. After its applicable projections
reach those watermarks, Query emits a versioned export outcome containing
`export_id`, `export_revision`, outcome, manifest, watermarks, and snapshot
generation; API alone records the resulting lifecycle transition. The manifest
records the watermarks and Query snapshot generation. Exports never include raw
data, caches, or audit records.

An export contains Parquet data and a JSON manifest with the schema version,
authorized scope, selected signals, `accepted_at` range, object sizes, and
SHA-256 checksums. For every Parquet object, the manifest also records a row
count and deterministic reconciliation summaries: ordered Watchtower-ID,
processing-generation, canonical-content-digest, and correlation-ID digests
where those fields are represented. For derived rows, it records an ordered
digest of aggregate keys,
authoritative derived revisions, selected aggregate state, and deterministic
selected-canonical-source-set digests at the derived watermark. For canonical
rows, the manifest additionally records the
deterministic digest of the authoritative default-generation selection at the
snapshot watermark; every exported canonical row must match that selection.
These summaries are the export reconciliation source. A project may have one
active export and at most three export requests per UTC day. Each signal range
is limited to 31 days and 100 GiB uncompressed. A larger request fails safely
with `resource_exhausted` and a correlation ID.

Export lifecycle states are `queued`, `running`, `completed`, `failed`,
`canceled`, and `expired`. Every export attempt has a strictly monotonic
`export_revision` persisted by API. Jobs commands and Query outcomes carry the
`export_id` and `export_revision`. API accepts an outcome only when its revision
matches the current non-terminal export state; it ignores lower, mismatched,
or otherwise stale outcomes and every outcome received after a terminal state
has been recorded. Cancellation advances the revision and fences in-flight
work, so a late completion cannot restore a canceled export and a late failure
cannot overwrite a successful one. Query stops or invalidates the associated
artifact when cancellation is fenced. API records `completed_at` as the UTC time
it persists a successful `completed` transition, and export objects are retained
for seven days from that timestamp, independent of the records' `accepted_at`
values. API rechecks authorization immediately before requesting a Query-owned
authorized download-gateway URL of up to one hour, capped at the export object's
remaining retention lifetime; it then calls Query's authenticated internal issuance
interface with the authorized actor, action, project, export context, and capped
lifetime. Query independently validates the caller, current authorization
projection, export ownership, and lifecycle state before issuing the opaque
gateway URL and again for every download request; the URL expiry never exceeds
object expiry. Authorization changes invalidate outstanding gateway URLs, and
Query denies subsequent download requests. API never accesses Query object
storage or signing credentials, and gateway URLs never grant direct object-store
access. The URL is never issued for a deleted, unauthorized, revoked, or expired
export. Deletion cancels active exports and revokes issued download access.
Cancellation prevents publication of incomplete results and removes or
invalidates the associated objects according to the seven-day export lifecycle
anchored at `completed_at`.

Safe status and error responses expose no raw payload, secret, or unauthorized
tenant/project information. The export-specific active-export and daily-request
limits above are authoritative here; detailed authorization, roles,
non-export quotas, and credential behavior remain owned by #15.

### Reconciliation digest encoding

Every reconciliation digest is lowercase hexadecimal SHA-256 over one UTF-8
byte stream. The stream contains one RFC 8785 canonical-JSON tuple per line,
sorted by the bytewise UTF-8 value of that canonical tuple and terminated by a
single line-feed. Missing values use JSON `null`; each represented row emits
one tuple, so repeated correlation values are preserved rather than deduplicated.
For every canonical row, `canonical_content_digest` is lowercase hexadecimal
SHA-256 over the RFC 8785 canonical-JSON encoding of the complete typed
canonical record, including common fields, signal-specific fields, and
extension attributes, but excluding storage-engine metadata, reconciliation
metadata, and the digest itself. Every authoritative canonical row, replay
copy, Query projection row, and exported canonical row carries or deterministically
recomputes the same content digest.
The required tuples are `{"watchtower_id": ...}` for raw acceptance and
handoff; `{"watchtower_id": ..., "processing_generation": ..., "canonical_content_digest": ...}`
for canonical history, replay, Query projections, default-generation selection,
and canonical exports; that identity tuple plus `"correlation_id"` for
correlation summaries; and
`{"aggregate_key": ..., "authoritative_revision": ..., "selected_state": ...,
"source_set_digest": ...}` for derived summaries. `selected_state` is itself
RFC 8785 canonical JSON. Each `source_set_digest` is SHA-256 over the same
line-delimited canonical-JSON encoding of the aggregate's selected canonical
source `{"watchtower_id": ..., "processing_generation": ...}` tuples. It
commits to every represented source membership, including multiple sources with
the same aggregate value.

## Integrity, Observability, Audit, and Security

All service-to-service and storage transport uses TLS. At-rest encryption uses
platform-managed KMS envelope encryption. Raw payloads are inaccessible to
customers and Query; automated processing may access them only within the
Ingest-to-Processor boundary. Approved, time-limited, audited operator
break-glass access is the only exception, and operator guidance is required
before implementation release.

Raw customer payloads, credentials, bearer tokens, private keys, and opaque
session material are never logged. Metrics, distributed traces, and safe
structured logs must cover:

- acceptance-to-canonical-to-projection lag and MSK lag;
- storage errors, capacity, and backup operations;
- cache population and immediate invalidation;
- retention, deletion, export, and lifecycle jobs; and
- checksum, count, UUID, and correlation-ID reconciliation.

Accepted-data-loss risk, unrecoverable handoff, and tenant-isolation risk page
immediately. Lifecycle failures, deletion-deadline risk, backup-purge failure,
and unreconciled integrity differences alert and escalate through the owning
operational boundary.

Raw and export objects are checksum-validated. Reconciliation compares
like-for-like dimensions: raw acceptance and handoff compare logical
`watchtower_id` counts and ordered ID digests; before Ingest retires its
recoverable state, each successfully completed handoff is generation-aware
reconciled to the authoritative default-generation selection or a durable
terminal disposition; canonical histories and replay compare physical
`(watchtower_id, processing_generation, canonical_content_digest)` counts and
ordered content-aware digests; and Query projections and canonical exports
compare the authoritative default-generation selection and canonical content
digests at a common watermark. Derived projections and exports compare the
selected aggregate state, aggregate revisions, and retention-windowed source
set at a common derived-state revision watermark.
Correlation-ID digests are compared only for represented records in the same
dimension. A mismatch is not silently repaired or treated as successful
completion.

Immutable audit events are required for break-glass access, exports, deletion,
restoration attempts, reprocessing, retention changes, and key, replication,
backup, or restore actions. API remains the contract-level audit writer;
component logs and Jobs execution history do not replace the audit boundary.

Threat-model review is required before accepting this contract and before each
implementation release. Customer-facing retention, deletion, export, and
support documentation, including support limits, must exist before
implementation release. This contract makes no named regulatory certification
commitment.

This issue creates documentation only, so a feature flag is not applicable.
Future executable work must define its own rollout and operational controls.

## Downstream Authority and Non-Goals

The Watchtower project index in
[`project-watchtower.md`](project-watchtower.md) remains the authority map.
This contract specifically leaves the following decisions to their owning
issues:

| Issue | Remaining authority |
| --- | --- |
| #15 | Control-plane resources, WorkOS authentication, authorization, roles, project lifecycle, credentials, non-export quotas, and detailed audit access |
| #16 | Sentry-compatible routes, DTOs, request semantics, and protocol compatibility mappings |
| #17 | Ingestion admission, capacity behavior, and detailed durable raw-to-processing handoff |
| #18 | Normalization, privacy processing, enrichment, and processing policy |
| #19 | Error grouping, issue aggregates, and issue lifecycle |
| #21 | Query routes, query language, read semantics, limits, freshness, and error exploration |
| #23 | Metric identity, temporal and aggregation semantics, cardinality, and metric querying |
| #24 | Log body, severity, parsing, indexing, search, and log querying |
| #25 | Span and trace semantics, sampling, service modeling, and APM behavior |
| #29 | Job types, scheduling, leases, retries, cancellation, dead letters, and execution policy |

This contract does not implement services, database schemas, migrations,
buckets, topics, storage adapters, retention jobs, export handlers, deployment
infrastructure, public API routes, Sentry wire compatibility, role matrices,
credential lifecycle, PII scrubbing policy, signal-specific semantics, query
languages, job retry policy, customer-managed keys, cross-region replication,
external historical imports, raw customer downloads, or numeric
platform-wide targets.

## Contract Acceptance Scenarios

The owning implementation contracts must make these scenarios testable:

1. Store equivalent external event, trace, or span identifiers for two tenants
   without Watchtower ID collision or cross-tenant disclosure.
2. Fail S3, PostgreSQL, ClickHouse, and MSK operations before and after local
   commits; verify no false successful acceptance and idempotent recovery.
3. Verify raw-object immutability, SHA-256 and size reconciliation, required
   MSK durability and seven-day default retention settings, shortened-policy
   enforcement, redelivery of unprocessed work after the MSK window expires,
   and generation-aware reconciliation of each completed handoff to a promoted
   canonical default or durable terminal disposition before raw retirement.
4. Rebuild eligible canonical and derived Query projections through authorized
   Processor republishing without direct Processor storage access; verify that
   canonical replay copies remain non-authoritative, have retention-homogeneous
   expiry, reconcile to their represented canonical versions, and reject a
   changed non-key canonical field when its identity pair is unchanged.
5. Shorten retention and delete a project; verify Ingest, Processor, Query, and
   Jobs install and enforce each deletion fence before acknowledgement; fencing
   of pending, handoff, replayed, queued, retry, dead-letter, dispatchable,
   leased, and in-flight work; rejection of late execution outcomes; terminal
   disposition and retirement of policy-fenced raw handoffs;
   derived-aggregate recomputation without expired contributions; current-time
   duration enforcement; durable Jobs schedule registration before each owner
   acknowledges a shortened policy; recurring Jobs-scheduled, owner-run active
   purges of data that expires after policy installation within 14 days;
   purge or irreversible anonymization of Jobs project-scoped operational state;
   backup purge within 90 days; removal of every project retention-policy registry
   record; restore-independent retention and tombstone-registry recovery before
   any restored or rebuilt owner accepts traffic; export cancellation; cache
   invalidation; and
   minimal anonymous evidence.
6. Export permitted signals and verify Parquet output, manifest checksums, row
   counts, independently recomputable canonical digest tuples, generation-aware
   canonical-content and revision-aware derived reconciliation summaries,
   default-generation selection, API-to-Processor correlated watermark
   request/response, Processor-to-Query watermark completion, Query-to-API
   versioned completion outcomes and API-only lifecycle persistence, rejection
   of stale outcomes after cancellation or another terminal transition,
   Query-issued URLs no longer than their remaining object lifetime and
   seven-day object expiry anchored at `completed_at`,
   authorization recheck, rate limits, and oversized-request `resource_exhausted`
   behavior.
7. Reprocess a successful and a partially failed range; verify provenance,
   distinct processing generations, full-range promotion, preservation of the
   prior default result, ordered per-record selection revisions with stale
   delivery rejection, selection-state recovery and republishing after a
   Processor rebuild, generation-aware cross-stage reconciliation, derived
   aggregates exclude candidate generations, consistent derived-aggregate
   lifecycle anchors after later contributions, and rejection of lower or
   conflicting equal derived-aggregate revisions; reject a corrupted or truncated
   normalized or enriched processing-input replay batch before reprocessing or
   canonical publication.
8. Attempt cross-tenant access through PostgreSQL, ClickHouse, S3, MSK,
   projections, exports, and break-glass workflows; verify denial and required
   audit evidence.
9. Verify that production and non-production accounts, stores, keys,
   credentials, and data paths remain separate.
10. Trigger accepted-data-loss, unrecoverable-handoff, tenant-isolation,
    deletion-deadline, and reconciliation failures; verify the required page,
    alert, and escalation behavior.
