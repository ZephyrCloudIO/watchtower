# Watchtower Canonical Telemetry and Storage Contract

## Scope and Authority

This contract defines the protocol-neutral canonical telemetry model, data
classes, storage ownership, durability, lifecycle, and security invariants for
Watchtower. It is documentation only. It does not create services, database
schemas or migrations, buckets, topics, storage adapters, retention jobs,
export handlers, deployment infrastructure, public routes, or a feature flag.

The component and deployment boundaries remain authoritative in
`docs/servers-watchtower-components-contract.md`, and shared runtime and
message rules remain authoritative in
`docs/servers-watchtower-runtime-contract.md`. This contract refines those
boundaries for telemetry and storage without moving ownership between
components or changing their existing decisions.

The following downstream decisions remain authoritative in their owning work:

| Area | Owner |
| --- | --- |
| Control plane, authorization, roles, WorkOS behavior, and credential lifecycle | Issue #15 |
| Sentry routes, DTOs, request semantics, and compatibility matrix | Issue #16 |
| Ingestion admission and durable raw-to-processing handoff behavior | Issue #17 |
| Normalization, privacy, enrichment, and processing policy | Issue #18 |
| Error intelligence, grouping, and issue lifecycle | Issue #19 |
| Native query plane and error exploration | Issue #21 |
| Metrics ingestion, storage, and querying | Issue #23 |
| Log ingestion, storage, and querying | Issue #24 |
| Tracing and application performance monitoring | Issue #25 |
| Background jobs and lifecycle automation | Issue #29 |

This document does not define Sentry wire compatibility, roles, credential
lifecycle, PII scrubbing, signal-specific semantics, query languages, or job
retry policy.

## Canonical Record Contract

Canonical telemetry is a Watchtower-owned representation. External protocols
are adapters at the boundary; their payloads, field names, identifiers, and
wire encodings do not become canonical storage models.

### Common identity and timing fields

Every canonical row has these fields. The same fields are present in the
versioned messages that hand records to downstream consumers.

| Field | Contract |
| --- | --- |
| `watchtower_id` | Required Watchtower-generated lowercase UUID v7. It is the canonical record identity and is never accepted from an external protocol as authoritative. It is globally unique, including across tenants and projects. Persistent PostgreSQL representations use `uuid`. |
| `tenant_id` | Required canonical lowercase UUID v7 identifying the tenant boundary. |
| `project_id` | Required canonical lowercase UUID v7 identifying the project within the tenant. A project belongs to exactly one tenant. |
| `signal` | Required fixed value identifying the physical signal schema: `error_occurrence`, `metric_point`, `log_record`, or `span`. |
| `accepted_at` | Required UTC timestamp recording durable raw acceptance. It is the basis for retention, replay, deletion, and lifecycle calculations. Boundary representations are RFC 3339 with nanosecond precision. |
| `observed_at` | A UTC RFC 3339 timestamp with nanosecond precision when the source signal has an observation time. |
| `observed_at_status` | Required enum `present`, `not_applicable`, or `unavailable`. `present` requires `observed_at`; `not_applicable` requires `observed_at = null` when the signal has no observation-time concept; `unavailable` requires `observed_at = null` when an expected source time is missing or unparseable. `accepted_at` must not be substituted for an unavailable observation time. |
| `canonical_schema_version` | Required immutable version of the physical canonical schema. |
| `normalization_version` | Required immutable version of the normalization rules that produced the row. |

All canonical timestamps are UTC RFC 3339 timestamps with nanosecond precision
at protocol boundaries. Storage adapters preserve that precision. No record
may be written without `accepted_at` or with an ambiguous observed-time state.

Watchtower-owned request, operation, message, causation, and correlation
identifiers use canonical lowercase UUID v7 values where they are persistent
identities. External protocol identifiers are retained only as bounded,
scoped compatibility or correlation keys. Each such key carries its protocol
namespace, tenant/project scope, kind, and value; it cannot replace
`watchtower_id`, create a cross-tenant lookup, or become a uniqueness authority.

### Typed common context

