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
| `project_id` | The authorized project owning the record, serialized as a canonical lowercase UUID v7 at external boundaries and stored as PostgreSQL `uuid` in repository-owned relational state. |
| `watchtower_id` | A Watchtower-generated canonical lowercase UUID v7 logical-record identifier. It is serialized as a canonical lowercase UUID v7 at external boundaries and stored as PostgreSQL `uuid` wherever it is held in repository-owned relational state. It is stable across reprocessing and is never supplied by an external protocol. |
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

Canonical and message timestamps use exactly
`YYYY-MM-DDTHH:mm:ss.sssssssssZ`: UTC, nine fractional-second digits, and a
trailing `Z`, with no numeric offset or omitted fraction. Producers normalize
equivalent instants to this representation before RFC 8785 canonicalization and
digesting. Storage must preserve nanosecond precision even where the physical
type is not the wire representation. Watchtower IDs are globally non-reused
across tenants and the four signal families. External keys are scoped by tenant,
project, protocol, and source namespace, so equal external values in different scopes
remain distinct. W3C trace context and external protocol identifiers remain
correlation or compatibility material; a Sentry event ID, OpenTelemetry trace
or span ID, or any other external ID cannot be used interchangeably with
`watchtower_id`.

### Extension attributes

Extension attributes are a flat, typed, namespaced collection. A value is only
one of `null`, boolean, string, integer, finite float, or a homogeneous array of
one primitive kind. Finite float values equal to zero are normalized to `+0.0`
before canonical storage, replay, export, or digesting, so signed zero is not a
distinct canonical value. Arrays cannot contain nested arrays or objects. Attribute
names must include an owning namespace, and the namespace does not permit an
unbounded raw structure. Integer values are restricted to the exact IEEE-754
safe-integer range `[-(2^53 - 1), 2^53 - 1]`; larger integers are rejected
during normalization. `NaN`, positive infinity, and negative infinity are
rejected during normalization and never enter canonical storage, replay,
reconciliation digests, or exports.

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
| Raw accepted records and attachments | Ingest; authoritative for raw acceptance | Encrypted immutable S3 objects plus Ingest PostgreSQL acceptance metadata and outbox state | Seven days from `accepted_at` by default; a project policy may shorten this cutoff but never extend it, and raw state may remain only until Processor durably confirms handoff completion or Ingest durably records class-default or shortened-policy expiry within that cutoff; never customer-downloadable |
| Normalized records | Processor; authoritative only as processing input | Processor-owned encrypted S3 replay-batch prefix, with separate class metadata | Retained as needed for replay; when raw may retire after a successful handoff, a verified normalized representation has a retention floor through the applicable raw-retention cutoff even if a class policy is shorter, and is never retained longer than 90 days |
| Enriched records | Processor; authoritative only as processing input | Processor-owned encrypted S3 replay-batch prefix, with separate class metadata | Retained only as needed for replay, no longer than 90 days |
| Canonical telemetry | Processor; authoritative for the four signal histories | Four independent ClickHouse canonical table families | Immutable history for 90 days from `accepted_at` |
| Canonical replay representations | Processor; non-authoritative, immutable replay copies of canonical changes | Processor-owned encrypted project-scoped S3 replay-batch prefix with separate class metadata | 90 days from each represented record's `accepted_at`; purged with its project |
| Default-generation selections | Processor; authoritative mapping of each `watchtower_id` to its promoted `processing_generation` | Processor-owned PostgreSQL selection state with `processing_generation` stored as `uuid`, plus monotonically revisioned selection changes in Processor canonical replay batches | Retained while its canonical record is eligible; rebuilt from retained selection changes and validated against canonical history before Processor republishes it to Query after recovery |
| Derived aggregates | Processor; authoritative for mutable derived results | Processor-owned PostgreSQL schemas and encrypted project-scoped derived replay batches | Retention-windowed to thirteen UTC calendar months after `accepted_at` by default or the shortened project policy; expired contributions are removed before they can remain represented in the aggregate, replay batches, or Query projections |
| Compatibility-only representations | The sole owning adapter for each protocol interface; authoritative only for that boundary | Request-scoped memory or an adapter-owned boundary defined by #16 or its signal contract | No canonical retention; never a shared persistence model |
| Query projections | Query; authoritative only for read projection state | Query-owned ClickHouse databases or schemas | Rebuildable canonical-signal projections are retained for 90 days; derived-aggregate projections use their authoritative aggregate's lifecycle and retention window; all are purged with the project |
| Query export metadata | Query; authoritative for export materialization state and `snapshot_generation` | Query-owned PostgreSQL export-metadata boundary | Retained with the export lifecycle and purged with the project; it is not a second export authority and contains no raw telemetry |
| Query cache | Query; never authoritative | Encrypted Query-owned cache | At most 15 minutes; immediately invalidated for retention, deletion, or authorization changes |
| Export objects | Query; non-authoritative customer-download artifacts | Encrypted Query-owned project-scoped S3 export prefix | The earlier of seven days from API `completed_at` and the active export-object policy cutoff computed from `completed_at` for successful artifacts; artifacts from any attempt that terminates without successful `completed`, including failed or canceled attempts, are removed or made inaccessible at terminal transition, and retention-fenced or deleted-project exports are removed or made inaccessible immediately |
| Audit events | API for contract-level lifecycle and access audit authority | API-owned append-only PostgreSQL audit boundary with erasable encrypted project-scoped context, plus a restore-independent immutable audit journal | Detailed history follows #15; every journaled event is replayable after an API database restore, and deleted projects retain only minimal anonymous evidence |
| API restore audit intents | API; authoritative for pre-restore intent evidence until API records the outcome in its audit boundary | API-owned encrypted immutable S3 audit-intent prefix independent of API PostgreSQL backups | Retained through restore completion and evidence recording, then follows the applicable audit-retention policy; never stored only in the API restore target |
| API export hold registry | API; authoritative for restore-independent export hold, terminal-release, completion/expiry scheduling evidence, and recovery copies of completed materialization metadata | API-owned encrypted immutable S3 export-hold registry prefix independent of API PostgreSQL backups | Retained until every held revision, expiry schedule, and completed-materialization recovery record is terminally released, reconciled, or replayed; after terminal cleanup, a minimal terminal tombstone remains until no restorable API PostgreSQL backup can contain the pre-terminal state, then follows export and project-deletion cleanup |
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
| Query | Independently owned ClickHouse read projections, Query-owned PostgreSQL export metadata, encrypted non-authoritative cache, and encrypted project-scoped S3 export prefix. |
| API | Authoritative control-plane and audit state in its own PostgreSQL boundary, plus encrypted immutable S3 control-registry prefixes for restore-independent retention policies, deletion tombstones, API restore audit intents, the API audit journal, and export holds. |
| Jobs | Scheduling, leases, retries, dead-letter state, execution history, and orchestration state in its own PostgreSQL boundary. |
| Web | No server-authoritative storage. |

