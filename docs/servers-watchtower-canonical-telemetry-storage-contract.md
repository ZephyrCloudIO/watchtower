# Watchtower Canonical Telemetry and Storage Contract

## Scope and Authority

This contract defines the protocol-neutral canonical telemetry model, storage
topology, ownership, lifecycle, recovery, isolation, and export boundaries for
Watchtower. It is documentation only; it does not create services, schemas,
migrations, buckets, topics, adapters, jobs, routes, or deployment resources.

The project boundary is authoritative for Watchtower product ownership, the
component contract is authoritative for component boundaries and dependency
direction, and the runtime contract is authoritative for shared runtime and
message behavior. This contract refines those decisions only for canonical
telemetry and its owned storage. A component must not bypass the owner defined
by the component contract through direct persistence access.

External protocol adapters may accept or emit protocol-specific shapes, but
those shapes remain compatibility data at the boundary. Canonical Watchtower
records are independent of Sentry, OpenTelemetry, Prometheus, Loki, Tempo, or
any other external wire format.

## Contract Invariants

- Error occurrences, metric points, log records, and spans have separate
  physical canonical schemas. There is no generic physical event table.
- Every authoritative data class has one writer, one authority, an explicit
  lifecycle, and one component-owned storage boundary.
- Every canonical record is scoped by `tenant_id` and `project_id` and carries
  a Watchtower-owned canonical identifier. External protocol identifiers never
  become Watchtower primary identifiers.
- Ingest owns durable raw acceptance and handoff. Processor owns canonical
  processing and derived aggregates. Query owns projections and caches. API
  and Jobs own their operational state. No component writes another component's
  store.
- Delivery is at least once and consumers are idempotent. There is no global
  ordering guarantee. An ordering guarantee may be introduced only by a
  signal-specific contract for an explicitly scoped aggregate partition.
- Canonical and message timestamps are UTC RFC 3339 values with nanosecond
  precision. Source timezone strings are compatibility metadata only.
- Raw customer payloads, credentials, private keys, bearer tokens, opaque
  session material, and unrestricted payloads must not be logged or placed in
  canonical, message, audit, or export records.

## Canonical Record Model

### Physical signal schemas

Processor owns four independent physical canonical schema families:

| Signal | Physical schema family | Owning contract for signal semantics |
| --- | --- | --- |
| Error occurrence | Error-occurrence records | #19, error intelligence and issue lifecycle |
| Metric point | Metric-point records | #23, metrics ingestion, storage, and querying |
| Log record | Log-record records | #24, log ingestion, storage, and querying |
| Span | Span records | #25, tracing and application performance monitoring |

Each family has signal-specific fields and semantics defined by its owning
downstream contract. The four families share the common identity, timing,
context, version, provenance, and extension rules below, but they are not
combined into one physical table or one generic payload column.

### Required identity and timing

Every raw acceptance metadata record and every canonical signal record has the
following required identity and timing fields:

| Field | Contract |
| --- | --- |
| `tenant_id` | Authorized tenant identity. It is mandatory in storage keys, message context, authorization context, and query filters. |
| `project_id` | Authorized project identity within the tenant. It is mandatory in storage keys, message context, and query filters. |
| `watchtower_id` | Watchtower-generated lowercase UUID v7 canonical record identifier. It is generated at Ingest acceptance, preserved by Processor through normalization and enrichment, and reused by Query projections. It is unique across all tenant and project scopes; external IDs cannot supply or replace it. |
| `accepted_at` | Immutable UTC RFC 3339 timestamp with nanosecond precision set when Ingest durably accepts the record. Retention and lifecycle deadlines are calculated from this value. |
| `observed_at_status` | Required tagged value: `present` or `not_applicable`. |
| `observed_at` | Required UTC RFC 3339 nanosecond timestamp when `observed_at_status=present`; absent when the status is `not_applicable`. No epoch, zero timestamp, or ambiguous null represents not-applicable. |
| `schema_version` | Immutable canonical physical-schema version. A new version produces a new versioned result; it mutates no prior canonical result. |
| `normalization_version` | Immutable Processor normalization version used for the record. |

When a source supplies no meaningful observation time, the record uses
`observed_at_status=not_applicable` and preserves any source timestamp or
timezone string only as scoped compatibility metadata. A source timestamp that
is present but invalid is not silently converted into a sentinel value; the
normalization contract owns its safe handling and provenance.

