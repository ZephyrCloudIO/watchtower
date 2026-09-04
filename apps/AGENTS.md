# Instructions for `apps/`

- Follow the root `AGENTS.md`, the owning `docs/project-*.md`, and the matching app-domain contract before implementation.
- Keep repository-wide and app-domain policy changes synchronized with affected contracts.
- Write source code and comments in English.
- Prefer enums or typed constants for stable route IDs, capability IDs, analytics events, and persisted UI state.

## Runtime and Tooling

- Use React for frontend UI unless an owning contract records an exception.
- Use Rsbuild or another Rspack-family library; raw Rspack requires a documented rationale.
- Use TanStack Router when client-side routing is required.
- Deduplicate `react` and `react-dom` when an application compiles shared workspace source.
- Use `pnpm` for dependency installation, scripts, and workspace orchestration.
- Document and test authorization, route guards, scope attribution, and user-visible error behavior.
- Do not expose secrets, session material, or unrestricted payloads in client logs, browser storage, or native bridges.
- Prefer structured telemetry and machine-readable events over ad-hoc text logs.

## Integration and Validation

- Update owning project and app-domain contracts when routes, interfaces, native capabilities, or user-visible flows change.
- Run package-scoped `pnpm lint`, `pnpm test`, and `pnpm build` for changed applications.
- Keep generated routes, static assets, permission manifests, and documentation synchronized with their inputs.