Raw S3 writes use immutable UUID v7-keyed objects under:

```text
environment/component/tenant/project/accepted-date/<watchtower-uuid-v7>
```

The Ingest PostgreSQL acceptance record stores the object key, SHA-256 digest,
size, `accepted_at`, tenant, project, `watchtower_id` as PostgreSQL `uuid`, and
outbox state. A raw record is not successfully acknowledged unless the
immutable object exists,
its digest and size have been verified, and the acceptance metadata and
transactional outbox commit. Orphaned or incomplete attempts are reconciled
without being reported as successful acceptance. The raw object, acceptance
metadata, and recoverable handoff remain until Processor durably confirms
completion through the versioned `RawHandoffDispositionV1` message or Ingest
durably records a class-default or shortened-policy expiry fence through
`RawRetentionExpiryV1`.
For a `completed` disposition, Processor commits the verified normalized replay
representation before sending the disposition, so Ingest may retire raw state
immediately without losing the reprocessing source. Ingest redelivers and
reconciles pending handoffs if the seven-day MSK window expires.

Canonical ClickHouse tables are partitioned monthly by `accepted_at` and
ordered by:

```text
tenant_id, project_id, observed_at, watchtower_id, processing_generation
```

The monthly ClickHouse partition is a physical storage choice and is not the
canonical change partition used for export watermarks. Processor defines one
logical canonical-change partition for each `(tenant_id, project_id,
signal_family)` tuple, where `signal_family` is one of
`error_occurrences`, `metric_points`, `log_records`, or `spans`. Processor is
the sole authority for a partition's strictly increasing unsigned 64-bit
`canonical_change_sequence`. Because the authoritative row is in ClickHouse
and the coordination state is Processor-owned PostgreSQL, the row and outbox
are not committed in one physical transaction. Processor first reserves the
sequence and persists an immutable canonical-write staging record, its
canonical-content digest, and a durable outbox intent in one Processor-local
PostgreSQL transaction. A reconciler then idempotently commits the staged row
to ClickHouse using the partition and sequence identity. After verifying the
same digest, it marks the staging record `clickhouse_committed`; only that
state is eligible for durable outbox publication. If the current-cutoff check
fails before the row can be committed or published, the reconciler instead
marks the staged write retention-expired and publishes an idempotent,
no-row `CanonicalChangeSkipV1` marker for the reserved sequence through the
same canonical-change path. The marker carries the partition, sequence,
retention cutoff, expiry basis, marker integrity digest, and idempotency context;
Query applies it as
contiguous coverage without creating a row. A retry reuses the same partition
and sequence rather than allocating another one. Recovery reconciles staged,
ClickHouse-committed, skipped, and published states, including a ClickHouse
row that exists before its PostgreSQL status is recorded. A sequence has no
available watermark until its authoritative row or skip marker and publication
are both durably confirmed. A conflicting payload, marker, or digest for an
existing `(partition, sequence)` is an integrity failure; there is no
distributed transaction or best-effort publication.

Query stores the highest contiguous applied sequence and its digest for each
logical partition. It rejects a gap or a conflicting equal sequence and
replays missing sequences through the normal Processor-owned change path.
`ProjectionRebuildV1` is the only path that may initialize a lost Query
checkpoint. Before republishing eligible canonical changes for each requested
partition, Processor emits a versioned `ProjectionRebuildBaselineV1` marker
through the normal authenticated rebuild path. The marker carries the
`rebuild_id`, partition identity, active retention cutoff, the authorized
rebuild scope, `baseline_sequence` equal to the sequence immediately before
the first retained change, the first retained sequence or an explicit empty
partition, and an integrity digest over those values. Query verifies that the
marker matches the rebuild request and current fences, stages the requested
partition from that baseline, and atomically records the baseline as its
highest contiguous applied sequence and marker digest before accepting
`baseline_sequence + 1`. For every sequence after the baseline through the
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
An empty retained window still records its baseline. A missing, conflicting,
or stale marker fails the rebuild safely; it cannot reset a live partition or
be used outside its matching rebuild. Normal live changes continue to reject
gaps.
Export watermark vectors use these exact partition identities and sequences;
the vector is complete only when every requested partition is materialized
through its requested sequence. No sequence is compared across partitions.

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
payload reference. Raw references are owner-issued, scoped to one handoff, and
usable only through Ingest's authenticated `RawPayloadFetchV1` interface;
Processor never reads Ingest object storage directly. Message timestamps use
the same UTC RFC 3339 nanosecond format as canonical timestamps. Delivery is at
least once and consumers are idempotent.

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
Replay batches use bounded one-hour UTC expiry buckets keyed by each item's
effective lifecycle expiry. Batch metadata records the bucket and every
item's exact effective expiry, so a batch may span exact expiry instants
without losing per-item retention data. Canonical and derived replay objects
are deleted at the earliest represented expiry; later-expiring non-authoritative
copies may therefore be retired early, but no object can retain an expired
item. Before that deletion, Processor splits or rolls every still-eligible
canonical replay entry and associated default-generation selection change into
a successor and carries the source digest and provenance forward. If a
normalized or enriched processing-input batch must remain available through a
raw-retention cutoff, Processor uses the same rollover for its still-needed
items before the earliest deletion deadline. For a successful handoff whose raw
state may retire, the normalized item's effective cutoff is never earlier than
the applicable raw-retention cutoff; a shortened normalized policy cannot
delete the only eligible reprocessing source before that floor. No replay
object is retained past any represented item's effective cutoff.
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
Query projection rebuilds submit an authorized versioned `ProjectionRebuildV1`
request for Processor to republish the eligible canonical or derived changes.
Processor durably accepts an idempotent request before acknowledging it and
publishes the existing versioned changes through the normal Processor-to-Query
path. Query never reads Processor S3, Processor PostgreSQL, or Processor
ClickHouse directly. Rebuilds are idempotent and cannot republish a deleted
project. Consumers must understand every message schema version retained in the
applicable replay horizon. Canonical-change messages carry the Processor-owned
`(tenant_id, project_id, signal_family)` partition identity,
`canonical_change_sequence`, and canonical-content digest defined in the
storage topology. Processor publishes committed sequences through its durable
outbox and retained replay batches; Query applies only contiguous sequences,
rejects gaps or conflicting equal sequences, and reports a partition watermark
only after all preceding sequences are covered by a canonical change, an
idempotent live `CanonicalChangeSkipV1` marker, or an authenticated rebuild
skip record.