Each signal carries the same fixed, typed context groups. Context fields are
optional only where the owning signal contract permits absence; the groups do
not accept arbitrary JSON.

| Context group | Examples of typed fields |
| --- | --- |
| `environment` | Environment name, deployment identifier, release/version, and region. |
| `service` | Service name, namespace, version, and instance identifier. |
| `resource` | Resource type, name, provider, region, and bounded resource attributes. |
| `instrumentation_scope` | Instrumentation library name, version, and schema URL. |
| `correlation` | W3C trace identifiers, span and parent-span identifiers, request/operation/message identifiers, and causation/correlation identifiers. |

Fixed fields in these groups have declared scalar types and bounded lengths.
Protocol-specific correlation keys remain namespaced and scoped. Correlation
context is never used to infer tenant or project authorization.

### Extensions and provenance

Extension attributes use namespaced flat keys such as
`vendor.example.attribute`. A value is exactly one of:

- `null`;
- boolean;
- string;
- integer;
- float; or
- an array whose members are all the same primitive type.

Nested objects, nested arrays, arbitrary JSON, unbounded maps, raw protocol
payloads, and opaque customer structures are not canonical fields. Attribute
names, string lengths, array lengths, and total extension size are bounded by
the implementation contract before storage.

Each normalized, enriched, canonical, derived, projection, and exported record
retains provenance sufficient to identify its source record, source protocol
namespace, accepted range, normalization and canonical versions, producer, and
processing/rebuild operation. Provenance does not include an unrestricted raw
payload.

## Separate Physical Signal Schemas

The canonical store has four separate physical schemas. They share the common
identity, timing, context, extension, provenance, and version fields above,
but their signal-specific columns and constraints remain independent.

| Physical schema | Meaning and authority |
| --- | --- |
| `canonical_error_occurrences` | One error occurrence per canonical record. Error grouping and issue lifecycle remain owned by issue #19. |
| `canonical_metric_points` | One metric point per canonical record. Metric type, temporality, aggregation, and query semantics remain owned by issue #23. |
| `canonical_log_records` | One log record per canonical record. Log-specific fields and query semantics remain owned by issue #24. |
| `canonical_spans` | One span per canonical record. Trace and application-performance semantics remain owned by issue #25. |

There is no generic physical event table, polymorphic payload column, or
signal-dispatch table used as canonical storage. A record is written to one
physical signal schema only, and its `signal` value is fixed by that schema.
The four schemas are independently queryable and independently protected by
their owner while retaining the shared context contract.

## Data Classes and Ownership

Every data class has one authoritative writer, a defined lifecycle, an
authority boundary, and a storage boundary. A consumer may maintain its own
projection only after receiving an authorized versioned message; it never
writes another component's authority.

