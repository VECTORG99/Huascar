<p align="center">
  <img src="docs/images/hackathon/hero-banner.svg" alt="Artemisa - Generador de configuración para agentes de IA" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/HackTheWorld-Team/Artemisa/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/HackTheWorld-Team/Artemisa/ci.yml?branch=master&style=for-the-badge&label=CI&color=8b5cf6" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MPL--2.0-8b5cf6?style=for-the-badge" alt="License: MPL-2.0" /></a>
  <a href="https://artemisa-ai.netlify.app"><img src="https://img.shields.io/badge/Homepage-artemisa--ai.netlify.app-8b5cf6?style=for-the-badge" alt="Homepage" /></a>
</p>

> [!WARNING]
> **REPOSITORIO MIGRADO**: Este repositorio ha sido migrado a la organización **HackTheWorld-Team** y ya no recibirá actualizaciones.
> Por favor, dirígete a: **[github.com/HackTheWorld-Team/Artemisa](https://github.com/HackTheWorld-Team/Artemisa)** para ver el código más reciente, abrir issues o enviar pull requests.

> [!IMPORTANT]
> Construido para el Hackathon Kiro x Código Facilito 2026. El proyecto se desarrolló íntegramente con **Kiro** como IDE agentic.
> Documentación en español. Lectores LLM: leer `AGENTS.md` y `CONTEXT.md` para el contexto completo del proyecto.
> El backend solo genera configuración: no hay ejecución, persistencia ni llamadas de red.

## Qué es Artemisa

Artemisa es un generador **stateless y determinista** de bundles de configuración para agentes de desarrollo y operación.

1. El usuario responde un árbol de decisiones de 32 preguntas (28 obligatorias, 4 opcionales) a través del frontend o la API.
2. El backend recalcula el progreso, la siguiente pregunta y las recomendaciones explicables de forma pura: misma entrada + mismas versiones = misma salida.
3. Cuando el árbol está completo, genera un bundle `JSON` reproducible con:
   - `artemisa.blueprint.json` — modelo canónico de todas las decisiones.
   - `manifest.json` — inventario de artefactos con hashes SHA-256.
   - `docs/INSTALL.md` y `docs/WHY.md` — guía de aplicación y justificación del stack.
   - Artefactos para los targets elegidos: `AGENTS.md`, `.kiro/`, `.cursorrules`, `.coderabbit.yaml`, `mcp.json`, skills, etc.
4. El usuario revisa y copia el bundle manualmente en el proyecto destino.

El Creator **no usa un LLM** para decidir la arquitectura, **no ejecuta comandos**, **no escribe archivos en el proyecto del usuario**, **no usa base de datos** y **no requiere claves de proveedores de LLM**.

### Integración con Kiro

Artemisa genera artefactos nativos para **[Kiro](https://aws.amazon.com/kiro/)**, la IDE agentic de AWS:

| Artefacto                           | Propósito                                             |
| ----------------------------------- | ----------------------------------------------------- |
| `.kiro/steering/<agente>.md`        | Identidad, rol y constraints operacionales del agente |
| `.kiro/hooks/<agente>-quality.json` | Quality gates automáticos previos a finalizar tareas  |
| `.kiro/skills/<agente>/SKILL.md`    | Procedimientos reutilizables específicos del agente   |

Cuando seleccionás **Kiro** como target en el árbol de decisiones, el bundle incluye estos archivos dentro de `.kiro/`. Los esquemas de las configuraciones relacionadas (steering, MCPs, RAG y política de seguridad) están en `src/kiro/schemas/*.json` y se validan en CI (`test/kiro-schema.test.mjs`).

### Landing page

![Landing page de Artemisa — hero con simulación espacial, navegación flotante y CTA al Creator](docs/images/screenshot-landing.png)

### Flujo del Creator

![Flujo del Creator — de problema a bundle de configuración reproducible](docs/images/creator-flow.svg)

## Cómo funciona

### Backend

- `src/server.ts` levanta Express y monta las rutas del Creator.
- `src/creator/router.ts` expone los endpoints públicos y protegidos.
- `src/creator/catalog.ts`, `src/creator/decisionTree.ts`, `src/creator/generator.ts` y `src/creator/agentProtocol.ts` contienen la lógica pura de catálogo, árbol, generación y protocolo de agentes.
- `src/middleware/auth.ts` protege las rutas de generación cuando `AUTH_REQUIRED=true`.
- No hay persistencia, no hay ejecución de agentes, no hay llamadas de red.

### Frontend

- Next.js 16 en `frontend/`.
- Landing en `/`.
- Creator en `/agents/new` con cuatro modos: **Auto-corto**, **Auto-largo**, **Presets** y **Avanzado**.
- El borrador se conserva en `sessionStorage` del navegador, versionado por workflow.

## API del Creator

Base URL: `/api/v1/creator`

### Rutas públicas

| Método | Ruta              | Descripción                                    |
| ------ | ----------------- | ---------------------------------------------- |
| `GET`  | `/catalog`        | Catálogo tecnológico versionado                |
| `GET`  | `/workflow`       | Definición del árbol de decisiones             |
| `GET`  | `/tutorial`       | Tutorial ficticio y skippable                  |
| `GET`  | `/skills`         | Catálogo de skills disponibles                 |
| `GET`  | `/mcps`           | Catálogo de servidores MCP sugeridos           |
| `GET`  | `/docs`           | Índice de documentación oficial                |
| `GET`  | `/agent`          | Protocolo completo de onboarding               |
| `GET`  | `/agent/start`    | Primera pregunta + catálogo resumido           |
| `POST` | `/agent/answer`   | Enviar respuestas y recibir siguiente pregunta |
| `POST` | `/agent/generate` | Alias semántico de `/preview`                  |
| `GET`  | `/startup`        | Documento Markdown de onboarding               |

### Rutas protegidas

| Método | Ruta        | Descripción                        |
| ------ | ----------- | ---------------------------------- |
| `POST` | `/evaluate` | Evaluar respuestas acumuladas      |
| `POST` | `/preview`  | Previsualizar el bundle en memoria |
| `POST` | `/generate` | Generar el bundle completo         |

### Autenticacion del Creator

- `AUTH_REQUIRED=false` en desarrollo local; `AUTH_REQUIRED=true` en producción.
- `ARTEMISA_API_KEYS`: lista de claves separadas por comas. Se aceptan como:
  - `Authorization: Bearer <key>`
  - `X-API-Key: <key>`
- no commitees claves reales en el repositorio.

## Desarrollo local

Desde la raíz del repo (usa npm workspaces):

```bash
npm ci
npm run dev   # backend en http://localhost:3001
```

En otra terminal:

```bash
cd frontend && npm run dev   # frontend en http://localhost:3000
```

Tests:

```bash
npm run test:unit
npx tsc --noEmit
```

## Despliegue

Ver [`docs/deployment.md`](docs/deployment.md) para desplegar el backend en DigitalOcean App Platform y el frontend en Vercel. No se requiere base de datos, disco persistente, `OPENAI_API_KEY` ni `ARTEMISA_DB_PATH`.

## Documentación

- [`AGENTS.md`](AGENTS.md) — directivas para agentes IA.
- [`CONTEXT.md`](CONTEXT.md) — contexto completo del proyecto.
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — convenciones de código.
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — guía de contribución.
- [`docs/deployment.md`](docs/deployment.md) — despliegue.
- [`docs/apply-bundle.md`](docs/apply-bundle.md) — cómo aplicar y validar un bundle.
- [`docs/reference/`](docs/reference/README.md) — ejemplos y guías de artefactos generados.

## Licencia

MPL-2.0 — texto íntegro y sin modificar en [`LICENSE`](LICENSE).

El aviso de copyright y la referencia a autores/contributors viven en [`NOTICE`](NOTICE): `LICENSE` debe quedar byte a byte igual al texto canónico para que GitHub detecte la licencia.