## Retention, Deletion, and Reprocessing

Retention is calculated from `accepted_at`, except that derived aggregates and
their replay batches and Query projections use the retention-windowed lifecycle
defined above, and export objects use the `completed_at` lifecycle anchor defined
in the Export Contract. Export-object retention is the earlier of the seven-day
default and the active export-object policy cutoff computed from `completed_at`.
A thirteen-month lifecycle is computed in UTC calendar
arithmetic: add thirteen to the UTC year/month, preserve the UTC day, clock
time, and nanoseconds when valid, and clamp an otherwise invalid day to the
last day of the target month. It is not a fixed day count. Processor, Query,
Jobs, API restore cleanup, and every other owner use this same function; an
item expires when the current UTC instant is at or after its computed cutoff.
For each data class, the effective cutoff is the earlier of that class's
default lifecycle cutoff and the cutoff computed from the active project policy
using the class's lifecycle anchor. The exception is a verified normalized
representation supporting a handoff whose raw state may retire: its effective
cutoff is the later of that class cutoff and the applicable raw-retention
cutoff, so a project policy cannot remove the only eligible reprocessing source
before the raw-retention floor. A project policy can only shorten a class's
default lifetime subject to that source-preservation floor and never extend it.
Backup copies of project data may outlive
active-store expiry only as a bounded recovery exception: each expired record
or state item must be purged from backups or made irreversibly inaccessible
within 90 days of its effective expiry. If a newly activated policy makes an
item already past its effective expiry newly ineligible, its backup deadline is
instead `max(effective_expiry, policy_activation_at) + 90 days`, using the
activation timestamp stored with that policy generation. This deadline covers
raw, replay, canonical, derived, projection, and export data; the
restore-independent retention-policy and deletion-tombstone registries follow
their stated 13-month lifecycle. Restores
must not reintroduce expired or deleted data and must reapply current registry
fences before readiness. Authorized project administrators may shorten a project
retention policy but may not extend it through this contract. API assigns every
project policy a strictly monotonic generation and records each requested
versioned shortened-duration policy in a pending state in its restore-independent
retention-policy registry, including its policy activation timestamp after
activation. Lifecycle mutations use a prepare/activate barrier, and
`LifecycleMutationV1` carries the complete immutable proposed policy, its
per-class proposed cutoffs, and a policy digest so every owner can install the
same pending fence without resolving an unavailable registry record.
During prepare, Ingest, Processor, Query, and Jobs durably retain the highest
prepared generation, ignore lower-generation deliveries, and install only
non-destructive pending fences. A pending fence may reject new admission, read,
processing, export, or rebuild work that would violate the proposed cutoff or
deletion scope, but it must not execute the pending mutation's purge,
anonymization, raw retirement, or aggregate-contribution destruction. Previously
active baseline and retention-policy schedules continue to enforce their own
effective cutoffs during a stalled prepare. Each owner sends the versioned
`LifecyclePurgeRegistrationV1` handoff to Jobs with
`registration_phase=prepare`, its owner, mutation kind, authorized scope,
generation, affected data classes, correlation identifier, and idempotency key.
Jobs durably returns the matching `purge_registration_id` in `paused` state,
and the owner persists that registration reference with its pending fence before
returning a matching `LifecycleMutationAcknowledgementV1` with
`phase=prepared`. Jobs handles its own local registration in the same durable
operation. Every durable purge registration has a `purge_registration_id` that
is a canonical lowercase UUID v7 at component boundaries and a PostgreSQL
`uuid` in Jobs state.

After every required prepared acknowledgement arrives, API atomically commits
the matching active policy or tombstone generation and sends the activate phase.
Each owner then resends `LifecyclePurgeRegistrationV1` with
`registration_phase=activate` and the generation-matched
`purge_registration_id`. Jobs transitions that paused registration to
`active`, enables the schedule, and returns the matching active state; Jobs
performs the same transition for its local registration. Only after that
acknowledgement may an owner report `phase=active` or perform irreversible
retention or deletion work. API reports successful mutation only after every
required active acknowledgement confirms the matching generation, installed
fence, and enabled purge registration. If preparation or activation is
incomplete, the durable mutation remains `accepted_pending` and is retried;
API does not return a failed outcome after a destructive effect could have
started. A pending or active mutation still fails closed for dependent API
operations until the required owner acknowledgements exist.