| Data class | Sole writer and authority | Lifecycle and storage boundary |
| --- | --- | --- |
| Raw accepted data | Ingest | Immutable accepted protocol bytes and bounded metadata in Ingest-owned S3 raw-object resources. Retained for at most seven days from `accepted_at`, or the shorter applicable project policy. An acknowledged record awaiting normalization is encrypted-quarantined with its recoverable handoff only within that window. On terminal failure or expiry, payload data is purged and only bounded non-payload failure evidence remains. Inaccessible to customers and Query. |
| Attachments | Ingest | Ingest-owned S3 resources subject to the same bounded quarantine, retention, terminal-failure, and deletion rules as raw data. |
| Handoff and outbox state | Ingest | Ingest-owned PostgreSQL state and Ingest-owned MSK handoff namespace. Retained for at most seven days from `accepted_at`, or the shorter applicable project policy. An acknowledged incomplete handoff is retained for reconciliation only within that window; terminal failure or expiry purges payload-bearing state and preserves only bounded non-payload failure evidence. |
| Normalized data | Processor | Processor-owned safe-normalized records and processing state. Raw reprocessing is available for seven days; safe-normalized records are retained for reprocessing otherwise, within the 90-day canonical/replay horizon. |
| Enriched data | Processor | Processor-owned processing artifacts. Enrichment is not an independent authority; retained enriched artifacts follow the 90-day Processor processing horizon and are deleted with the project. |
| Canonical telemetry | Processor | The four physical canonical schemas in Processor-owned ClickHouse resources. Retained 90 days from `accepted_at`. |
| Derived data | Processor | Processor-owned mutable aggregates and derived domain state. Mutable aggregates use fixed `accepted_at` time buckets; each bucket expires independently after 13 months, or an earlier project policy, and reads recompute from retained buckets. Semantics remain with the owning downstream domain issue. |
| Compatibility-only data | The external adapter that creates it | Transient protocol DTOs and bounded compatibility mappings at API or Query boundaries. They are never canonical persistence, never a raw-payload escape hatch, and are not a shared storage class. |
| Query projection | Query | Query-owned read projections and indexes derived from authorized Processor or API messages. Processor-canonical projections follow the source record's 90-day `accepted_at` retention; Processor-derived projections follow the source's 13-month retention; API control and security projections remain until replaced or tombstoned by their authority. All are subject to earlier project policy. |
| Query cache | Query | Query-owned cache entries derived from Query projections. Entries never outlive their source retention, are invalidated on deletion or shortening, and are not authoritative. |
| Replay batch | Processor | Project-scoped encrypted Processor S3 batches used for authorized replay and Query rebuild. Retained 90 days from the records' `accepted_at`; Query receives republished messages and never reads these objects. |
| Audit evidence | The component that owns the audited action | Component-local audit stores or streams, with one writer per component-local audit boundary. Audit records contain actor/action/scope/result/correlation and integrity evidence, never raw customer payloads or credentials. Operational history and minimal irreversible deletion evidence are retained 13 months. |
| Operational state | Its owning component | API owns API/control-plane operational state; Jobs owns schedules, leases, dead-letter state, and execution history. Each uses its own PostgreSQL boundary and retains operational history 13 months. |

Compatibility-only data is not a second canonical model. If a compatibility
adapter needs a lookup, it uses an authorized owner interface and a bounded
projection rather than persisting a protocol-shaped copy of canonical data.

## Component and Resource Boundaries

All managed RDS PostgreSQL, ClickHouse Cloud on AWS, Amazon S3, and Amazon MSK
resources for this contract are in `us-east-1`. Resource ownership is
exclusive: a component receives credentials and ACLs for its own database,
tables, buckets/prefixes, topics, consumer groups, and operational state. A
designated downstream consumer additionally receives read-only access to its
producer's MSK topic; the consumer owns its consumer groups.
Logical separation is not permission to bypass the owner of another logical
resource.

| Component | Owned resources and data |
| --- | --- |
| Ingest | PostgreSQL handoff/outbox state; S3 raw records and attachments; the Ingest-owned MSK handoff namespace. |
| Processor | PostgreSQL processing state; ClickHouse canonical signal schemas and mutable aggregates; S3 safe-normalized/replay resources; Processor-owned MSK publication namespaces. |
| Query | PostgreSQL projection/cache metadata; ClickHouse Query projections and indexes; Query-owned S3 export artifacts containing only authorized projections. Query has no access to Processor raw or replay objects. |
| API | PostgreSQL control-plane and API operational state, plus the artifact authority already assigned by the component contract. API does not own telemetry storage. |
| Jobs | PostgreSQL scheduling, lease, dead-letter, and execution-history state. Jobs does not write domain-owned telemetry, projection, or control-plane stores. |
| Web | No server-authoritative storage. Browser-local state is bounded and cannot contain a server-authoritative telemetry copy. |

No component reads or writes another component's RDS, ClickHouse, or S3
resource directly. Producer-owned MSK topics are read only by their designated
downstream consumers: Ingest consumes authorized API changes for local
authorization projections; Processor consumes Ingest handoffs and relevant API
changes; and Query consumes authorized Processor and API changes. Recovery uses
a versioned owner interface or durable message. A component outage never
authorizes a persistence fallback in another component.

### Environment and tenant isolation

Production and non-production use separate cloud accounts, stores, network
boundaries, KMS keys, service identities, and credentials. Customer data,
including raw payloads, attachments, exports, replay batches, and production
projections, is never copied into non-production. Synthetic or explicitly
sanitized test data is required there.

