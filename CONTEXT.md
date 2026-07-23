# Huascar Project Context

Updated: 2026-07-23

## State

- Repository is a multi-app repo without npm workspaces: root Express/TypeScript backend, `frontend/` Next dashboard, and `agent-creator/` Vite tool. Root `package.json` owns backend scripts/tests.
- Backend entrypoint: `src/server.ts` -> `src/app.ts`. Express app mounts public creator catalog/workflow/tutorial before auth, then `/api` health/openapi/metrics, then protected API routes.
- Persistent state uses SQLite through `better-sqlite3` in `src/engine/Store.ts`; database path defaults to `./data/huascar.db` via `HUASCAR_DB_PATH`.
- SQLite retention cleanup is bounded by `RETENTION_EXECUTION_MAX_AGE_DAYS`, `RETENTION_EXECUTION_MAX_COUNT`, and `RETENTION_RAG_CHUNKS_MAX_PER_SOURCE`; `RETENTION_CLEANUP_ON_START=false` by default.
- Migrations are code-based and run at `Store` construction: `001_create_executions`, `002_create_rag_documents`, `003_add_rag_hashes`, `004_create_sessions`, `005_create_agents`.
- Agent execution is centralized in `src/engine/HuascarEngine.ts`: steering role resolution, MCP tool wrapping, RAG loading/context, AI SDK provider fallback, and execution history persistence.
- Current default steering roles are `PR_REVIEWER`, `SCAFFOLDER`, `TESTER`, `DOCUMENTER`, `REFACTORER`, `DEBUGGER`, and `DEVOPS` in `src/kiro/steering.json`; `STEERING_CONFIG_PATH` can point at an external JSON file.
- Auth is environment-driven in `src/middleware/auth.ts`: `AUTH_REQUIRED=false` by default; `AUTH_REQUIRED=true` requires `HUASCAR_API_KEYS` through `Authorization: Bearer` or `X-API-Key`.

## What Works

- JSON API routes:
  - `GET /api/health`, `GET /api/metrics`, `GET /api/openapi.json` are mounted before protected route auth.
  - `POST /api/agent/execute` runs a role/task and returns JSON.
  - `POST /api/agent/execute/stream` emits SSE events: `start`, `complete`, or `error`.
  - `GET /api/history` returns execution history from SQLite.
  - `GET /api/roles` reads roles from steering config and returns safe metadata (`description`, `recommended_tools`, `examples`) without `system_prompt`.
  - `GET /api/rag/sources` and `DELETE /api/rag/sources/:source` inspect/remove indexed RAG chunks.
  - `/api/agents` CRUD stores generated agent configs; `/api/agents/:id/execute` runs a registered agent.
  - `/api/v1/creator/catalog|workflow|tutorial` are public; `/evaluate|preview|generate` are protected by API auth when enabled.
- Sessions work for direct and registered agent execution: `SessionManager` creates/touches SQLite sessions, enforces role matching and TTL, and injects recent messages into the next task.
- SSE currently wraps the same execution path as JSON and reports lifecycle events; token/tool streaming is not implemented.
- RAG supports `local_file`, `local_directory`, `inline`, and `web_url` sources in code; persisted vector chunks use OpenAI embeddings only when `OPENAI_API_KEY` and a `Store` exist.
- `src/kiro/rag.json` is schema-tested as a local-file source list and currently indexes the configured docs sources, including `docs/CONVENTIONS.md`, `CONTRIBUTING.md`, and this `CONTEXT.md`.
- MCP config exists in `src/kiro/mcps.json` for filesystem, bash, and GitHub servers; `McpConnectionPool` supplies connected tools to `HuascarEngine`.
- Next dashboard in `frontend/src/app/page.tsx` can list roles, submit tasks, show terminal/history tabs, and deep-link imported role/task/config query params.
- Next creator route `frontend/src/app/agents/new/page.tsx` consumes backend creator workflow/catalog, generates a bundle, and registers it through `/api/agents`.

## Known Limitations

- Root and frontends are separate dependency/install domains; there is no root npm workspace.
- `src/kiro/schemas/rag.schema.json` only models `knowledge_bases[]` entries with `type` and `path`, even though `RagEngine` supports more source shapes in TypeScript.
- RAG web URL SSRF protection is a hostname blocklist, not DNS-resolution based.
- RAG embeddings require OpenAI; without `OPENAI_API_KEY`, content can load into runtime prompt context but persisted vector search is unavailable.
- SSE does not stream partial model tokens or tool calls.
- Auth middleware captures env values at module load. Test/process env changes after import do not reconfigure auth.
- Registered agents store config as JSON text in SQLite; no separate normalized table for tools/knowledge/roles.
- Render backend config sets `LLM_MOCK_MODE=true` in `render.yaml` and uses `/data/huascar.db`; persistence needs an attached Render Disk or external DB.
- Next `NEXT_PUBLIC_API_URL` is build-time baked. `frontend/src/lib/api.ts` falls back to `https://huascar.onrender.com`.

## Constraints