After activation, each owner computes the earlier of its class-default cutoff
and project-policy cutoff from current time whenever enforcing admission, read,
processing, replay, export, or rebuild behavior. Ingest stops admitting excess
records and serving excess raw data, Processor durably fences queued,
pending-handoff, and replayed work whose `accepted_at` falls outside the new
limit, prevents canonical or derived publication, and recomputes or removes
derived results with expired contributions, and Query denies excess reads,
exports, and rebuilds. Before API marks a shortened policy active, it identifies
every export whose requested range or selected source would cross the new cutoff
and every completed artifact whose effective export-object cutoff moves earlier.
Affected non-terminal exports advance to `canceled` with a new
`export_revision` and use the existing revision-fenced `ExportCancellationV1`
path with `cancellation_reason=retention_policy`. An affected successful
`completed` export whose selected source is no longer eligible advances to
`expired` with a new `export_revision` even when its export-object cutoff is
still in the future. The same terminal transition applies when its effective
export-object cutoff has passed. API publishes the existing
Query artifact invalidation and waits for Query to make the artifact
inaccessible before policy activation completes. Only a completed artifact
whose selected sources remain eligible and whose shortened export-object cutoff
remains in the future receives an idempotent updated `ExportExpiryScheduleV1`
handoff before activation. Jobs cancels and
fences non-terminal execution state, Query installs the matching terminal
execution fence or artifact invalidation, and API does not complete policy
activation or release any held revision until the required acknowledgements
and normal hold-release command are durably accepted. Processor returns a durable
`RawHandoffDispositionV1`
message with a terminal
`policy_rejected` disposition for each handoff rejected by the shortened policy;
for an unprocessed handoff that crosses the seven-day class default without a
shortened policy, it returns `default_expired` with
`expiry_basis=class_default` and no retention-policy generation. If that cutoff
arrives while Processor is unavailable, Jobs sends the versioned
`RawRetentionExpiryV1` project-scoped sweep to Ingest. Ingest verifies the
current cutoff, enumerates its own eligible acceptance state, durably records a
`default_expired` fence for each handoff, retires each matching outbox entry,
and purges the raw object and acceptance metadata without waiting for
Processor. `RawPayloadFetchV1` and late Processor dispositions reject a handoff
already fenced by Ingest expiry. When Ingest records that fence, it also emits
the durable project-scoped `RawHandoffExpiryFenceV1` to Processor. Processor
persists the highest fence for the handoff and performs an authoritative
current-cutoff and local-fence check immediately before committing or
publishing any canonical or derived result. A denied final check records the
appropriate terminal disposition and cannot publish canonical changes. Jobs
owns a durable recurring
baseline lifecycle-purge registration for every applicable project and data
class, even when the project keeps the default policy. Project creation causes
API to run the generation-matched `project_create` lifecycle barrier: each
applicable data owner submits an idempotent baseline
`LifecyclePurgeRegistrationV1`, Jobs returns and persists an active registration,
and API exposes the project only after every owner acknowledges the active
barrier. A
shortened policy or project deletion adds a generation-scoped registration; its
schedule is paused during prepare and enabled only after the activation
handshake. Jobs owns scheduling and retrying each purge dispatch at the
effective cutoff. At that cutoff, the data owner fences access and removes or
irreversibly anonymizes active data; retries are recovery mechanics and do not
create a 14-day grace period. For derived aggregates, the baseline schedule
recomputes or removes expired contributions and publishes the resulting
revisioned state so Query projections cannot retain dormant expired data. Before any restored or
rebuilt Ingest,
Processor, Query, or Jobs owner becomes ready, it obtains current retention-policy
and deletion-tombstone registry snapshots from API through the versioned
`ControlRegistrySnapshotV1` handoff defined in the component contract, persists
them before readiness, and enforces them. Each data owner reapplies its effective
cutoff and fences excess data; Jobs restores the associated baseline, policy,
and deletion scheduling and fences. Before a restored or rebuilt Processor or
Query owner becomes ready, it also obtains its owner-scoped export-fence
snapshot from the same handoff. The snapshot contains the current desired
export holds and unresolved terminal fences for completed, failed, canceled,
and expired exports, their export and held/terminal revisions, registry
generation, and integrity digest. For completed exports it also contains the
restore-independent recovery copy of Query's materialization metadata:
manifest content and digest, artifact object references and digests, complete
watermark vectors, and `snapshot_generation`. This copy is recovery evidence,
not a second Query authority.
The owner persists the snapshot, reconciles its local inventory, installs every
missing desired hold or terminal fence, and removes or releases only state
authorized by the current snapshot. Query durably installs a terminal
execution fence before releasing its projection hold. A snapshot mismatch,
missing owner acknowledgement, or unavailable API keeps the restored owner
unready and retryable. API's `ExportHoldInventoryV1` reconciliation after an
API database restore remains in addition to this owner-store recovery path.
Before a restored or rebuilt Jobs owner becomes ready, it reconciles its local
baseline registrations against the active-project inventory returned by
`ControlRegistrySnapshotV1`, recreating missing registrations idempotently for
every applicable project and data class, including projects with the default
policy. It then restores the associated policy and deletion scheduling and
fences. There is no cold archive.

Project deletion is project-wide and uses the same prepare/activate barrier. API
records a versioned deletion generation and keyed project tombstone in a pending
state in its append-only restore-independent registry. Each owner installs a
pending project fence before returning `phase=prepared`: Ingest rejects new
collection and pending raw handoffs, Processor rejects new pending or replayed
work and republishing, Query rejects new reads, restoration, exports, and
projection rebuilds, and Jobs fences new non-purge work. A pending deletion
registration does not dispatch deletion-specific purge or anonymization during
prepare; previously active baseline and retention-policy schedules continue to
enforce their own effective cutoffs. After API commits the active tombstone,
Jobs enables the versioned project-purge schedule and dispatches it; Ingest,
Processor, Query, and Jobs return `phase=active` acknowledgements after the
active fence and purge registration are installed. API fails closed until the
complete active barrier exists. Jobs cancels and fences queued, retry,
dead-letter, dispatchable, leased, and in-flight non-purge project work,
dispatches idempotent owner-specific purge or anonymization commands, retries
them until completion, and rejects late non-purge execution outcomes so they
cannot recreate project-scoped execution state. Query invalidates cache entries
immediately. Active stores, including raw, canonical, derived, projections,
replay batches, export objects, and Jobs project-scoped operational state, are
purged or irreversibly anonymized within 14 days. Jobs retains only the minimal
tombstone-keyed deletion orchestration needed to address outstanding owner
purges: the target owner, registration, retry, and completion state contain no
customer payload and survive the 14-day active-store deadline until every
owner confirms completion. Jobs then purges or irreversibly anonymizes that
orchestration state. Backups are purged within 90 days of deletion, and deleted
project data is not restored from a backup. Before
a restored API database accepts traffic, API loads the current registry and
reapplies every current tombstone to identify, fence, and purge deleted-project
rows. While deletion is pending, API retains every active and effective
retention-policy registry version for the project so restored owners can enforce
the shortened cutoff. Only after the tombstone is active and the required purge
activation acknowledgements are complete may API irreversibly remove those
project policy versions. API retains the non-customer-readable registry tombstone
for 13 months. Audit rows remain append-only and are never updated or deleted:
their actor or workload identity, tenant/project context, action, and target
resource are encrypted under an erasable project-scoped context key, and
deletion irreversibly destroys that key. Only irreversible minimal evidence
remains available after project deletion: deletion timestamp, result,
correlation ID, and the keyed tombstone, without tenant-identifying or
customer-payload content.