Every stored record, message, projection, cache entry, export manifest, and
audit event carries the tenant and project scope appropriate to its class.
Tenant and project authorization is checked by the public adapter and again by
the data owner. PostgreSQL row-level security, storage ACLs, MSK ACLs, and
ClickHouse row policies or equivalent owner-enforced filters must prevent
cross-tenant and cross-project access.

Every Query and export operation requires an explicit authorized
`tenant_id`/`project_id` filter. Unscoped, wildcard, inferred, or
caller-supplied-only filters are rejected. The final owner validates the
authorized scope before reading, writing, rebuilding, exporting, or changing
retention. Tenant and project identifiers are part of uniqueness and access
checks even when a Watchtower UUID is globally unique.

## Storage Layout and Durability

### ClickHouse canonical layout

Each of the four canonical signal schemas is a separate physical table or
equivalent physical relation in Processor-owned ClickHouse Cloud on AWS. The
tables use monthly partitions by `accepted_at` and the required ordering:

```text
ORDER BY (tenant_id, project_id, signal, observed_at, watchtower_id)
```

The order is a storage and scan contract, not a global ordering guarantee.
`observed_at` remains explicitly nullable for `not_applicable` and
`unavailable` records.

### Transactions, outboxes, and reconciliation

Each component uses local transactions for its own relational state and a
transactional outbox for every durable message handoff. Versioned messages
contain the common envelope required by the runtime contract, including
message ID, message type and version, producer, tenant/project context, event
time, causation/correlation IDs, W3C trace context, idempotency key, and a
bounded payload or authorized payload reference.

An object-store write and a relational transaction are not a distributed
transaction. An owner records durable completion and reconciles incomplete
object/metadata/outbox states before treating a handoff as accepted. Failed
steps are retried idempotently; reconciliation finds and repairs or safely
quarantines incomplete ranges. There are no best-effort cross-store writes.

Ingest may return a successful ingestion acknowledgement only after:

1. the raw accepted record and any attachment are durably stored in Ingest's
   raw-object boundary; and
2. the recoverable handoff and transactional outbox state are durably
   established in Ingest's owned boundary.

Processor normalization, canonical writes, aggregate updates, Query
projection, cache population, and customer-visible query results are
asynchronous. A successful ingestion acknowledgement is not a synchronous
ingestion-to-canonical or ingestion-to-Query guarantee.

### MSK delivery

The Amazon MSK handoff and publication namespaces use:

- seven-day Kafka retention;
- replication factor `3`;
- `min.insync.replicas=2`; and
- producer `acks=all`.

Delivery is at least once. Consumers use message IDs and idempotency keys to
make retries safe, and reconciliation verifies gaps, duplicates, and durable
handoff state. There is no global ordering guarantee. An ordering requirement
must be declared by the owning downstream domain for a specific aggregate
partition; it must not be inferred from broker arrival order.

## Versioning, Replay, and Rebuild

Canonical schema versions and normalization versions are immutable. A behavior
change creates a new version and preserves the provenance and source range
that produced each record. Consumers support every message and canonical
version retained within the replay horizon; rollout and rollback cannot require
a consumer to understand a version older than that horizon.

Raw records are reprocessable for seven days. After raw retention expires,
Processor uses retained safe-normalized records for eligible reprocessing. A
replay batch is project-scoped, encrypted with platform-managed KMS, and
retained for 90 days from `accepted_at`.

Processor is the only component that reads replay batches. For an authorized
Query rebuild, Processor validates the requested tenant/project scope and that
no deletion acceptance has been recorded, then republishes versioned authorized
records. Query rebuilds its own projections from those messages and never
accesses Processor S3 directly. Processor and Query reject batches or messages
for projects with a recorded deletion acceptance, so a rebuild cannot recreate
or expose deleted-project data during the purge window or afterward.

Before a new canonical or normalization version becomes the default, the
owner performs range-level integrity validation. Validation covers the source
range, tenant/project scope, record counts, accepted-time bounds, schema and
normalization versions, checksums or equivalent integrity evidence, duplicate
and gap detection, and deletion/retention filters. The version remains
non-default until validation and reconciliation complete.

