# Watchtower Server Runtime Contract

## Scope and Ownership

This contract governs the runtime boundary for the six future Watchtower
deployment units under `servers/`. The component boundary, ownership matrix,
dependency direction, and failure behavior are authoritative in
`docs/servers-watchtower-components-contract.md`. This contract defines the
shared runtime, security, health, shutdown, and release rules.

## Runtime Profile

Watchtower services use the repository-standard Rust and Pingora runtime.
Relational persistence uses PostgreSQL with `sqlx`, and operational events use
structured `tracing` logs.

## Public and Internal HTTP Boundaries

The shared L7 routing layer owns routing only. It sends telemetry writes to
`watchtower-ingest`, Sentry management and native control or release/artifact
commands to `watchtower-api`, and native or compatible queries to
`watchtower-query`. It does not own business behavior.

Sentry-compatible event ingestion and management APIs preserve the upstream
routes and request semantics required by the supported interface. Native
Watchtower business APIs use `/api/v1`.

Initial synchronous component calls use unary Protobuf-over-HTTP under
`/internal/v1`. Internal streaming, gRPC, and Connect RPC are not part of
version 1. A future server-streaming PRD must update the component contract;
Connect RPC is preferred over gRPC only after renewed Rust and Pingora
maturity validation. The callee owns its service contract under
`protos/<service-name>/v1`, and generated bindings must remain synchronized.

Internal failures use a safe Protobuf envelope with a canonical code, safe
message, retryability, and correlation identifier. Original causes remain in
structured logs. The canonical mappings are:

| Code | HTTP status |
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

Synchronous deadlines and cancellation propagate across calls. Automatic
retries are budget-limited and are allowed only for operations explicitly
declared idempotent.

Asynchronous messages use a common versioned envelope containing a canonical
lowercase UUID v7 message ID, message type and schema version, producer, tenant
and project context, event time, causation and correlation identifiers, W3C
trace context, idempotency key, and either a bounded payload or authorized
payload reference. Credentials and unrestricted customer payloads are
prohibited. Delivery is at least once, consumers are idempotent, and no global
ordering is guaranteed unless a downstream domain contract declares ordering
for an aggregate partition.

## Security and Configuration

Every public component authenticates its protocol and performs the initial
authorization check. The final data owner independently validates tenant,
actor, action, and resource context. Web client behavior never replaces these
server-side checks.

Internal HTTP requires mTLS workload identity and explicit caller policy.
Durable-log producers and consumers require equivalent ACLs. Bearer tokens,
private keys, opaque session material, and unrestricted customer payloads must
not be forwarded in messages or written to logs.

Each component uses typed startup configuration, fails startup validation
safely, and receives separate least-privilege credentials. Production and
non-production credentials and trust roots remain isolated. Live reload is
limited to mTLS certificates, CA bundles, and broker, storage, or service
credentials. An invalid reload retains the last-known-good value and emits an
operational alert; all other configuration changes require deployment.

Detailed roles, WorkOS behavior, credential lifecycle, PII handling, retention,
deletion, abuse controls, and compliance gates remain owned by issues #15 and
#18.

## Health, Readiness, and Shutdown

Each component exposes separate liveness, readiness, and dependency
diagnostics. Processor and Jobs expose only health and authenticated internal
interfaces; no component exposes internal messages or RPCs to browsers or
external clients. Readiness covers only capabilities required for the
component's owned paths and never transitively requires an unrelated worker.

Security-sensitive local projections must complete an initial snapshot before
readiness. If such a projection is unavailable or older than the maximum
freshness established by the authorization contract, affected admission or
query behavior fails closed.

Graceful shutdown removes readiness, stops new work, drains in-flight work to a
configured deadline, persists checkpoints and outboxes, releases leases, and
only then exits. Shutdown diagnostics record the drain result. Recovery belongs
to the component that owns the affected process, state, or projection; the
upstream owner supplies replayable changes, and consumers rebuild locally
without direct persistence access. Concrete runbooks are required before each
implementation becomes production-ready.

## Coordinated Release and Operations

The six units scale and fail independently but use one coordinated release
train. Every unit receives the same release and the stack rolls back together.
Long-lived independent version skew is unsupported. Ordered rollout and
rollback require bounded N/N-1 compatibility, and consumers must understand
every message version still inside the replay horizon.

Persistence changes use expand/contract sequencing so rollout and whole-stack
rollback remain safe without destructive storage changes. API failure does not
stop ingest or query while their security projections remain valid. Query
failure stops query routes and Sentry management reads but not API-owned
mutations. Processor or Jobs failure preserves durable work for later
processing. No component bypasses an unavailable owner through direct storage
access.

Structured logs, metrics, and distributed spans propagate W3C trace context and
UUID v7 request, operation, and message identifiers. Required metrics cover
request latency and errors, admission outcomes, backlog and projection lag,
processing lag, retries and dead letters, resource saturation, readiness, and
shutdown drain results. Numeric availability, latency, throughput, backlog,
capacity, and cost targets are production gates owned by downstream PRDs; this
contract does not invent platform-wide numbers.

Split a unit only after measured repeated SLO, capacity, cost,
security/isolation, ownership, or deployment-cadence evidence plus a contract
update. Merge units only after sustained evidence that their scaling, failure,
security, and ownership boundaries coincide.

No server implementation, API version support matrix, TLS implementation,
database schema, exact analytical/object/durable-log product, deployment
platform, or numeric SLO target is defined by this contract. Those decisions
must be recorded in the owning service or downstream product contract before
implementation.
