# Huascar — AI-Driven Development Directives

Project-state source for agents: read root `CONTEXT.md` before changing architecture, routes, persistence, RAG, auth, deployment, or frontend/backend integration. Read `docs/CONVENTIONS.md` before code changes. Use `CONTRIBUTING.md` for AI contributor recipes and PR quality gates.

## 1. Modalidad de Trabajo: AI-Driven Development

Todo desarrollo en este repositorio es conducido por agentes AI. El humano supervisa, aprueba y dirige. El agente ejecuta, documenta y resuelve de forma autónoma.

## 2. Issue Tracking (GitHub Issues — Única Fuente de Verdad)

- **NUNCA** crear archivos locales de tracking (`TODO.md`, `BACKLOG.md`, listas en comentarios, etc.).
- Todo trabajo pendiente, bug, mejora o tarea se registra como **GitHub Issue** usando `gh issue create`.
- Antes de empezar cualquier trabajo, el agente **DEBE**:
  1. Crear o identificar el issue correspondiente en GitHub.
  2. Asignar etiqueta de prioridad (`priority:critical`, `priority:high`, `priority:medium`, `priority:low`).
  3. Confirmar con el usuario qué issue trabajar si hay ambigüedad.

## 3. Branching Strategy

| Rama | Propósito |
|---|---|
| `master` | Producción. Solo recibe merges de `development` en releases. Dispara deploys y automatizaciones de producción. |
| `development` | Integración. Todo PR apunta aquí. Rama base para nuevas features y fixes. |
| `feature/*`, `fix/*`, `hotfix/*` | Ramas de trabajo. Se crean desde `development`. |

- **NUNCA** hacer push directo a `master` salvo hotfix urgente autorizado explícitamente por el usuario.
- **NUNCA** hacer push directo a `development`. Todo pasa por PR.

## 4. Pull Requests (Obligatorio)

- Todo cambio (feature, fix, refactor, docs) **DEBE** pasar por PR.
- PR target: `development` (salvo hotfix urgente → `master`).
- Merge de PRs se ejecuta exclusivamente con `gh pr merge`.
- Antes de crear un PR, el agente **DEBE**:
  1. Revisar PRs e issues abiertos para detectar solapamiento o conflictos potenciales.
  2. Si hay conflicto: intentar resolver autónomamente. Si no es posible, preguntar al usuario.
  3. Vincular el issue correspondiente en el PR (`Closes #N`).

## 5. CI / Testing

- CI y tests corren en **todas** las ramas (`master`, `development`) y en **todos** los PRs sin excepción.
- Los tests no tienen restricciones de rama ni requieren ejecución manual.
- Todo nuevo código debe incluir tests. No hay excepciones.
- Si un test falla en CI, el agente debe corregirlo antes de solicitar merge.

## 6. Releases

- Release = merge de `development` → `master`.
- Solo se hace release cuando el usuario lo solicita o cuando se cumple un milestone definido.
- Todo deploy y automatización de producción se dispara desde `master`.

## 7. Resolución de Conflictos y Autonomía

- El agente debe minimizar la interacción con el usuario. Resolver de forma autónoma siempre que sea posible.
- Si hay PRs o issues similares/solapados:
  1. Detectar antes de crear nuevos.
  2. Consolidar si es viable.
  3. Preguntar al usuario solo si la decisión es ambigua o destructiva.
- Si hay conflictos de merge: resolver autónomamente si el cambio es claro. Preguntar solo si hay riesgo de pérdida de lógica.

## 8. Documentación (Para LLMs, No Para Humanos)

- Toda documentación generada está optimizada para consumo de agentes AI.
- Directa, técnica, sin narrativa innecesaria, sin introducciones genéricas, sin disclaimers.
- Formato: datos estructurados, listas, tablas, referencias a archivos/líneas concretas.
- No generar READMEs decorativos ni guías de "getting started" salvo que el usuario lo pida explícitamente para humanos.
- Comentarios en código: solo cuando el contexto no es obvio para un LLM leyendo el AST.
- Antes de proponer cambios de arquitectura, leer ADRs relevantes en `docs/adr/` y citar impactos.

## 9. GitHub CLI — Ejecución Sin Confirmación

El agente tiene autorización total para ejecutar comandos de `gh` CLI sin pedir confirmación, incluyendo:
- `gh issue create`, `gh issue list`, `gh issue close`, `gh issue edit`
- `gh pr create`, `gh pr list`, `gh pr merge` (sin --admin), `gh pr edit`
- `gh pr view`, `gh pr diff`, `gh pr checks`
- `gh run list`, `gh run view`, `gh run rerun`
- `gh label create`, `gh label list`

**Excepciones que SÍ requieren confirmación:**
- `gh repo delete`
- `gh pr merge --admin`
- `gh release delete`
- Cualquier operación destructiva irreversible