`watchtower_id` is the canonical identity for a record, not a protocol event,
trace, span, request, or message identifier. Storage and query paths must
enforce uniqueness across the complete tenant/project identity and must never
use an external identifier without its protocol, namespace, signal, tenant,
and project scope.

### Common typed context

Each signal schema carries the following typed context objects. They are
bounded, named fields rather than arbitrary JSON objects:

| Context | Required shape |
| --- | --- |
| Environment | `name: string` and optional bounded `id: string`. |
| Service | `name: string`, with optional `version: string` and `instance_id: string`. |
| Resource | `type: string` and `name: string`, with optional `id`, `provider`, and `region` strings. |
| Instrumentation scope | `name: string`, with optional `version: string` and `schema_url: string`. |
| Correlation | Optional bounded string fields for request, operation, message, causation, correlation, W3C trace, span, and parent-span identifiers; message identifiers use the UUID v7 envelope type where applicable. |

Correlation values identify relationships and execution context; they do not
replace `watchtower_id`. External trace, span, request, event, and message IDs
are retained only with their protocol and scope so equal external values from
different tenants or protocols cannot collide or become interchangeable.

### Extension attributes

Canonical extension attributes are flat, typed, and namespaced. A key must
identify its owning namespace and use a bounded value from this set:

- null;
- boolean;
- string;
- integer;
- float; or
- a homogeneous array of primitive values of one type.

Nested objects, arbitrary nested JSON, maps, mixed-type arrays, executable
values, and unbounded raw structures are not canonical storage. Raw source
structures remain in the Ingest raw class for their seven-day lifecycle and
are not copied into canonical records. Signal-specific contracts may define
additional fixed fields but may not weaken these extension rules.

## Data Classes and Ownership

The following matrix is authoritative for data-class boundaries. A physical
store may contain multiple component-owned schemas only when ACLs, credentials,
and writers remain exclusive to the listed owner.

| Data class | Sole writer and authority | Storage boundary | Lifecycle and behavior |
| --- | --- | --- | --- |
| Raw accepted records and attachments | Ingest | Ingest-owned encrypted S3 objects plus Ingest-owned RDS acceptance metadata | Immutable UUID v7-keyed objects; seven days from `accepted_at`; inaccessible to customers and Query. |
| Handoff and outbox state | Ingest | Ingest-owned RDS PostgreSQL and Ingest-owned MSK handoff topics | Durable until successfully handed off and reconciled; seven days from `accepted_at`. |
| Normalized canonical records | Processor | Processor-owned ClickHouse signal schema families | Immutable versioned canonical results; 90 days from `accepted_at`; provenance points to the accepted source and normalization version. |
| Enriched canonical records | Processor | Processor-owned ClickHouse signal schema families and Processor processing state in RDS | Immutable versioned results; 90 days from `accepted_at`; enrichment never overwrites the normalized result. |
| Derived aggregates | Processor | Processor-owned RDS PostgreSQL | Mutable Processor-owned aggregates and their operational history; 13 months from `accepted_at`. |
| Compatibility-only data | The external adapter that accepts or emits the protocol shape | Adapter boundary and bounded transient state only; never canonical storage | Exists only for protocol translation, compatibility correlation, or an authorized response; external IDs are not Watchtower authority. |
| Query projections and indexes | Query | Query-owned ClickHouse databases or schemas | Rebuildable, non-authoritative projections; 90 days from `accepted_at`; rebuilt only from Processor-published authorized data. |
| Query cache | Query | Query-owned encrypted cache boundary | Non-authoritative; maximum 15 minutes; invalidated immediately for retention, deletion, and authorization changes. |
| Audit records | API | API-owned append-only PostgreSQL audit boundary | Immutable minimal events for authorization, exports, deletion, restoration, retention, reprocessing, break-glass, and storage-integrity actions; 13 months. Components submit bounded versioned audit notices, but API is the sole writer. |
| API operational state | API | API-owned RDS PostgreSQL boundary | API-owned control-plane and artifact operational history; 13 months unless the owning lifecycle contract requires earlier deletion. |
| Jobs operational state | Jobs | Jobs-owned RDS PostgreSQL boundary | Scheduling, leases, dead-letter, execution, and orchestration history; 13 months. Job retry policy remains #29. |

