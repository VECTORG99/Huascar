# Huascar — AI Agent Directives

Audience: AI agents changing this repository. Keep this file as the entrypoint; use linked docs for full detail.

## Required Reading Order

1. `AGENTS.md` — execution rules, workflow, protected branches.
2. `CONTEXT.md` — required before architecture, routes, persistence, RAG, auth, deployment, or frontend/backend integration changes.
3. `docs/CONVENTIONS.md` — required before code changes; source, tests, docs, Git/PR style.
4. `CONTRIBUTING.md` — AI contributor recipes and PR quality gate.
5. Relevant `docs/adr/*.md` — required before proposing/changing architecture decisions.

## Project Context

- Multi-app repo without npm workspaces.
- Backend: root Express/TypeScript app; entrypoint `src/server.ts` -> `src/app.ts`; root `package.json` owns backend scripts/tests.
- Frontend dashboard: `frontend/` Next app; separate dependency domain.
- Agent creator UI/tool: `agent-creator/` Vite app; separate dependency domain.
- Docs: root docs plus `docs/`, `docs/adr/`; docs are machine-readable for agents.
- Tests: root `test/*.test.mjs` using Node's built-in test runner.

## Code Conventions Summary

- TypeScript is strict ESM; source imports use `.js` specifiers.
- Avoid `any`; use `unknown` at trust boundaries, narrow, then convert.
- Use `src/logger.ts` logger; do not use `console.*` in source.
- Throw `Error`/`AppError` subclasses from `src/errors.ts` when the caller needs stable error shape/status.
- Tests use `node:test` and `node:assert/strict`; do not add a test framework for ordinary unit coverage.
- Keep the smallest safe change; no new dependency, abstraction, folder, or config unless needed now.

## AI Workflow

| Step | Rule |
|---|---|
| Issue | GitHub Issues are the only source of truth. Create/identify the issue and priority label before work; ask only if ambiguous. |
| Branch | Base work on current `origin/development`; use `feature/*`, `fix/*`, `docs/*`, or `hotfix/*`. |
| Implement | Scope changes to the issue; no local tracking docs (`TODO.md`, `BACKLOG.md`) or drive-by refactors. |
| Test | Add/update the smallest useful test for changed behavior/docs/config; run relevant commands. |
| PR | Push branch and open PR to `development` with `Closes #N`, summary, validation, deviations/blockers. |
| Review | Inspect overlapping open PRs/issues before PR; resolve conflicts autonomously when safe. |
| Merge | Merge only through `gh pr merge`; never push directly to `master` or `development`. |

## Testing Commands

Run from repository root unless noted.

| Command | Use |
|---|---|
| `npm run test:unit` | Default required unit/docs/config check. |
| `npx tsc --noEmit` | TypeScript validation after source/API/config changes or when tests require it. |
| `npm run test:all` | Unit plus legacy API test when broader backend confidence is needed. |
| `node --import tsx/esm --test test/<file>.test.mjs` | Narrow test for a touched area. |
| `npm --prefix frontend run build` | Frontend dashboard changes only. |
| `npm --prefix agent-creator run build` | Agent creator changes only. |

## Environment Variables

- Primary reference: `.env.example` at repo root.
- Next dashboard public env is documented in root `.env.example` (for example `NEXT_PUBLIC_API_URL`).
- Agent creator local public env reference: `agent-creator/.env.example` when changing that app.
- Config owner: `src/config.ts`; auth env is also read by `src/middleware/auth.ts`.
- Env/config changes require care: update `.env.example` and docs/tests in the same PR; never print or commit secret values.

## Useful Commands

| Command | Use |
|---|---|
| `git checkout -B <branch> origin/development` | Start/reset an issue branch from integration. |
| `git status --short` | Inspect pending changes. |
| `git diff` | Review unstaged diff before commit/PR. |
| `npm run dev` | Run backend with `tsx watch src/server.ts`. |
| `npm run start` | Run backend once with `tsx src/server.ts`. |
| `npm run typecheck` | Alias for `tsc --noEmit`. |
| `gh issue list` | Check issue overlap. |
| `gh pr list --base development` | Check PR overlap. |
| `gh pr create --base development` | Open required PR. |

## Rules

- No direct pushes to `master` or `development`; all changes go through PRs to `development` unless an explicitly authorized hotfix targets `master`.
- Do not duplicate full docs here; extend `CONTEXT.md`, `docs/CONVENTIONS.md`, `CONTRIBUTING.md`, or ADRs when detail belongs there.
- Do not create unnecessary docs or decorative README prose; agent docs stay direct, structured, path-specific.
- Tests after changes are required; if a check cannot run, document the blocker in PR and final response.
- Config/env/security/auth/deploy changes require matching `.env.example`/docs/tests updates and no secret output.
- CI runs on all branches/PRs; fix failing tests before requesting merge.
- Releases are `development` -> `master` only when requested or milestone-defined.
- Destructive GitHub operations require confirmation: `gh repo delete`, `gh pr merge --admin`, `gh release delete`, irreversible destructive actions.

## GitHub CLI Permissions

Allowed without confirmation: `gh issue create/list/close/edit`, `gh pr create/list/view/diff/checks/edit/merge` without `--admin`, `gh run list/view/rerun`, `gh label create/list`.
