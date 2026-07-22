# Huascar

**Plataforma open-source para montar agentes de IA en segundos mediante configuracion declarativa.**

Inspirado en como Kiro simplifica la interaccion con modelos, Huascar abstrae la complejidad de los agentes de IA (ReAct, RAG, MCP, Hooks) en 4 primitivas de configuracion. Los equipos de desarrollo definen **que** quieren automatizar, no **como** hacerlo.

---

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│        (Agent Creator - Vite + React)            │
│  Cuestionario → Config JSON → POST /api/agent    │
└─────────────────────┬───────────────────────────┘
                      │ HTTP
┌─────────────────────▼───────────────────────────┐
│              Backend (Express)                   │
│                                                  │
│  ┌─────────────────────────────────────────┐     │
│  │          HuascarEngine                   │     │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌─────┐  │     │
│  │  │Steer.│  │RAG   │  │Hooks │  │MCPs │  │     │
│  │  │(rol) │  │(cono-│  │(seg- │  │(herr-│  │     │
│  │  │      │  │cimi- │  │urid- │  │amien-│  │     │
│  │  │      │  │ento) │  │ad)   │  │tas)  │  │     │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  ┌─────────────────────────────────────────┐     │
│  │  LLM (OpenAI / Anthropic via Vercel AI) │     │
│  └─────────────────────────────────────────┘     │
└──────┬──────────────────────────────────┬────────┘
       │                                  │
       ▼                                  ▼
  Servidores MCP                    Repositorio/API
  (GitHub, Bash, FS)                (RAG, docs)