Audit records contain event type, actor or workload identity reference,
tenant/project scope when applicable, result, timestamp, and correlation ID;
they never contain raw customer payloads or credentials. Platform automation
must produce bounded audit notices for key, replication, backup, and restore
actions through the same authoritative audit boundary.

## Storage Topology and Component Ownership

### Selected resources

Watchtower uses managed RDS PostgreSQL, ClickHouse Cloud on AWS, Amazon S3,
and Amazon MSK in `us-east-1`. RDS and MSK use their selected multi-AZ
deployment characteristics; ClickHouse Cloud uses its selected replicated
deployment; S3 uses Standard durability. This contract makes no cross-region
recovery, RPO/RTO, cold-archive, or scheduled-restore-drill commitment.

Shared infrastructure is permitted only when each component has an exclusive
database or schema, bucket or prefix, topic or topic ACL, workload identity,
and credential set. A shared physical service is not a shared authority.

| Component | Owned resource boundary | Direct access prohibition |
| --- | --- | --- |
| Ingest | Raw S3 objects, raw metadata, acceptance state, attachments, handoff state, and outboxes | No Processor, Query, API, or Jobs writes to Ingest storage. |
| Processor | Canonical signal histories in ClickHouse, processing state in RDS, replay batches in Processor S3, and derived aggregates | No Query read of Processor storage; Query receives authorized republished batches only. |
| Query | Query ClickHouse projections/indexes, Query-owned encrypted cache, and Query export objects | No Query access to raw Ingest objects or Processor S3/ClickHouse persistence. |
| API | Control-plane, artifact, export authorization/status, retention/deletion authority, and audit state in API PostgreSQL | API does not write telemetry or Query persistence. |
| Jobs | Scheduling, lease, dead-letter, execution, and orchestration state in Jobs PostgreSQL | Jobs dispatches versioned commands and never writes domain-owned storage. |

Ingest raw objects use immutable UUID v7-keyed paths under environment,
component, tenant, project, and accepted-date prefixes. Their PostgreSQL
metadata records SHA-256 and byte size. Object replacement is prohibited;
reprocessing creates a new versioned result and preserves provenance.

### Isolation and authorization

- Production and non-production use separate AWS accounts, RDS databases or
  schemas, ClickHouse organizations or clusters, S3 buckets or prefixes, MSK
  clusters or topics, KMS keys, workload identities, credentials, and trust
  roots. Customer data is never copied into non-production.
- All stores use TLS in transit and platform-managed KMS envelope encryption
  at rest. Customer-managed keys are out of scope.
- Every multi-tenant PostgreSQL table uses RLS. ClickHouse uses equivalent
  row policies or isolated schemas. S3 uses environment/component/tenant/project
  IAM prefixes. MSK uses topic and consumer-group ACLs.
- Every authorized read, projection rebuild, export, deletion operation, and
  internal query carries an authorized tenant/project filter. Missing,
  malformed, or broader-than-authorized filters fail closed. A caller cannot
  select tenant or project scope from an external record ID alone.
- Public components perform the initial authorization check and the final data
  owner independently validates tenant, project, actor, action, and resource
  context. Role and credential-lifecycle decisions remain with #15.
- Raw payloads are inaccessible to customers and Query. Automated processing
  may read raw data only through Ingest-owned authorization; approved,
  time-limited, audited operator break-glass access is the only other path.

### ClickHouse layout

Each of the four Processor canonical signal schema families is physically
separate. Canonical histories are partitioned monthly by `accepted_at` and
ordered by:

```text
tenant_id, project_id, signal, observed_at, watchtower_id
```

Query projections use Query-owned physical schemas and may choose additional
projection-specific indexes, but they retain tenant/project scope and the
canonical provenance needed for rebuild and deletion validation.

## Consistency, Handoff, Replay, and Versioning

### Durable acceptance

Ingest acknowledges a successful telemetry write only after a local transaction
has durably established both the raw accepted record and the recoverable
processing handoff/outbox. Acknowledgement does not imply Processor
normalization, ClickHouse visibility, Query projection visibility, or query
readiness. Canonical and Query visibility are asynchronous and eventually
consistent.

The implementation uses local transactions, transactional outboxes, versioned
messages, idempotent consumers, bounded idempotent retry, and reconciliation.
It must not use distributed transactions or best-effort writes across RDS,
S3, ClickHouse, and MSK. A failure before the local commit cannot produce a
successful acceptance; a failure after commit is recovered from the outbox and
reconciled by the owning component.