Every `accepted_at` range is half-open, `[start, end)`: `start` is inclusive and
`end` is exclusive. This convention applies to reprocessing, retention
enforcement, export holds and execution, projection rebuilds, manifests, and
every related message or query. A record whose `accepted_at` equals `end` is
outside the range, and adjacent ranges do not overlap. Reprocessing is bounded
by project and `accepted_at` range. Each attempt records
source data class, source and target schema or normalization versions,
processor release, request or job identity, correlation ID, checksums, counts,
and outcome. Raw data is the preferred source for ranges within the project's
applicable raw-retention window, which is seven days by default, when raw state
is still retained. If Ingest retired raw state after a completed handoff, the
eligible verified normalized replay representation is a valid source even
before that cutoff; after the cutoff, it is the source. A range without either
an eligible raw source or a verified normalized replay representation is
rejected rather than reprocessed from an unverified or unavailable source.

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
project-scoped S3 export prefix. Before requesting a hold, API durably records
an export-hold intent in its restore-independent `API export hold registry`.
The registry is append-only, keyed by `export_id` and held
`export_revision`, and records the authorized scope, requested range, selected
signals, every hold, cancellation, release, and completion/expiry intent, and
the corresponding owner acknowledgements. At export
creation, API sends Processor an
authenticated, versioned `ExportSnapshotHoldInstallV1` request containing
`export_id` and `export_revision`, authorized tenant and project scope,
`accepted_at` range, selected signals, and whether derived results are selected.
Processor atomically installs the export-scoped hold and returns a correlated,
versioned response with complete watermark vectors. The canonical vector is
keyed by every requested Processor change partition and contains that
partition's monotonic sequence. The selection vector is keyed by every
requested canonical `(partition, watchtower_id)` record and contains its
monotonic `selection_revision` and selected `processing_generation`. Processor
holds promotions affecting those records until the export hold is released, so
the selected generation cannot change after the vector is captured. The derived
vector is keyed by every requested fully qualified aggregate key and contains
that aggregate's `authoritative_revision`; an aggregate with no eligible state
has an explicit empty revision entry. Entries from different partitions,
records, or aggregates are never compared as one global order, and a response
missing any requested entry is invalid. API persists the exact vectors and the
earliest effective expiry among all held canonical rows, selection entries, and
derived contributions, and sends them only in the durable scheduling request to
Jobs. The hold-install response has an explicit optional source-expiry value: it
is absent when the requested snapshot has no eligible canonical rows, selection
entries, or derived contributions. API records a present source-expiry deadline
in the hold registry and uses the versioned `ExportExpiryScheduleV1` handoff
with `expiry_basis=source_retention`; it omits that source-retention schedule
when the value is absent. The ordinary completed-object expiry schedule remains
required for every successful export. Jobs schedules an idempotent
`ExportExpiryV1` delivery for a present source deadline. For a non-terminal
export, API treats that delivery as source-retention expiry, appends a
cancellation intent, advances the export revision, and follows the existing
revision-fenced cancellation and hold-release path. API also rejects a successful
Query completion outcome received at or after the persisted source-expiry
deadline, regardless of delivery order or whether the delayed expiry message has
arrived; it uses the same source-expiry cancellation and fencing path. Jobs
durably owns the
export schedule, lease, retry, and cancellation state, then dispatches a
revision-fenced `ExportExecutionV1` command to Query carrying the
API-persisted vectors, authorized scope, range, selected signals, and
`export_revision`. Query does not execute an export from a direct API dispatch
or infer an authoritative watermark from its local projection.

When API records cancellation, including cancellation caused by ordinary source
expiry or an activated shortened retention policy, it sends the revision-fenced
`ExportCancellationV1` command to Jobs with the held and terminal export
revisions and the cancellation reason. Jobs durably cancels and fences queued, leased, retry, and in-flight
execution state, then sends Query a matching
`ExportExecutionCancellationV1` terminal fence. Query persists the fence before
acknowledging it and rejects stale or post-terminal `ExportExecutionV1`
commands. API does not release the held revision until Jobs and Query confirm
the cancellation fence.

When Query emits a terminal `failed` outcome, API appends a failure intent to the
restore-independent hold registry and sends a revision-fenced `ExportFailureV1`
command to Jobs containing the held and terminal export revisions, failure
reason, authorized scope, correlation identifier, and idempotency key. Jobs
durably fences queued, leased, retry, and in-flight execution state and
acknowledges the terminal failure before API releases the held revision. Query's
failed terminal fence continues to reject stale or post-terminal
`ExportExecutionV1` commands.

