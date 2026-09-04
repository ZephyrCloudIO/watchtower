# Watchtower Server Runtime Contract

## Scope and Ownership

This contract governs the runtime boundary for future Watchtower backend
services under `servers/`. It defines the server technology choice and public
HTTP compatibility boundary; individual service contracts own their routes,
authorization, persistence, and operational behavior.

## Runtime Profile

Watchtower services use the repository-standard Rust and Pingora runtime.
Relational persistence uses PostgreSQL with `sqlx`, and operational events use
structured `tracing` logs.

## HTTP API Boundary

Sentry-compatible event ingestion and management APIs must preserve the
upstream routes and request semantics required by the supported interface.
Native Watchtower APIs use explicit major-versioned HTTP routes.

No server implementation, API version support matrix, TLS configuration,
authentication mechanism, database schema, or streaming transport is defined
by this contract. Those decisions must be recorded in the owning service or
API contract before implementation.
