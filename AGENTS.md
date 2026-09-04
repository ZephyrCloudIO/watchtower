# Repository Instructions

## General Rules

- Treat `docs/` as the source of truth for repository contracts and implementation notes.
- List `docs/` before starting a task and keep affected contracts current with structural or behavioral changes.
- Define repository-wide rules in this file and narrower rules in the closest scoped `AGENTS.md`.
- Write source code and comments in English.
- Explain workarounds in comments, including why they exist, their constraints, and when they can be removed.
- Use `pnpm`; do not introduce npm or Yarn lockfiles.
- Prefer enums or typed constants over free-form strings when all variants are known.
- Use canonical lowercase UUID v7 strings at external boundaries and PostgreSQL `uuid` columns for repository-owned persistent identifiers.
- Do not use browser automation for repository work unless an applicable instruction or the task explicitly requires it.
- Never deploy to production or trigger a production deployment without explicit authorization for that deployment.
- Do not guess unstable or external facts; verify them with authoritative documentation or the owning system.

## Git and GitHub

- Never bypass repository hooks with `--no-verify`.
- Stage intended files before committing and do not leave unrelated staged changes behind.
- Use Conventional Commits for commit messages, pull-request titles, and pull-request descriptions.
- Use Git tags as the source of truth for versioned releases; do not edit package versions solely to create a release.
- Resolve addressed review threads after pushing the corresponding fixes.
- Prefer `gh` for GitHub operations when it supports the required workflow.
- Pin external GitHub Actions to full 40-character commit SHAs. Repository-local actions may use `./...` references.

## Repository Structure

- `apps/`: Browser, desktop, and mobile application surfaces.
- `packages/`: Shared TypeScript libraries and frontend modules.
- `crates/`: Rust libraries and binaries.
- `protos/`: Shared protobuf contracts and language-specific generated bindings.
- `servers/`: Backend services and APIs.
- `docs/`: Authoritative project and domain contracts.
- `scripts/`: Repository setup and validation scripts.
- `.github/`: Repository automation and CI workflows.

## Documentation Lifecycle

- Update affected contracts in the same change as repository structure, ownership, interface, or behavior changes.
- Put policy in the applicable `AGENTS.md`; do not duplicate it in contract documents.
- Contract documents should record project-specific behavior, ownership, interfaces, committed technology choices, and explicit exceptions.
- Keep domain-level instructions aligned with their authoritative contracts.
- Reference another contract by path only when it is directly authoritative for an ownership, API, or runtime handoff used by the current document.
- Keep customer-facing documentation concise while preserving material limitations, permissions, privacy, security, pricing, and recovery guidance.

## Application and API Defaults

- Frontend applications use React and Rsbuild or another Rspack-family tool unless an owning contract records an exception.
- Applications that need client-side routing use TanStack Router.
- Backend services use Rust with Pingora unless an owning project contract records an exception.
- Business APIs use explicit major-versioned HTTP routes unless an owning project contract records an exception.
- Streaming APIs must document their HTTP-based transport in the owning service contract; clients must not consume internal queues or streams directly.
- Store repository-owned protobuf contracts under `protos/<service-name>/v1` only when an owning API contract selects Protobuf, and keep generated bindings for consuming runtimes synchronized with their source contracts.
- Relational services use PostgreSQL with `sqlx` unless an owning contract records an exception.
- Use WorkOS as the default authentication provider unless an owning authoritative project or domain contract records an exception.
- Treat authentication and authorization as separate concerns; document and test authorization behavior independently.
- Use PostHog by default for feature flags and other applicable PostHog-backed product capabilities unless an owning authoritative project or domain contract records an exception.
- Production and non-production external API registrations must not share client IDs, secrets, signing keys, callback URLs, or webhook secrets.

## Validation

- Run package-scoped lint, test, and build commands for changed TypeScript projects.
- Run `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets`, and `cargo test --workspace` from the repository root after changing Rust code.
- Keep generated outputs and their inputs synchronized in the same change.

## Shell Safety

- Use `$(...)` for command substitution instead of legacy backticks.
- Quote dynamic values and file paths by default.
- Resolve and validate destructive targets before changing or deleting them.

## Logging

- Write enough logs for debugging, incident analysis, and operational troubleshooting.
- Prefer structured logging for business and system events.
- Rust code should use `tracing` or compatible structured facades.
- CLI and operator-facing logs should enable ANSI color by default and honor `NO_COLOR`.
- Never log secrets, credentials, opaque session material, or unrestricted customer payloads.

## ECMAScript and TypeScript

- Prefer named exports over default exports.
- Use camelCase variants for Zod enums.
- End Zod schema identifiers with `Schema`.

## GitHub Issue Style

- Use issue titles in the form `<domain>: <description>`.
- Use stable lowercase domain identifiers from repository contracts.
- Make the description concise and start it with a lowercase verb phrase when natural.
- Use these issue-body sections in order: `Summary`, `Evidence`, `Current Gap`, `Proposed Scope`, `Acceptance Criteria`, `Test Scenarios`, and `Out of Scope`.
- Append `Additional Notes` only when it adds necessary context.