Before Query may materialize an export, Processor's
`ExportSnapshotHoldInstallV1` response and the Jobs-to-Query
`ExportExecutionV1` command durably establish export-scoped holds for the
requested inputs and exact watermark vectors. Each hold is keyed by `export_id`
and `export_revision`, covers every selected canonical partition, selection
vector entry, or derived aggregate and the Query projection, and remains until
the export reaches a terminal state or its earliest held-source effective
cutoff. The source-expiry schedule must revision-fenced-cancel a non-terminal
export by that cutoff; a hold is never permitted to retain an expired source.
Processor and Query report their held
`(export_id,
export_revision)` inventory through the authenticated versioned
`ExportHoldInventoryV1` reconciliation interface. Query records
an immutable `snapshot_generation` only after every
canonical vector sequence, selection revision and generation, and derived
aggregate revision is materialized at the requested target.
`snapshot_generation` is a Query-created canonical lowercase
UUID v7 at external and component boundaries and is stored as PostgreSQL `uuid`
in Query's owned PostgreSQL export-metadata boundary. If a hold cannot be
installed or any vector member can no
longer be materialized, Query emits a terminal `failed` outcome and no partial
artifact; it never silently omits records present at request creation. After
all requested vectors are complete, Query emits a versioned export outcome
containing `export_id`, `export_revision`, outcome, manifest, vectors, and
`snapshot_generation`; API alone records the resulting lifecycle transition and
publishes the terminal `ExportSnapshotHoldReleaseV1` command to Processor and
Query. The release contains both the `held_export_revision` used to key the
installed hold and the current terminal `export_revision`, so cancellation can
advance the API revision without losing the old hold key. The release is
idempotent and revision-fenced, and remains durably retryable until both owners
confirm it. Before API persists a terminal lifecycle transition or dispatches
its corresponding cleanup command, it appends an immutable terminal intent to
the restore-independent hold registry. A cancellation intent precedes
`ExportCancellationV1`; a failure intent precedes `ExportFailureV1`; a release intent precedes
`ExportSnapshotHoldReleaseV1`. Before API commits a successful `completed`
transition, it appends a completion/expiry intent containing the authoritative
`completed_at`, export revision, effective export-object expiry deadline,
desired `ExportExpiryScheduleV1` handoff, and a recovery copy of Query's
materialization metadata: manifest content and digest, artifact object
references and digests, complete watermark vectors, and
`snapshot_generation`. Each intent records the desired action, held and terminal
revisions, terminal outcome or cancellation reason, source-expiry deadline and
basis when present, authorized scope, correlation identifier, and idempotency
key. API appends the owner
acknowledgements only after the corresponding durable responses. After an API
database restore, API loads that registry before accepting traffic, treats each
unresolved terminal intent as the desired state, reconciles the owner hold
inventories, and retries the matching install, cancellation, release, or
expiry-schedule command. A hold or expiry schedule cannot be treated as
orphaned merely because it is absent from the restored PostgreSQL backup.
Terminal tombstones remain in the restore-independent registry through the
restore horizon for backups that may contain non-terminal state. Before traffic
is accepted, API applies each tombstone to the restored export state, preventing
status regression or redispatch at a lower revision. Query
installs or verifies the terminal execution fence before
releasing its projection hold, so a delayed execution command cannot recreate a
hold or artifact after the terminal transition. The manifest records the complete
vectors and Query `snapshot_generation`. Exports never include raw data, caches,
or audit records.

An export contains Parquet data and a JSON manifest with the schema version,
authorized scope, selected signals, `accepted_at` range, object sizes, and
SHA-256 checksums. For every Parquet object, the manifest also records a row
count and deterministic reconciliation summaries: ordered Watchtower-ID,
processing-generation, canonical-content-digest, and correlation-ID digests
where those fields are represented. For derived rows, it records an ordered
digest of aggregate keys,
authoritative derived revisions, selected aggregate state, and deterministic
selected-canonical-source-set digests at the corresponding derived watermark
vector entries. For canonical rows, the manifest additionally records the
deterministic digest of the authoritative default-generation selection at the
corresponding canonical and selection vector entries; every exported canonical
row must match that selection and its captured `selection_revision`.
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
artifact when cancellation is fenced. When API persists a successful
`completed` transition, it sends Jobs an idempotent `ExportExpiryScheduleV1`
request with `expiry_basis=export_object` containing the export ID, current
export revision, authoritative `completed_at`, and the effective export-object
expiry deadline. The deadline is
the earlier of `completed_at + 7 days` and the active export-object policy
cutoff, using `completed_at` as the export-object lifecycle anchor. Jobs
persists that timestamp and schedules the idempotent `ExportExpiryV1` handoff
for exactly that deadline. API authoritatively
transitions a still-completed export to `expired`, advances its revision, and
publishes the invalidation to Query even if the artifact has already become
inaccessible. Query invalidates the artifact and rejects every expired download.
API records `completed_at` as the canonical UTC timestamp at which it persists a
successful `completed` transition, and export objects are retained
until the earlier of seven days from that timestamp and the active export-object
policy cutoff computed from that timestamp, independent of the records'
`accepted_at` values. API rechecks authorization immediately before requesting a Query-owned
authorized download-gateway URL of up to one hour, capped at the export object's
remaining retention lifetime; it then calls Query's authenticated internal issuance
interface with the authorized actor, action, project, export context, and capped
lifetime. Query independently validates the caller, current authorization
projection, export ownership, and lifecycle state before issuing the opaque
gateway URL and again for every download request; the URL expiry never exceeds
object expiry. For immediate revocation, API and Query use a synchronous
revision-fenced handoff: every issued URL carries the API authorization
revision, and API waits for Query to durably install an
`AuthorizationRevocationFenceV1` revision before acknowledging an actor,
project, or export revocation. Query rejects every affected native and
compatible admission, read, provider/index, cache lookup, cache use, issuance,
or download whose authorization revision is at or below the installed fence
until the matching security projection revision is installed, regardless of
asynchronous projection freshness. API never accesses Query object storage or
signing credentials, and gateway URLs never grant direct object-store access.
The URL is never issued for a deleted, unauthorized, revoked, or expired export.
Deletion cancels active exports and revokes issued download access. Any attempt
that terminates without successful `completed` prevents publication of
incomplete results, fences late writes, and removes or invalidates all partial
objects at terminal transition; only a successful artifact uses the seven-day
lifecycle anchored at `completed_at`.

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
Before any digest is computed, every timestamp value is normalized to the exact
UTC nine-fractional-digit `...Z` representation defined in the canonical model,
and every finite float equal to zero is normalized to `+0.0`.
For every canonical row, `canonical_content_digest` is lowercase hexadecimal
SHA-256 over the RFC 8785 canonical-JSON encoding of the complete typed
canonical record, including common fields, signal-specific fields, and
extension attributes, but excluding storage-engine metadata, reconciliation
metadata, and the digest itself. Every authoritative canonical row, replay
copy, Query projection row, and exported canonical row carries or deterministically
recomputes the same content digest.
The digest projection uses an explicit type tag for every extension value:
scalars use `{"type": "integer", "value": 1}` or the corresponding `null`,
`boolean`, `string`, or `float` type; homogeneous arrays use
`{"type": "array", "item_type": "integer", "value": [...]}`. Consequently,
an integer-valued float such as `1.0` retains `type=float` in the digest
projection and cannot collide with an integer `1`; the numeric value is still
encoded with RFC 8785 canonical JSON. This tagged representation is identical
across authoritative storage, replay, Query projections, and exports.
The required tuples are `{"watchtower_id": ...}` for raw acceptance and
handoff; `{"watchtower_id": ..., "processing_generation": ..., "canonical_content_digest": ...}`
for canonical history, replay, Query projections, and default-generation
selection; canonical export tuples additionally include `"selection_revision"`.
That identity tuple plus `"correlation_id"` is used for
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
customers and Query; automated processing may access them only through the
authenticated owner-mediated Ingest-to-Processor boundary, and Processor never
reads Ingest object storage directly. Approved, time-limited, audited operator
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
digests at matching canonical vector entries. Derived projections and exports
compare the selected aggregate state, aggregate revisions, and retention-windowed
source set at matching per-aggregate derived vector entries; no scalar revision
is used to claim cross-aggregate completion.
Correlation-ID digests are compared only for represented records in the same
dimension. A mismatch is not silently repaired or treated as successful
completion.