## Retention and Deletion

Telemetry-derived retention periods are measured from `accepted_at`. API
control and security projections instead follow their authority's replacement
or tombstone lifecycle.

| Data | Default maximum retention |
| --- | ---: |
| Raw data, attachments, and handoff state | 7 days |
| Canonical telemetry, safe-normalized reprocessing records, and replay batches | 90 days |
| Query projections | Their source authority's lifetime: 90 days for canonical telemetry, 13 months for derived data, and until replacement or tombstone for API control and security state |
| Mutable aggregate buckets and operational history | 13 months |

Caches, enriched artifacts, compatibility mappings, and export artifacts must
not outlive the authoritative data from which they were derived. A project
administrator authorized by the control-plane contract may shorten a project
retention policy but may never extend it. A shortened policy immediately hides
excess data from authorized reads, exports, and rebuilds, then schedules active
store purge within 14 days.

Deletion is project-wide only; per-record, per-signal, and partial deletion
are not canonical lifecycle operations. When deletion acceptance is recorded,
every owner persists the project deletion tombstone and checks it before every
write. The project is placed behind a deletion gate that disables:

- new collection;
- reads and query projections;
- restoration and replay;
- exports and download renewal; and
- cache refreshes, rebuilds, and all processing writes from delayed handoffs.

After acceptance, the owners coordinate idempotent deletion through versioned
messages and local outboxes:

- active stores, including raw objects, attachments, canonical and derived
  data, projections, caches, replay material, export artifacts, and operational
  copies, are purged within 14 days;
- backups are purged within 90 days and cannot be restored into an active
  environment after the deletion deadline;
- queued or running exports are canceled and their URLs invalidated;
- Query caches and indexes are invalidated and cannot be repopulated from a
  deleted project; and
- minimal irreversible deletion evidence is retained for 13 months, containing
  no customer payload and only the project scope, request/acceptance/result
  metadata, timestamps, correlation, and integrity evidence.

Deletion completion is not acknowledged until each owner reports its local
purge or an explicit safe terminal outcome, and the owner has established a
durable queue and reconciliation barrier proving delayed work cannot recreate
the project. Re-delivery is idempotent. Any failure leaves collection, reads,
restoration, exports, and rebuilds disabled and pages the owning operators.

## Security and Export Boundaries

- TLS protects data in transit for public, internal, storage, and broker
  connections. Internal identity and authorization continue to follow the
  component and runtime contracts.
- Platform-managed KMS envelope encryption protects data at rest. Customer-
  managed keys are not supported by this contract.
- Credentials, bearer tokens, private keys, opaque session material, and raw or
  unrestricted customer payloads never enter canonical records, messages,
  audit events, metrics, or logs.
- Raw payloads and attachments are inaccessible to customers and Query. Query
  operates on authorized projections and cannot obtain raw data through a
  persistence fallback.
- Export authorization is checked by the public adapter and final data owner
  against the explicit tenant/project filter. The role and authorization
  matrix remains owned by issue #15.
- Exports have bounded size and range limits. An oversized request fails
  safely before creating an unbounded artifact or partial success.
- Export files are Parquet. Each export has a manifest containing the selected
  scope, range, schema/version, file list, and per-file integrity checksums.
- Download URLs are reauthorized on every renewal and expire after one hour.
  Rate limits apply to creation, renewal, and download. Cancellation stops
  further production and invalidates pending downloads.

## Integrity, Audit, and Release Readiness

Before an implementation using this contract is released, its owning runbooks
and threat model must demonstrate:

- startup and recurring integrity checks for stores, partitions, ranges,
  outboxes, messages, projections, replay batches, manifests, and deletion
  state;
- audit events for authorization decisions, accepted handoffs, replay and
  rebuild requests, retention changes, exports, cancellations, deletion
  acceptance, purge results, cache invalidation, break-glass use, and
  integrity failures;
