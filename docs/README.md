# Documentation Catalog

## Purpose

This file catalogs authoritative repository contracts and documentation policy.
The repository currently contains the Watchtower project and server runtime
contracts. Additional contracts should be cataloged here when their owning
project or domain is introduced.

## Naming Rules

- Project indexes: `docs/project-<project-id>.md`
- Domain contracts: `docs/<domain>-<project-or-component>-<contract>.md`
- Supported domain prefixes: `apps`, `packages`, `crates`, `protos`, and `servers`
- Use lowercase kebab-case project and component identifiers.

## Documentation Policy

- `docs/AGENTS.md`

## Project and Domain Contracts

- `docs/project-watchtower.md`
- `docs/servers-watchtower-runtime-contract.md`

## Adding a Contract

Add the project index and directly authoritative domain contracts before or in
the same change as the implementation scaffold. Contract-only changes may
establish committed decisions for future implementations, but implementation
must not precede its owning contracts. Catalog every new document here and keep
repository-wide policy in the applicable `AGENTS.md` instead of repeating it
inside contracts.