Immutable audit events are required for break-glass access, exports, deletion,
restoration attempts, reprocessing, retention changes, and key, replication,
backup, or restore actions. API remains the contract-level audit writer;
component logs and Jobs execution history do not replace the audit boundary.
Before committing an audit event in its PostgreSQL boundary, API durably
appends the same immutable event, its audit sequence, and its integrity digest
to the restore-independent encrypted S3 audit journal. The journal entry is a
durable event intent and replay boundary, not a second audit writer. API then
commits the matching PostgreSQL row and acknowledges the event only after both
boundaries are durable; recovery reconciles an entry that spans the commit
boundary idempotently. After an API PostgreSQL restore, API reconciles the
restored rows with journal entries after the selected backup, replays missing
events idempotently, and records the recovery evidence before accepting traffic.
Project-scoped audit context is erasable encrypted context:
deletion destroys its project key while preserving the append-only event rows,
journal replay records, and minimal anonymous deletion evidence.

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
   without Watchtower ID collision or cross-tenant disclosure; verify project and
   Watchtower IDs use the canonical UUID v7/PostgreSQL `uuid` representation and
   reject out-of-range extension integers and non-finite extension floats before
   canonicalization; verify tagged integer and finite-float values produce
   different canonical-content digests even when their numeric values compare
   equal; normalize signed zero to `+0.0`; normalize equivalent timestamp
   spellings to the exact nine-digit UTC `Z` representation before digesting.
2. Fail S3, PostgreSQL, ClickHouse, and MSK operations before and after local
   commits; verify no false successful acceptance and idempotent recovery,
   including Processor canonical staging before and after ClickHouse commit and
   outbox publication, with no duplicate or conflicting sequence, and verify an
   expired staged write publishes an idempotent `CanonicalChangeSkipV1` marker
   so no available watermark gap blocks later changes.
3. Verify raw-object immutability, SHA-256 and size reconciliation, required
   MSK durability and seven-day default retention settings, shortened-policy
   enforcement without allowing a project duration to extend a shorter class
   default, normalized-source retention through the applicable raw cutoff
   before raw retirement, redelivery of unprocessed work after the MSK window expires, the
   `default_expired` disposition for an unprocessed handoff beyond the class
   default, the project-scoped Jobs-to-Ingest `RawRetentionExpiryV1` sweep
   during Processor outage, Ingest enumeration of expired state, rejection of
   late fetches or dispositions after the Ingest expiry fence, durable
   `RawHandoffExpiryFenceV1` delivery, and Processor's final cutoff/fence check
   before canonical commit and publication, and
   generation-aware reconciliation of each completed handoff to a promoted
   canonical default or durable terminal disposition before raw retirement.
4. Rebuild eligible canonical and derived Query projections through an
   authorized, durably acknowledged Query-to-Processor `ProjectionRebuildV1`
   request and Processor republishing without direct Processor storage access;
   verify that the canonical lowercase UUID v7 `rebuild_id` is persisted as
   PostgreSQL `uuid` in Processor's durable request and idempotency state, that
   canonical replay copies remain non-authoritative, use bounded expiry buckets
   with exact per-item cutoffs and explicit deletion/rollover behavior,
   reconcile to their represented canonical versions, and reject a
   changed non-key canonical field when its identity pair is unchanged; verify
   that each requested canonical partition receives a matching
   `ProjectionRebuildBaselineV1` marker before its first retained sequence,
   accepts a first sequence greater than one without a false gap, emits
   contiguous authenticated `ProjectionRebuildSkipV1` coverage only for
   retention-excluded interleaved sequences, live `CanonicalChangeSkipV1`
   coverage for an expired staged sequence, writes every eligible row before
   advancing the global checkpoint, leaves that checkpoint unchanged for an
   incomplete subrange request, and fails safely when coverage is missing,
   stale, or mismatched.
