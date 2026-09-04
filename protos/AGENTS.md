# Instructions for `protos/`

- Follow the root `AGENTS.md` and the owning API contract before changing protobuf definitions or generated bindings.
- Use Protobuf only when the owning API contract explicitly selects it.
- Store versioned contracts under `protos/<service-name>/v1`.
- Keep generated bindings for consuming runtimes synchronized with their source contracts and use the repository module import path where applicable.
- Treat field numbers as permanent once published; never reuse removed field numbers.
- Prefer enums when the complete variant set is known.
- Document intentional compatibility breaks and migration requirements in the owning project contract.
- Regenerate bindings and run affected Rust tests whenever protobuf inputs change.
