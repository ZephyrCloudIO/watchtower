# Instructions for `packages/`

- Follow the root `AGENTS.md` and the owning package contract before implementation.
- Keep shared packages reusable and independent of application-specific runtime state.
- Use strict TypeScript settings and named exports.
- Prefer explicit public entry points; do not expose internal modules accidentally through broad barrel exports.
- Declare peer dependencies for framework runtimes that must remain singleton, including React.
- Run package-scoped lint, test, type-check, and build commands after changes.