5. Create a project through the generation-matched `project_create`
   `LifecycleMutationV1` barrier and verify it remains unavailable until every
   applicable owner has an active baseline Jobs registration and matching
   acknowledgement. Shorten retention and delete a project; verify each owner
   receives the complete proposed policy and uses the versioned
   `LifecyclePurgeRegistrationV1` handoff and cannot return a prepare
   acknowledgement until its matching paused Jobs registration is durable,
   require each owner to activate that registration with Jobs before returning
   `phase=active`, install only non-destructive pending fences, activation
   commits the barrier before any purge or anonymization, and an unavailable
   owner leaves the mutation durably `accepted_pending` rather than failing
   after destructive work starts; while deletion remains `accepted_pending`,
   verify previously active baseline and retention-policy schedules continue
   enforcing their effective cutoffs while deletion-specific purge remains
   paused; verify canonical lowercase UUID v7
   `purge_registration_id`
   values and PostgreSQL `uuid` Jobs state; fencing of
   pending, handoff, replayed, queued, retry, dead-letter, dispatchable, leased,
   and in-flight work; rejection of late execution outcomes; terminal disposition
   and retirement of policy-fenced raw handoffs; derived-aggregate recomputation
   without expired contributions; UTC thirteen-calendar-month arithmetic with
   end-of-month clamping; current-time duration enforcement; baseline
   Jobs schedules for default lifecycles even without a shortened policy;
   recurring Jobs-scheduled, owner-run active purges at each effective cutoff
   without a grace period; retention of minimal tombstone-keyed Jobs deletion
   orchestration until every owner confirms purge completion;
   purge or irreversible anonymization of Jobs project-scoped operational state
   after the minimal tombstone-keyed deletion orchestration completes;
   backup purge or irreversible inaccessibility within 90 days of each applicable
   expiry, including the activation-relative deadline for data made newly
   ineligible by a shortened policy; retention of the active project policy
   until tombstone activation and only then its removal; restore-independent
   retention, tombstone, API audit-intent, API audit-journal, and export-hold/
   expiry-intent registry recovery before any restored or rebuilt owner accepts
   traffic; verify restored Processor and Query owners also reconcile their
   owner-scoped export holds and completed, failed, canceled, and expired
   terminal execution fences from the API registry snapshot before readiness,
   including Jobs rebuilding a missing
   default-policy baseline registration from the active-project inventory;
   shortened-retention activation must expire and revoke every still-downloadable
   completed export whose selected source or export-object cutoff crosses the new
   cutoff before the policy becomes active, and must reschedule artifacts whose
   future export-object deadline moves earlier;
   export cancellation; cache
   invalidation; generation-matched
   `LifecycleMutationAcknowledgementV1` outcomes; durable audit intent before a
   required audited action and correlated outcome evidence after a crash;
   append-only audit rows with irreversibly destroyed project context; and
   minimal anonymous evidence.
6. Export permitted signals and verify Parquet output, manifest checksums, row
   counts, independently recomputable canonical digest tuples, generation-aware
   canonical-content and per-aggregate revision-aware derived reconciliation
   summaries, default-generation selection, API-to-Processor correlated
   `ExportSnapshotHoldInstallV1` request/response with complete canonical
   partition-sequence, per-record selection-revision, and derived watermark
   vectors, promotion fencing for held selections, API-to-Jobs scheduling,
   `ExportCompletionV1` terminalization of Jobs execution before API exposes
   completion or schedules object expiry,
   Jobs-to-Query
   revision-fenced execution with the returned vectors, export snapshot holds
   through terminal completion, safe failure when any held vector member cannot
   be materialized, `ExportSnapshotHoldReleaseV1` delivery after completion,
   failure, and cancellation, Query-to-API versioned completion outcomes and
   API-only lifecycle persistence, rejection of stale outcomes after
   cancellation or another terminal transition, release of the originally held
   revision when cancellation advances the export revision, the API-to-Jobs
   `ExportCancellationV1`, `ExportFailureV1`, and
   `ExportExecutionCancellationV1` terminal fences,
   `ExportExpiryScheduleV1` handoff carrying an explicit expiry basis,
   absent source-expiry for an empty export with no source-retention schedule,
   authoritative `completed_at` for completed artifacts, the
   restore-independent completion/expiry intent, source-expiry cancellation at
   the earliest held-source cutoff, rejection of completion outcomes at or
   after that persisted source deadline regardless of delivery order,
   Jobs-scheduled artifact expiry at the
   earlier of `completed_at + 7 days` and the export-object policy cutoff, and
   the authoritative API `expired` transition,
   early `expired` transitions and Query invalidation for completed artifacts
   fenced by a shortened retention policy, terminal cancellation and release
   intents persisted in the restore-independent hold registry before command
   dispatch, replay of unresolved hold and expiry intents after an API backup
   restore, retention of terminal tombstones through the restorable-backup
   horizon, rescheduling when the export-object cutoff shortens, and
   invalidation when that cutoff has passed,
   Query-owned PostgreSQL export metadata, restore reconciliation of completed
   manifests, artifact references, vectors, and `snapshot_generation`, and
   owner-startup reconciliation of Processor and Query hold/fence inventories
   before readiness, Query-issued
   URLs no longer than their remaining object lifetime and
   object expiry anchored at `completed_at`, immediate cleanup of failed or
   canceled partial objects, revision-fenced authorization revocation across
   native/compatible reads and caches as well as downloads, authorization
   recheck, rate limits, and oversized-request
   `resource_exhausted` behavior.
7. Reprocess a successful and a partially failed `[start, end)` range; verify
   that records exactly at `end` are excluded and adjacent ranges do not
   overlap; verify provenance,
   distinct processing generations, full-range promotion, preservation of the
   prior default result, ordered per-record selection revisions with stale
   delivery rejection, selection-state recovery and republishing after a
   Processor rebuild, generation-aware cross-stage reconciliation, derived
   aggregates exclude candidate generations, consistent derived-aggregate
   lifecycle anchors after later contributions, and rejection of lower or
   conflicting equal derived-aggregate revisions; reject a corrupted or truncated
   normalized or enriched processing-input replay batch before reprocessing or
   canonical publication; and successfully reprocess a record through its
   verified normalized replay representation after raw state was retired before
   the seven-day cutoff.
8. Attempt cross-tenant access through PostgreSQL, ClickHouse, S3, MSK,
   projections, exports, and break-glass workflows; verify denial and required
   audit evidence.
9. Verify that production and non-production accounts, stores, keys,
   credentials, and data paths remain separate.
10. Trigger accepted-data-loss, unrecoverable-handoff, tenant-isolation,
    deletion-deadline, and reconciliation failures; verify the required page,
    alert, and escalation behavior.