MSK handoff and canonical-change topics retain messages for seven days and
use replication factor 3, `min.insync.replicas=2`, and producer
`acks=all`. Messages use the common versioned envelope required by the
component and runtime contracts, including tenant/project context, event time,
causation and correlation IDs, W3C trace context, idempotency key, and a
bounded payload or authorized payload reference.

### Replay and rebuild

Processor stores encrypted, project-scoped canonical replay batches in
Processor-owned S3 for 90 days. Query requests a rebuild through an
authorized, versioned Processor interface or message. Processor validates the
project scope, republishes the eligible batch, and Query rebuilds its own
projection idempotently. Query never reads Processor S3 directly.

The replay and rebuild path must preserve tenant, project, `watchtower_id`,
source provenance, schema version, normalization version, and deletion state.
Processor must not republish a deleted project beyond its deletion deadline.
Query must reject or discard late records for deleted projects and must be able
to prove that a rebuild did not retain deleted-project data.

### Version compatibility and reprocessing

Canonical schema versions and normalization versions are immutable. Consumers
support N and N-1 message and schema versions throughout the retained replay
horizon. A new version is promoted only after range-level integrity validation
of counts, UUIDs, checksums, correlation IDs, tenant/project scope, and
provenance succeeds. A failed or partial range leaves the previous default
result active; it is not replaced by an incomplete result.

Raw data may be reprocessed only while the seven-day raw lifecycle remains
active. After raw expiry, authorized reprocessing uses retained safe-normalized
data or Processor replay batches. Every result records its source class,
source version, normalization version, and correlation identifiers. External
historical import is not supported.

## Retention and Project Deletion

Retention is calculated from immutable `accepted_at` and applies consistently
to raw objects, messages, canonical records, projections, aggregates, audit
records, backups, and exports as listed below:

| Data | Default retention |
| --- | ---: |
| Raw payloads, attachments, and handoff state | 7 days |
| MSK handoff and canonical-change messages | 7 days |
| Canonical telemetry, Processor replay batches, and Query projections | 90 days |
| Query cache | At most 15 minutes, with immediate invalidation on lifecycle or authorization change |
| Mutable aggregates and operational history | 13 months |
| Export objects | 7 days |
| Minimal irreversible deletion evidence | 13 months after project deletion |

Authorized project administrators may shorten retention but may never extend
it. A shortened policy immediately hides data beyond the new policy from all
authorized reads and exports, then schedules active-store purge within 14
days. A retention change itself is an immutable audit event.

Deletion is project-wide only. Before deletion acceptance, the system disables
collection, reads, restoration, and exports for the project. Deletion then:

1. invalidates Query caches and cancels queued or running exports;
2. revokes or prevents use of issued download URLs;
3. purges active RDS, ClickHouse, S3, MSK, projection, cache, and operational
   data within 14 days;
4. purges backup copies within 90 days; and
5. retains only minimal irreversible evidence consisting of timestamp, result,
   and correlation ID for 13 months.

Deletion state is authoritative and replay-propagated. A retry is idempotent.
No restore, replay, export, or Query rebuild may reintroduce project data after
the applicable deletion deadline.

## Security, Exports, and Break-Glass Access

All component and storage connections use TLS in transit. Storage uses
platform-managed KMS envelope encryption at rest. No customer-managed keys are
supported. KMS, ACL, backup, replication, restore, and break-glass actions
produce immutable audit events without logging customer payloads or secrets.

API owns export authorization and lifecycle status. Jobs schedules execution
and records operational state. Query generates selected-signal snapshots from
its own projections into a Query-owned encrypted S3 prefix. Exports contain
canonical and derived data only; they never contain raw payloads, Query cache
contents, or audit records.

Export behavior is bounded and testable:

- only one export may be active per project;
- a project may submit at most three export requests per UTC day;
- each signal range is at most 31 days and 100 GiB uncompressed;
- an oversized request fails safely with `resource_exhausted` and a
  correlation ID;
- output uses Parquet files and a JSON manifest containing scope, schema
  version, and file checksums;
- authorization is rechecked immediately before issuing a one-hour S3 signed
  download URL; and
- cancellation, project deletion, or authorization loss prevents download and
  invalidates the export lifecycle.

