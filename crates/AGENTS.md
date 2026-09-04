# Instructions for `crates/`

- Follow the root `AGENTS.md` and the owning project or crate contract before implementation.
- Write source code and comments in English.
- Keep public Rust APIs documented and minimize feature coupling between workspace crates.
- Use `tracing` or a compatible structured logging facade for operational events.
- CLI-facing output should enable ANSI color by default and honor `NO_COLOR` where practical.
- Run `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets`, and `cargo test --workspace` after Rust changes.