- metrics for admission outcomes, raw durability, outbox age and failure,
  broker lag, duplicate and gap rates, processing and projection lag,
  normalization/replay failures, purge progress, export size/rate/cancel
  outcomes, cache invalidation, and resource saturation;
- alerts, paging, and escalation for unauthorized access attempts, tenant or
  project isolation failures, retention/deletion deadline risk, replay or
  projection divergence, integrity failures, raw-payload exposure, and
  exhausted safe capacity;
- a reviewed threat model covering cross-tenant access, confused-deputy
  queries, replay after deletion, export authorization, object-store and
  broker ACLs, backup restoration, credential exposure, and break-glass use;
- concise customer-facing documentation for retention, deletion, export
  permissions and limits, download expiry, cancellation, and support limits;
  and
- operator break-glass guidance that is time-bound, scope-bound, audited,
  approved through the control-plane authorization process, defaults to the
  minimum access necessary, and is revoked after use.

Break-glass access does not bypass tenant/project isolation, deletion gates,
retention deadlines, encryption, audit, or raw-payload restrictions.

## Contract Test Scenarios

The implementation issues must make these scenarios executable as acceptance
tests:

1. Validate that each of the four signals lands in its own physical schema,
   carries common context, rejects nested/unbounded extensions, and preserves
   signal-specific semantics for its downstream owner.
2. Generate records for multiple tenants and projects and verify canonical
   UUID v7 identity, external-ID scoping, PostgreSQL UUID storage, uniqueness,
   RLS/row-policy enforcement, and explicit authorized Query filters.
3. Verify UTC nanosecond timestamps, accepted-time retention calculations, and
   valid `present`, `not_applicable`, and `unavailable`
   `observed_at`/`observed_at_status` combinations, including missing or
   unparseable expected source times without substituting `accepted_at`.
4. Stop Processor before and after Ingest acknowledgement. Confirm that only
   durable raw acceptance plus handoff produces success, that canonical and
   Query visibility remain asynchronous, that Ingest and Processor consume
   their authorized API changes while only designated consumers read each
   producer-owned topic with their own consumer groups, and that reconciliation
   recovers the handoff without a distributed transaction.
5. Redeliver messages and replay ranges. Confirm at-least-once idempotency,
   no global-order assumption, compatibility with every version retained in the
   replay horizon, duplicate/gap detection,
   provenance, and range-level validation before defaulting a new version.
6. Rebuild a Query projection through Processor republishing, confirm Query
   never reads Processor S3, and verify that a recorded deletion acceptance
   immediately blocks republishing, restoration, and rebuild before purge
   completion.
7. Exercise seven-day raw retention after successful normalization, recovery of
   an acknowledged handoff within its bounded quarantine, terminal failure and
   expiry purge with only non-payload evidence retained, 90-day canonical/replay
   retention, source-authority projection retention, independently expiring
   13-month aggregate buckets, and an authorized shortened policy with
   immediate hiding and a 14-day purge deadline.
8. Accept a project-wide deletion and verify the persistent tombstone blocks
   collection, reads, restoration, exports, cache refresh, rebuild, and delayed
   processing writes before purge completion; active purge, backup purge, export
   cancellation, queue barriers, cache invalidation, and minimal evidence follow
   their deadlines.
9. Exercise authorized and unauthorized exports, tenant/project filter
   failures, size limits, Parquet manifests, checksum validation, URL expiry
   and reauthorization, rate limits, cancellation, and safe oversized-request
   failure.
10. Verify production/non-production account, store, key, credential, ACL,
    and data-copy isolation, plus TLS, KMS envelope encryption, raw-payload
    inaccessibility, audit events, metrics, alerts, paging, escalation, and
    break-glass restrictions.

## Non-Goals and Deferred Decisions

This contract does not implement or select services, migrations, exact DDL,
storage adapters, retention workers, export handlers, deployment
infrastructure, public API routes, Sentry wire compatibility, role matrices,
credential lifecycle, PII scrubbing, signal-specific fields or semantics,
query languages, or job retry policy. It does not add a feature flag.

Numeric SLOs, endpoint catalogs, protocol compatibility versions, and product
behavior delegated to the downstream issues remain outside this contract.
