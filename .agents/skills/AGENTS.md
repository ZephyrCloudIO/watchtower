# Instructions for Repository Skills

- Treat `add-issue`, `fix-issue`, `handle-qa-issue`, `manage-pr`, `qa-site-issues`, `repair-pr`, and `write-prd` as human-only skills.
- Every human-only skill must set `policy.allow_implicit_invocation: false` in `agents/openai.yaml`.
- Human-only skill descriptions must require explicit invocation by exact `$skill-name` and must not trigger from task similarity alone.
- Do not remove or relax human-only invocation policy without explicit user approval.
- Keep every `SKILL.md` concise and place detailed supporting material in a directly referenced `references/` file.
- Validate changed skill folders with the repository's skill validation workflow before committing.
