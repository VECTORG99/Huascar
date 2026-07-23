# ADR-0001: SQLite persistence via better-sqlite3

## Status

Accepted

## Context

- `src/engine/Store.ts` persists executions, registered agents, sessions, and RAG chunks.
- `config.paths.db` defaults to `./data/huascar.db` and is overrideable with `HUASCAR_DB_PATH`.
- Migrations live in `src/engine/migrations/` and run at `Store` initialization.
- Runtime is a small Express/agent backend, not a multi-writer distributed service.

## Decision

- Use local SQLite through `better-sqlite3` as the primary durable store.
- Enable WAL mode on open.
- Keep schema changes in explicit TypeScript migrations.

## Alternatives Considered

- PostgreSQL: rejected for current scope; adds service provisioning, credentials, network failure modes, and CI setup.
- In-memory store: rejected; loses execution history, sessions, agents, and RAG cache across restarts.
- JSON files: rejected; weak concurrent write semantics and awkward query/update paths.

## Consequences

- Simple local development and test setup; no external database required.
- Persistence can be copied/backed up as one DB file plus WAL files.
- Horizontal scale is limited by SQLite write concurrency and shared filesystem assumptions.
- Long-running write transactions can block other writes.

## Revisit Conditions

- Multiple backend replicas need to write the same logical store.
- Hosted deployment cannot provide reliable local disk persistence.
- Query volume or write contention exceeds SQLite/WAL behavior in production metrics.
