# Watchtower

Watchtower is a future Sentry-compatible error monitoring and observability
platform. Version 1 requires compatibility with Sentry SDK event ingestion and
management REST APIs. Repository policy and tooling are initialized; no product
implementation is included.

Backend services use Rust with Pingora, PostgreSQL with `sqlx`, and explicit
major-versioned HTTP routes for native APIs. Sentry-compatible endpoints retain
the upstream request and route behavior required by supported clients.

## Prerequisites

- Node.js 24
- pnpm 10.17.1 through Corepack
- Rust toolchain from `rust-toolchain`

## Setup

```bash
corepack enable
pnpm install
pnpm check
```

The install step configures Lefthook for this checkout. See
`docs/README.md` for the contract-document catalog and naming rules.

## Repository Layout

- `apps/`: application surfaces
- `packages/`: shared TypeScript packages
- `crates/`: Rust crates
- `protos/`: optional shared protobuf contracts
- `servers/`: Rust and Pingora backend services
- `docs/`: authoritative project and domain contracts

Each domain currently contains policy only. Add an implementation together with
its owning contract and scoped validation.
