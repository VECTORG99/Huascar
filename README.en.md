<p align="center">
  <img src="docs/images/hackathon/hero-banner.svg" alt="Artemisa - Configuration generator for AI agents" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/HackTheWorld-Team/Artemisa/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/HackTheWorld-Team/Artemisa/ci.yml?branch=master&style=for-the-badge&label=CI&color=8b5cf6" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MPL--2.0-8b5cf6?style=for-the-badge" alt="License: MPL-2.0" /></a>
  <a href="https://artemisa-ai.netlify.app"><img src="https://img.shields.io/badge/Homepage-artemisa--ai.netlify.app-8b5cf6?style=for-the-badge" alt="Homepage" /></a>
</p>

> [!WARNING]
> **REPOSITORY MIGRATED**: This repository has been migrated to the **HackTheWorld-Team** organization and will no longer receive updates.
> Please visit: **[github.com/HackTheWorld-Team/Artemisa](https://github.com/HackTheWorld-Team/Artemisa)** to see the latest code, open issues, or submit pull requests.

> [!IMPORTANT]
> Built for the Kiro x Código Facilito 2026 Hackathon. The entire project was developed using **Kiro** as the agentic IDE.
> Documentation in Spanish. LLM readers: read `AGENTS.md` and `CONTEXT.md` for the full project context.
> The backend only generates configuration: no execution, persistence, or network calls.

<a id="que-es-artemisa"></a>

## What is Artemisa

Artemisa is a **stateless and deterministic** generator of configuration bundles for development and operations agents.

1. The user answers a decision tree of 32 questions (28 mandatory, 4 optional) through the frontend or the API.
2. The backend recomputes progress, the next question, and explainable recommendations in a pure way: same input + same versions = same output.
3. When the tree is complete, it generates a reproducible `JSON` bundle with:
   - `artemisa.blueprint.json` — canonical model of all decisions.
   - `manifest.json` — inventory of artifacts with SHA-256 hashes.
   - `docs/INSTALL.md` and `docs/WHY.md` — application guide and stack rationale.
   - Artifacts for the selected targets: `AGENTS.md`, `.kiro/`, `.cursorrules`, `.coderabbit.yaml`, `mcp.json`, skills, etc.
4. The user reviews and copies the bundle manually into the target project.

The Creator **does not use an LLM** to decide the architecture, **does not execute commands**, **does not write files in the user's project**, **does not use a database**, and **does not require LLM provider keys**.

### Kiro Integration

Artemisa generates native artifacts for **[Kiro](https://aws.amazon.com/kiro/)**, AWS's agentic IDE:

| Artifact                           | Purpose                                          |
| ---------------------------------- | ------------------------------------------------ |
| `.kiro/steering/<agent>.md`        | Agent identity, role and operational constraints |
| `.kiro/hooks/<agent>-quality.json` | Automated quality gates before task completion   |
| `.kiro/skills/<agent>/SKILL.md`    | Reusable agent-specific procedures               |

When you select **Kiro** as a target in the decision tree, the bundle includes these files under `.kiro/`. The schemas for the related configurations (steering, MCPs, RAG and security policy) live in `src/kiro/schemas/*.json` and are validated in CI (`test/kiro-schema.test.mjs`).

### Landing page

![Artemisa landing page — hero with space simulation, floating nav and CTA to Creator](docs/images/screenshot-landing.png)

### Creator Flow

![Creator Flow — from problem to reproducible configuration bundle](docs/images/creator-flow.svg)

<a id="como-funciona"></a>

## How it works

<a id="backend"></a>

### Backend

- `src/server.ts` starts Express and mounts the Creator routes.
- `src/creator/router.ts` exposes public and protected endpoints.
- `src/creator/catalog.ts`, `src/creator/decisionTree.ts`, `src/creator/generator.ts`, and `src/creator/agentProtocol.ts` contain the pure catalog, tree, generation, and agent protocol logic.
- `src/middleware/auth.ts` protects generation routes when `AUTH_REQUIRED=true`.
- No persistence, no agent execution, no network calls.

<a id="frontend"></a>

### Frontend

- Next.js 16 in `frontend/`.
- Landing at `/`.
- Creator at `/agents/new` with four modes: **Auto-short**, **Auto-long**, **Presets**, and **Advanced**.
- The draft is kept in browser `sessionStorage`, versioned by workflow.

<a id="api-del-creator"></a>

## Creator API

Base URL: `/api/v1/creator`

<a id="rutas-publicas"></a>

### Public routes

| Method | Route             | Description                                 |
| ------ | ----------------- | ------------------------------------------- |
| `GET`  | `/catalog`        | Versioned technology catalog                |
| `GET`  | `/workflow`       | Decision tree definition                    |
| `GET`  | `/tutorial`       | Fictional and skippable tutorial            |
| `GET`  | `/skills`         | Available skills catalog                    |
| `GET`  | `/mcps`           | Suggested MCP servers catalog               |
| `GET`  | `/docs`           | Official documentation index                |
| `GET`  | `/agent`          | Complete onboarding protocol                |
| `GET`  | `/agent/start`    | First question + summarized catalog         |
| `POST` | `/agent/answer`   | Send answers and receive the next question  |
| `POST` | `/agent/generate` | Semantic alias of `/preview`                |
| `GET`  | `/startup`        | Self-contained onboarding Markdown document |

<a id="rutas-protegidas"></a>

### Protected routes

| Method | Route       | Description                  |
| ------ | ----------- | ---------------------------- |
| `POST` | `/evaluate` | Evaluate accumulated answers |
| `POST` | `/preview`  | Preview the bundle in memory |
| `POST` | `/generate` | Generate the full bundle     |

<a id="autenticacion-del-creator"></a>

### Creator authentication

- `AUTH_REQUIRED=false` in local development; `AUTH_REQUIRED=true` in production.
- `ARTEMISA_API_KEYS`: comma-separated list of keys. Accepted as:
  - `Authorization: Bearer <key>`
  - `X-API-Key: <key>`
- Do not commit real keys to the repository.

<a id="desarrollo-local"></a>

## Local development

From the repo root (uses npm workspaces):

```bash
npm ci
npm run dev   # backend on http://localhost:3001
```

In another terminal:

```bash
cd frontend && npm run dev   # frontend on http://localhost:3000
```

Tests:

```bash
npm run test:unit
npx tsc --noEmit
```

<a id="despliegue"></a>

## Deployment

See [`docs/deployment.md`](docs/deployment.md) to deploy the backend on Render and the frontend on Vercel. No database, persistent disk, `OPENAI_API_KEY`, or `ARTEMISA_DB_PATH` is required.

<a id="documentacion"></a>

## Documentation

- [`AGENTS.md`](AGENTS.md) — directives for AI agents.
- [`CONTEXT.md`](CONTEXT.md) — full project context.
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — code conventions.
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — contribution guide.
- [`docs/deployment.md`](docs/deployment.md) — deployment.
- [`docs/apply-bundle.md`](docs/apply-bundle.md) — how to apply and validate a bundle.
- [`docs/reference/`](docs/reference/README.md) — examples and guides for generated artifacts.

<a id="licencia"></a>

## License

MPL-2.0 — full, unmodified text in [`LICENSE`](LICENSE).

The copyright notice and the pointer to authors/contributors live in [`NOTICE`](NOTICE): `LICENSE` must stay byte-identical to the canonical text so GitHub can detect the license.