Authorized administrators see only the safe lifecycle states `queued`,
`running`, `completed`, `failed`, `canceled`, and `expired`, together with
safe errors, completion times, and correlation IDs. Export authorization,
execution, cancellation, expiry, and download issuance are audit events.

Break-glass access is approved, least-privilege, time-limited, isolated from
customer access, and fully audited. Operator guidance must define approval,
scope, duration, evidence, revocation, and incident escalation before any
implementation release.

## Integrity, Observability, and Release Gates

The owning implementation must provide the following checks and operational
evidence before release:

- validate raw and export object SHA-256 checksums and byte sizes;
- reconcile Ingest acceptance, outbox/handoff, Processor canonical records,
  replay batches, and Query projections using counts, `watchtower_id` values,
  tenant/project scope, and correlation IDs;
- detect missing, duplicate, cross-tenant, stale, or late records;
- emit immutable audit events for break-glass access, exports, deletion,
  restoration, reprocessing, retention changes, key actions, replication,
  backups, restores, integrity failures, and cache invalidation;
- expose safe structured metrics and traces for acceptance-to-canonical and
  canonical-to-projection lag, MSK lag, storage errors and capacity, retries,
  reconciliation, lifecycle jobs, cache invalidation, export status, and
  deletion progress; and
- page immediately for accepted-data-loss risk, unrecoverable handoff, or a
  tenant-isolation violation. Alert and escalate lifecycle deadline risk,
  integrity reconciliation failures, backup or restore failures, and sustained
  projection or replay failure.

Threat-model review is required when this contract is accepted and again before
each implementation release. Customer-facing documentation covering retention,
deletion, export behavior, support limits, and recovery limitations, together
with operator break-glass guidance, is required before implementation release.
This contract makes no named regulatory certification commitment.

## Required Evaluation Scenarios

The implementation issues must be able to evaluate these scenarios against
this contract:

1. Store equal external event, trace, or span identifiers for two tenants
   without Watchtower ID collision or cross-tenant disclosure.
2. Inject partial S3, RDS, ClickHouse, and MSK failures before and after local
   commits; verify no false successful acceptance and idempotent recovery.
3. Rebuild an eligible Query projection through Processor republishing without
   direct Query access to Processor S3 and without deleted-project data.
4. Shorten retention and delete a project; verify immediate inaccessibility,
   active purge within 14 days, backup purge within 90 days, export
   cancellation, cache invalidation, and minimal irreversible evidence.
5. Export permitted signals; verify Parquet output, manifest checksums,
   reauthorized one-hour URLs, rate limits, cancellation, and safe oversized
   failure.
6. Reprocess successful and partially failed ranges; verify provenance,
   range-level promotion, and preservation of the previous default.
7. Verify raw-object immutability, SHA-256 reconciliation, MSK durability
   settings, and seven-day expiry.
8. Attempt cross-tenant reads through RDS, ClickHouse, S3, MSK, exports, and
   break-glass workflows; verify denial and required audit evidence.
9. Verify production and non-production stores, keys, credentials, and data
   paths remain separate.
10. Trigger accepted-data-loss-risk, unrecoverable-handoff, tenant-isolation,
    deletion-deadline, and integrity-reconciliation conditions; verify the
    specified alert or page behavior.

## Adjacent Authority and Non-Goals

This contract preserves the remaining authority of:

| Issue | Remaining authority |
| --- | --- |
| #15 | Control plane, roles, authorization, WorkOS behavior, and credential lifecycle. |
| #16 | Sentry routes, DTOs, request semantics, and compatibility matrices. |
| #17 | Ingestion admission and durable raw-to-processing handoff behavior. |
| #18 | Normalization, privacy processing, enrichment, and processing policy. |
| #19 | Error intelligence, grouping, and issue lifecycle. |
| #21 | Native query plane and error exploration semantics. |
| #23 | Metrics-specific ingestion, storage, and querying semantics. |
| #24 | Log-specific ingestion, storage, and querying semantics. |
| #25 | Tracing and application performance monitoring semantics. |
| #29 | Scheduling, leases, retries, dead letters, and background orchestration policy. |

This contract does not implement services, database schemas, migrations,
buckets, topics, storage adapters, retention jobs, export handlers, deployment
infrastructure, public API routes, Sentry wire compatibility, role matrices,
credential lifecycle, PII scrubbing, signal-specific semantics, query
languages, or job retry policy. It does not add a feature flag.
