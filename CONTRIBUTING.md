# AI Contributor Guide

Audience: AI agents changing this repository. Keep changes issue-scoped, schema-valid, tested, and routed through PRs to `development`.

## Quick Reference

| Scenario | Read first | Change here | Required check |
|---|---|---|---|
| Any code/doc change | `AGENTS.md`, `docs/CONVENTIONS.md` | Issue branch from `origin/development` | `git diff`, relevant tests |
| Architecture/route/persistence/RAG/auth/deploy integration | `CONTEXT.md`, relevant `docs/adr/*` | Smallest owning module | Update `CONTEXT.md` if state changed |
| Add backend route | `src/app.ts`, nearby `src/routes/*.ts`, `test/app.test.mjs` | `src/routes/<resource>.ts`, `src/app.ts` | `npm run test:unit`, `npx tsc --noEmit` |
| Change request validation | Target route/parser tests | Route-owned parser/helper | Unit test for accepted/rejected input |
| Add migration | `src/engine/Migrations.ts`, `src/engine/migrations/index.ts` | New numbered file only | Store/migration unit test |
| Change SQLite persistence | `src/engine/Store.ts`, migrations | Store method + migration if durable shape changes | `npm run test:unit` |
| Add steering role | `src/kiro/steering.json`, schema | `roles.<KEY>` | `npm run test:unit` |
| Add MCP server | `src/kiro/mcps.json`, schema | `mcpServers.<name>` | `npm run test:unit` |
| Add RAG source | `src/kiro/rag.json`, schema | `knowledge_bases[]` | `npm run test:unit` |
| Add security rule | `src/kiro/security-policy.json`, `src/kiro/hooks.ts` | Policy JSON first; code only if needed | Hook/schema unit tests |
| Frontend dashboard change | `frontend/src/app/page.tsx`, `frontend/src/lib/api.ts` | Existing page/component | Root checks if backend types changed |
| Add frontend route | Existing `frontend/src/app/**/page.tsx` pattern | `frontend/src/app/<route>/page.tsx` | Frontend build/test if available |
| Register agent behavior | `src/routes/agents.ts`, `src/engine/HuascarEngine.ts` | Route/engine owner | Agents route/session tests |
| OpenAPI/API contract change | `src/routes/openapi.ts`, route tests | OpenAPI + route response together | `npm run test:unit` |
| Env/config change | `src/config.ts`, `.env.example` if present | Config boundary only | Config/unit test, no secret output |

## PR Quality Gate

- [ ] Issue exists and PR body includes `Closes #<number>`.
- [ ] Branch is based on current `origin/development`.
- [ ] Scope only covers the issue; no drive-by refactors or formatting.
- [ ] New behavior has the smallest useful test, or skip reason is in PR body.
- [ ] `npm run test:unit` passed, or failure/blocker is documented.
- [ ] `npx tsc --noEmit` passed, or failure/blocker is documented.
- [ ] JSON config files in `src/kiro/*.json` remain schema-valid.
- [ ] Public API changes update tests and OpenAPI docs together.
- [ ] Persistence changes add new migrations; existing migration IDs/order unchanged.
- [ ] RAG/auth/deploy/frontend-backend integration changes update `CONTEXT.md`.
- [ ] No secrets, tokens, raw `.env` values, generated databases, or build artifacts committed.
- [ ] PR targets `development`, not `master`.

## Architecture Rules / Constraints

- Backend entrypoint: `src/server.ts` -> `src/app.ts`; app wiring stays thin.
- Route modules own HTTP parsing/status/response shape; engine/store modules own behavior and persistence.
- SQLite durable schema changes use append-only migrations under `src/engine/migrations/`; never rewrite existing migrations.
- `Store` constructs and runs migrations; keep data invariants close to SQL where possible.
- `HuascarEngine` owns direct execution, registered-agent execution support, steering, MCP wrapping, RAG context, and provider fallback.
- Auth boundary lives in `src/middleware/auth.ts`; do not weaken fail-closed behavior when `AUTH_REQUIRED=true`.
- Kiro configs in `src/kiro/*.json` must match `src/kiro/schemas/*.json` and be tested by `test/kiro-schema.test.mjs`.
- RAG supports schema-mode `local_file` entries in `src/kiro/rag.json`; use relative paths from repo root.
- Frontends are separate install domains (`frontend/`, `agent-creator/`); do not introduce root workspaces unless an issue explicitly requires it.
- Root TypeScript is ESM; source imports use `.js` specifiers.
- No new dependency for behavior that Node, TypeScript, Express, SQLite, CSS, or an installed package already covers.
- Generated/build output and local tracking docs are not source changes.

