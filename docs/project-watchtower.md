# Watchtower Project

## Purpose and Ownership

Watchtower is a future Sentry-compatible error monitoring and observability
platform. This project owns the product compatibility requirements for
Watchtower services. The six-unit component and deployment boundary is defined
in `docs/servers-watchtower-components-contract.md`; the authoritative server
runtime profile is defined in
`docs/servers-watchtower-runtime-contract.md`.

## Version 1 Release Requirements

- Accept events from supported Sentry SDKs.
- Provide compatibility with Sentry management REST APIs.

## Component Architecture

Watchtower is deployed as six independently scalable and failure-isolated
units. They share one coordinated release train: every unit receives the same
release and rolls back with the stack, while scaling, readiness, and failure
domains remain independent.

| Unit | Boundary |
| --- | --- |
| `watchtower-ingest` | Public write-only telemetry admission, raw accepted records, and recoverable handoff to processing. |
| `watchtower-api` | Native `/api/v1` control-plane and release/artifact commands, Sentry-compatible management REST, authority, and change events. |
| `watchtower-processor` | Asynchronous normalization, privacy processing, enrichment, symbolication execution, canonical telemetry, processing state, and derived aggregates. |
| `watchtower-query` | Native `/api/v1` reads, Prometheus-, Loki-, and Tempo-compatible queries, projections, indexes, caches, and provider query orchestration. |
| `watchtower-jobs` | Scheduling, leases, retries, dead-letter state, execution history, and asynchronous orchestration. |
| `watchtower-web` | React browser experience, static assets, and bounded client-local UI state. |

The component contract is authoritative for route ownership, data ownership,
internal interfaces, dependency direction, security boundaries, failure
behavior, health, shutdown, and release compatibility. Browsers and external
clients use public routes only; they never consume internal messages or invoke
internal RPCs.

## Downstream Contract Ownership

This project establishes the component boundary and delegates detailed product
and domain decisions to the following contracts. A downstream contract may
refine behavior inside its assigned boundary but must not move ownership across
the component contract without updating it.

| Decision area | Owning downstream contract |
| --- | --- |
| Canonical telemetry, authoritative data classes, and storage model | #14, `canonical telemetry and storage model` |
| Control plane, roles, authorization, WorkOS behavior, and credential lifecycle | #15, `control plane and authorization` |
| Sentry routes, DTOs, request semantics, and compatibility matrix | #16, `Sentry compatibility contract` |
| Ingestion admission and durable raw-to-processing handoff | #17, `ingestion admission and durable handoff` |
| Normalization, privacy, enrichment, and processing policy | #18, `telemetry processing and privacy` |
| Error intelligence, grouping, and issue lifecycle | #19, `error intelligence and issue lifecycle` |
| Releases, artifacts, and symbolication details | #20, `releases artifacts and symbolication` |
| Native query plane and error exploration | #21, `query plane and error exploration` |
| Native error-monitoring browser experience | #22, `native error monitoring web experience` |
| Metrics ingestion, storage, and querying | #23, `metrics ingestion storage and querying` |
| Log ingestion, storage, and querying | #24, `log ingestion storage and querying` |
| Tracing and application performance monitoring | #25, `tracing and application performance monitoring` |
| Compatible observability data sources | #26, `compatible observability data sources` |
| Dashboards, panels, and Explore | #27, `dashboards panels and Explore` |
| Product observability semantics across metrics, logs, traces, sources, and visualization | #23–#27 |
| Unified alerting and notification delivery | #28, `unified alerting and notification delivery` |
| Background jobs and lifecycle automation | #29, `background jobs and lifecycle automation` |

The component and runtime contracts own platform-wide boundaries and
operational mechanics, including component diagnostics, correlation, readiness,
shutdown, release compatibility, and failure isolation. They do not select
exact analytical, object-store, durable-log, deployment, or numeric SLO
choices delegated to downstream contracts.

## Compatibility Boundary

Watchtower must preserve the Sentry route and request behavior required by a
supported compatible interface. Native Watchtower HTTP APIs use explicit major
route versions. Compatibility DTOs remain at external adapters and never
become canonical Watchtower domain or persistence models.

This project does not yet define the supported Sentry version, individual
endpoint catalog, detailed authorization behavior, canonical data model,
persistence topology, query semantics, UI state, or migration behavior. Each
must be established in its owning downstream contract before implementation.

## Current Status

This repository contains policy and contract foundations only. It does not yet
provide a Watchtower server, public API implementation, SDK, or persistent
storage.