```

---

## Stack

| Componente | Tecnologia |
|---|---|---|
| Backend | Node.js, Express, TypeScript, SQLite |
| Frontend (Dashboard) | Next.js 16, TailwindCSS v4 |
| Frontend (Agent Creator) | Vite, React, JavaScript, TailwindCSS v4 |
| LLM | Vercel AI SDK (OpenAI, Anthropic) |
| MCP | @modelcontextprotocol/sdk |
| Containerizacion | Docker multi-stage, docker compose v2 |

---

## Configuracion (Archivos Kiro)

Huascar separa la configuracion del agente en 4 archivos dentro de `src/kiro/`:

### `steering.json`
Define la personalidad del agente.
```json
{
  "roles": {
    "PR_REVIEWER": {
      "name": "Senior Code Reviewer",
      "system_prompt": "Eres un revisor de codigo Senior. Busca vulnerabilidades...",
      "temperature": 0.2
    }
  }
}
```

### `hooks.ts`
Middleware de seguridad. Intercepta acciones antes de que se ejecuten.
- `before_action`: bloquea comandos destructivos (`rm -rf`, `git push --force`)
- `on_commit`: requiere aprobacion humana para commits

### `mcps.json`
Servidores MCP que el agente puede usar como herramientas.
```json
{
  "mcpServers": {
    "github-integration": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

### `rag.json`
Fuentes de conocimiento del agente: fuentes inline, web_url, GitHub files.
Se vectorizan automaticamente (embeddings via OpenAI + SQLite store).

---

## Quick Start

### Local

```bash
# Terminal 1 - Backend
cd huascar
npm install
npm run dev       # http://localhost:3001

# Terminal 2 - Agent Creator
cd agent-creator
npm install
npm run dev       # http://localhost:5173
```

### Docker

```bash
make docker-build   # o: docker compose build
make docker-up      # o: docker compose up -d

# Servicios:
# Backend:       http://localhost:3001
# Dashboard:     http://localhost:3000
# Agent Creator: http://localhost:5173

# Ver logs:
make docker-logs

# Detener:
make docker-down
```

### Con LLM real

```bash
echo "OPENAI_API_KEY=sk-..." > .env
npm run dev
```

---

## Deploy

Ver [`docs/deployment.md`](docs/deployment.md) para guia completa.

### VPS + Docker Compose (recomendado)

```bash
git clone https://github.com/VECTORG99/Huascar.git
cd Huascar
cp .env.example .env
# Editar .env con OPENAI_API_KEY, etc.
make docker-build
make docker-up
```

### Render (solo backend)

Conecta el repo desde el dashboard de Render. Usa `render.yaml` para configuracion automatica o manualmente:

| Campo | Valor |
|-------|-------|
| Runtime | `Docker` |
| Dockerfile | `Dockerfile.backend` |
| Plan | Free (512MB RAM) |

> **Nota:** Free tier sin disco persistente — datos SQLite se pierden al reiniciar.

---

## CI/CD

El workflow `ci.yml` corre en cada push y PR:

| Paso | Comando |
|------|---------|
| TypeScript check | `npx tsc --noEmit` |
| Unit tests | `npm run test:unit` |
| Integration tests | `node test/api_test.mjs` |

Render y Vercel deployan automaticamente al hacer push a `master` cuando
conectas el repo desde sus dashboards. No necesitas secrets de CI adicionales.

---

## API Reference

### `GET /api/health`
Verifica que el servidor este vivo.

### `POST /api/agent/execute`
Ejecuta una tarea con un rol de agente.

**Request:**
```json
{
  "task": "Revisa el codigo en busca de vulnerabilidades",
  "role": "PR_REVIEWER"
}
```

**Response (exito):**
```json
{
  "status": "success",
  "agent_role": "Senior Code Reviewer",
  "response": "Resultado del analisis..."
}
```

**Response (bloqueado por hook):**
```json
{
  "status": "blocked",
  "error": "HOOK TRIGGERED: Accion destructiva bloqueada..."
}
```

---

## ReAct Loop

El motor ejecuta un bucle de razonamiento iterativo (max 3 iteraciones):

1. **LLM recibe**: system prompt (rol) + herramientas MCP disponibles + tarea
2. **LLM decide**: usar herramienta (`USE_TOOL: <nombre>`) o responder (`FINAL: <respuesta>`)
3. **Si usa herramienta**: Hook de seguridad valida la accion, se ejecuta via MCP, el resultado vuelve al LLM
4. **Repite**: hasta que el LLM responde FINAL o se alcanza el maximo de iteraciones

Sin API key, el motor ejecuta un ReAct simulado para propositos de demo.

---

## Estructura del Proyecto

```
huascar/
├── src/
│   ├── kiro/               # Configuracion del agente
│   │   ├── steering.json   # Roles y personalidad
│   │   ├── hooks.ts        # Seguridad y HITL
│   │   ├── mcps.json       # Servidores MCP
│   │   └── rag.json        # Fuentes de conocimiento
│   ├── engine/
│   │   ├── HuascarEngine.ts  # Motor con ReAct + MCP
│   │   ├── RagEngine.ts      # RAG con embeddings vectoriales
│   │   ├── Store.ts          # SQLite: historial + vectores
│   │   └── init.ts           # DB init / healthcheck
│   ├── server.ts             # API Express
│   └── config.ts             # Config centralizada
├── agent-creator/          # Frontend: cuestionario (Vite + React)
├── frontend/               # Frontend: dashboard (Next.js 16)
├── docs/                   # Documentacion
│   ├── architecture.md
│   ├── deployment.md       # Guia de deploy
│   └── use_cases.md
├── Dockerfile.backend
├── Dockerfile.frontend     # Frontend multi-stage
├── Dockerfile.agent-creator
├── docker-compose.yml      # 3 servicios (backend + frontend + agent-creator)
├── Makefile                # Build/test/docker automation
├── render.yaml
└── README.md
```

---

## Demo Flow (Hackathon)

1. Abrir `http://localhost:5173` (Agent Creator)
2. Responder el cuestionario de 7 pasos:
   - Bienvenida → Rol → Tarea → Conocimiento → Herramientas → Seguridad → Revision
3. Presionar "Generar Configuracion"
4. El motor ejecuta el ReAct loop (con MCPs reales si hay API key, simulado si no)
5. Ver el JSON de configuracion generado y la respuesta del motor

---

## Roadmap

- [x] Motor base con ReAct loop
- [x] Integracion Vercel AI SDK
- [x] Hooks de seguridad (human-in-the-loop)
- [x] Ejecucion de servidores MCP
- [x] Generacion de configuracion via cuestionario
- [x] Dockerizacion multi-stage (3 servicios)
- [x] RAG vectorial (embeddings + busqueda semantica con SQLite)
- [ ] Evaluacion de agentes (metricas y tests)
- [ ] Historial de ejecuciones
- [ ] Autenticacion y multi-usuario

---

## Licencia

MIT