## How To Test Changes

Run from repository root unless noted.

```bash
npm run test:unit
npx tsc --noEmit
```

Useful narrower checks:

```bash
node --import tsx/esm --test test/kiro-schema.test.mjs
node --import tsx/esm --test test/contributing.test.mjs
node --import tsx/esm --test test/agents-route.test.mjs
npm run test:all
```

Frontend checks are separate dependency domains; run only when that app changed:

```bash
npm --prefix frontend run build
npm --prefix agent-creator run build
```

## Recipes

### Add Role

1. Edit `src/kiro/steering.json` under `roles` with an uppercase key, `name`, `description`, `recommended_tools`, `examples`, `system_prompt`, and `temperature`.
2. For runtime-specific roles, point `STEERING_CONFIG_PATH` at an external schema-valid JSON file instead of editing source.
3. Keep JSON schema-valid; do not add fields unless `src/kiro/schemas/steering.schema.json` changes with tests.
4. If route exposure changes, update `src/routes/roles.ts` tests.
5. Run `npm run test:unit`.

### Add MCP Server

1. Edit `src/kiro/mcps.json` under `mcpServers` with `command`, `args`, optional `env`, and `description`.
2. Prefer already-used `npx` command shape; avoid secrets in JSON values.
3. If connection behavior changes, update `src/engine/McpConnectionPool.ts` tests.
4. Run `npm run test:unit`.

### Add RAG Source

1. Add `{ "type": "local_file", "path": "./relative/path.md" }` to `src/kiro/rag.json`.
2. Keep the target file committed and useful for agent context.
3. Do not add unsupported schema fields without changing `src/kiro/schemas/rag.schema.json` and tests.
4. Run `npm run test:unit`.

### Add Security Rule

1. If a blocked substring/tool pattern is enough, edit `src/kiro/security-policy.json` only.
2. If matching semantics change, edit `src/kiro/hooks.ts` and add/adjust `test/hooks.test.mjs`.
3. Never log secrets while testing policy failures.
4. Run `npm run test:unit`.

### Add Endpoint

1. Add or update the owning route in `src/routes/`.
2. Mount it in `src/app.ts` at the correct auth boundary.
3. Validate params/body at the route boundary; return stable status codes and JSON shapes.
4. Update `src/routes/openapi.ts` if public contract changes.
5. Add route tests, then run `npm run test:unit` and `npx tsc --noEmit`.

### Add Migration

1. Create `src/engine/migrations/NNN_short_name.ts` with the next unused number.
2. Export a `Migration` object/function matching existing files.
3. Append it to `initialMigrations` in `src/engine/migrations/index.ts`; do not reorder old entries.
4. Add a `Store`/migration test proving old DB state upgrades.
5. Run `npm run test:unit`.

### Add Frontend Route

1. Add `frontend/src/app/<route>/page.tsx` using existing app-router patterns.
2. Put shared API calls in `frontend/src/lib/api.ts` only when at least two callers need them now.
3. Keep `NEXT_PUBLIC_API_URL` behavior unchanged unless the issue is deploy/config-specific.
4. Run the relevant frontend build/test command if dependencies are installed.

### Add Registered Agent

1. Use `/api/agents` route behavior in `src/routes/agents.ts` and persisted config in `Store`.
2. Keep config JSON serializable; do not normalize into new tables without a migration issue.
3. Execution should flow through `HuascarEngine` and `SessionManager` like existing registered-agent calls.
4. Update `test/agents-route.test.mjs` or `test/agent-session.test.mjs`.
5. Run `npm run test:unit` and `npx tsc --noEmit`.