- Follow `AGENTS.md`: GitHub Issues are source of truth; PRs target `development`; do not push directly to `master` or `development`.
- Do not implement local tracking docs (`TODO.md`, backlog files) for pending work.
- Keep docs for agents direct, structured, and file/path-specific.
- New code should include tests; root unit tests run with `npm run test:unit`.
- Root backend target is TypeScript ESM (`type: module`) and uses `.js` import specifiers in source.
- Request JSON body limit is `128kb`; global request timeout defaults to `REQUEST_TIMEOUT_MS=120000`.
- CORS default origins are `http://localhost:3000,http://localhost:5173`; override with `CORS_ALLOWED_ORIGINS`.

## Module Dependency Graph

```text
src/server.ts
  -> src/app.ts
     -> src/config.ts
     -> src/engine/Store.ts
        -> src/engine/Migrations.ts
        -> src/engine/migrations/*.ts
     -> src/middleware/auth.ts
     -> src/middleware/notFound.ts
     -> src/middleware/errorHandler.ts
     -> src/routes/{health,metrics,openapi,history,roles,rag,hooks}.ts
     -> src/routes/agent.ts
        -> src/engine/SessionManager.ts
        -> src/engine/HuascarEngine.ts
     -> src/routes/agents.ts
        -> src/engine/SessionManager.ts
        -> src/engine/HuascarEngine.ts
     -> src/creator/router.ts
        -> src/creator/{catalog,decisionTree,generator,domain}.ts

src/engine/HuascarEngine.ts
  -> src/kiro/hooks.ts
  -> src/engine/RagEngine.ts
     -> src/engine/VectorIndex.ts
     -> src/engine/Store.ts
  -> src/engine/McpConnectionPool.ts
  -> src/engine/LlmProvider.ts

frontend/src/app/page.tsx
  -> frontend/src/lib/api.ts
  -> frontend/src/hooks/*
  -> frontend/src/components/dashboard/*

frontend/src/app/agents/new/page.tsx
  -> frontend/src/lib/api.ts
  -> frontend/src/types/{agent,creator}.ts
```

## Critical Paths

- HTTP startup: `src/server.ts` -> `src/app.ts` -> `new Store()` -> migrations -> route mounting.
- Direct execution: `/api/agent/execute` -> `SessionManager.getOrCreate()` -> `HuascarEngine.executeTask()` -> optional MCP/RAG -> LLM/mock -> `Store.saveExecution()` -> session assistant message.
- Streaming execution: `/api/agent/execute/stream` -> same execution path -> SSE `start` and final `complete|error`.
- Registered agent execution: `/api/agents/:id/execute` -> load JSON config -> registered steering role -> session key `${agent.id}:${role}` -> engine -> `recordAgentExecution()`.
- RAG ingestion/query: `src/kiro/rag.json` -> `RagEngine.loadSources()` -> chunk/hash/embed -> `rag_documents` -> `VectorIndex.search()` -> prompt context.
- Creator registration: Next `/agents/new` -> backend creator workflow/evaluate/generate -> `registerAgent()` -> `/api/agents` -> SQLite `agents`.
- Auth boundary: all `/api` routes mounted after line-level auth middleware are protected only when `AUTH_REQUIRED=true`; creator public endpoints are mounted before this boundary.

## Do Not Touch / High-Risk Zones

- Migration IDs/order in `src/engine/migrations/index.ts`; changing existing migrations can corrupt or skip live SQLite state.
- `Store` schema assumptions and JSON serialization for `agents.config` and `rag_documents.embedding`.
- `src/middleware/auth.ts` fail-closed behavior when `AUTH_REQUIRED=true` and no keys are configured.
- `src/kiro/schemas/*.json` and matching `src/kiro/*.json`; schema tests are intentionally strict.
- `HuascarEngine.buildAiTools()` hook call before MCP tool execution; security hooks depend on it.
- Frontend API base URL behavior: `NEXT_PUBLIC_API_URL` is a build-time public env var.
- Render SQLite path `/data/huascar.db`; persistent production data requires Render Disk or DB migration.

## Non-Goals

- Do not expand `AGENTS.md` into a full conventions/contributing guide here.
- Do not implement issue #14 full AGENTS expansion, issue #70 `CONVENTIONS`, or issue #79 `CONTRIBUTING` from this context task.
- Do not introduce npm workspaces unless a future issue explicitly changes ADR-0005.
- Do not replace SQLite or add external vector DB infrastructure without a separate architecture decision.
- Do not add token-level streaming to SSE as part of documentation updates.

## How To Update This Document

- Update this file in the same PR that changes architecture, deploy topology, route shape, auth behavior, migrations, RAG sources/schema, or frontend/backend integration.
- Keep entries machine-readable: short bullets, explicit paths, concrete route/env names, no narrative history.
- Update the `Updated:` line with the edit date.
- If RAG source schema changes, keep `src/kiro/rag.json` and `test/kiro-schema.test.mjs` valid.
- Run at least `npm run test:unit` after editing this document or RAG config.
