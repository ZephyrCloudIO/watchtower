# Instructions for `servers/`

- Follow the root `AGENTS.md`, the owning `docs/project-*.md`, and matching server or protobuf contracts before implementation.
- Implement backend services in Rust with Pingora unless an owning contract records an exception.
- Use PostgreSQL with `sqlx` for relational persistence.
- Use UUID v7 for repository-owned entities and PostgreSQL `uuid` for their keys.
- Use explicit major-versioned HTTP routes for native business APIs unless an owning contract records an exception.
- Document the selected HTTP transport for streaming APIs in the owning service contract; clients must not consume internal queues or streams directly.
- Return generic public errors for internal failures and record the original cause in structured logs with correlation metadata.
- Never expose secret values in logs, default API responses, or routine stream payloads.
- Keep API boundaries explicit and versioned. Use Protobuf only when the owning API contract selects it.
- Use `tracing` or a compatible structured logging facade.

## Minimum Service Shape

- Rust services should use `servers/<service-name>/Cargo.toml`, `src/main.rs`, and `src/`. Services with relational persistence should maintain SQLx migrations.
- Public API contracts must define native HTTP route versioning and any Sentry-compatible route behavior before implementation.
- Protobuf scaffolding is required only when an owning API contract selects Protobuf.
- Runtime environment variables should describe the configured capability or dependency rather than repeat the owning service name.

## Integration and Validation

- Update owning project, server, and protobuf contracts in the same change as interface changes.
- Run `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets`, and `cargo test --workspace` after service changes.
- Keep selected Protobuf bindings, SQLx migrations, and documentation synchronized.
