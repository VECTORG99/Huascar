# ADR-0005: Current repository layout without npm workspaces

## Status

Accepted

## Context

- Root `package.json` owns backend scripts, tests, TypeScript, and lockfile.
- `frontend/` has its own Next.js `package-lock.json` and app lifecycle.
- `agent-creator/` has its own Vite `package-lock.json` and app lifecycle.
- Root scripts call frontend tasks by changing directory, e.g. `dev:agent-creator`.
- There is no root `workspaces` field.

## Decision

- Keep the current repo layout without npm workspaces.
- Treat root backend, `frontend/`, and `agent-creator/` dependencies as separate install/update domains.
- Do not add workspace tooling until shared package management is required.

## Alternatives Considered

- npm workspaces: rejected for now; adds lockfile/workspace behavior without current shared packages.
- Split repositories: rejected; issue/PR coordination and Docker/deployment config still span both parts.
- Move all frontend dependencies to root: rejected; couples unrelated build/runtime dependency graphs.

## Consequences

- Backend CI/test commands remain simple at repo root.
- Frontend dependency churn does not rewrite the root lockfile.
- Cross-package scripts are manual and directory-based.
- Shared code between backend and frontend would need duplication or a future package boundary.

## Revisit Conditions

- A shared library is needed by root backend and frontend.
- CI spends significant time on duplicate installs that workspaces would reduce.
- Release automation needs atomic versioning across multiple packages.
