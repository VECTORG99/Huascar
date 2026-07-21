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
|---|---|
| Backend | Node.js, Express, TypeScript |
| Frontend (Dashboard) | Next.js, TailwindCSS |
| Frontend (Agent Creator) | Vite, React, JavaScript, TailwindCSS v4 |
| LLM | Vercel AI SDK (OpenAI, Anthropic) |
| MCP | @modelcontextprotocol/sdk |
| Containerizacion | Docker, docker-compose |

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
Fuentes de conocimiento del agente (vectorizacion planeada).

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
docker compose up --build
# Backend:  http://localhost:3001
# Frontend: http://localhost:5173
```

### Con LLM real

```bash
echo "OPENAI_API_KEY=sk-..." > .env
npm run dev
```

---

## Deploy (Stack Gratuito)

**Problema:** Huascar usa SQLite, que necesita almacenamiento persistente. En tiers gratis
la mayoria de plataformas no ofrecen discos persistentes.

### Opcion A: Fly.io (recomendada)

Fly.io da **3 VMs gratis** con **3GB de volumen persistente** cada una.
Los archivos `fly.backend.toml` y `fly.frontend.toml` ya estan listos en el repo.

```bash
# 1. Backend
fly launch --name huascar-backend \
  --config fly.backend.toml \
  --region iad \
  --no-deploy

fly volumes create huascar_data --app huascar-backend --size 1 --region iad
fly secrets set --app huascar-backend OPENAI_API_KEY=sk-...
fly deploy --app huascar-backend --config fly.backend.toml

# 2. Agent Creator
fly launch --name huascar-agent-creator \
  --config fly.frontend.toml \
  --region iad \
  --no-deploy

fly deploy --app huascar-agent-creator --config fly.frontend.toml
```

### Opcion B: Render + Vercel

- **Backend** en Render (Web Service, tier gratis, pero **duerme tras inactividad**)
- **Frontend** en Vercel (static build, siempre activo)

```bash
# Backend en Render
# 1. Crea Web Service desde el repo
#    Runtime: Docker
#    Dockerfile: Dockerfile.backend
# 2. Agrega variables: OPENAI_API_KEY
# 3. Render puede tardar ~2min en responder (free tier se apaga solo)

# Frontend en Vercel
cd agent-creator
# Reemplaza VITE_API_URL por la URL de Render
VITE_API_URL=https://huascar-backend.onrender.com npm run build
# Sube el dist/ a Vercel
npx vercel --prod
```

**Nota:** Render free tier **no tiene disco persistente**. Los datos se pierden al
reiniciar. Usa esta opcion solo para pruebas/demos, no para produccion.

### Opcion C: VPS Gratuito + Docker Compose

Oracle Cloud Always Free, Google Cloud Free Tier (e2-micro), o Azure Free Tier:

```bash
# En la VM
git clone https://github.com/VECTORG99/Huascar.git
cd Huascar
echo "OPENAI_API_KEY=sk-..." > .env
docker compose up -d --build
```

El VPS free tipicamente da 1-2GB RAM + disco persistente. Docker Compose
funciona completo: backend + frontend + DB volume.

---

## CI/CD

El workflow `ci.yml` corre en cada push y PR:

| Paso | Comando |
|------|---------|
| TypeScript check | `npx tsc --noEmit` |
| Unit tests | `npm run test:unit` |
| Integration tests | `node test/api_test.mjs` |
| Deploy a Fly.io | Solo en push a `master` |

Para activar deploy automatico necesitas configurar un **secret** en GitHub:

1. Ve a Settings → Secrets and variables → Actions
2. Agrega `FLY_API_TOKEN` con un token de Fly.io:
   ```bash
   fly tokens create deploy --org personal
   ```
3. El workflow deploya ambos servicios automaticamente al hacer push a `master`

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
│   │   └── HuascarEngine.ts  # Motor con ReAct + MCP
│   ├── server.ts           # API Express
│   └── ki/                 # (reservado)
├── agent-creator/          # Frontend: cuestionario (Vite + React)
├── frontend/               # Frontend: dashboard (Next.js)
├── docs/                   # Documentacion extensa
│   ├── architecture.md
│   ├── use_cases.md
│   └── implementation_plan.md
├── Dockerfile.backend
├── Dockerfile.agent-creator
├── docker-compose.yml
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
- [x] Dockerizacion
- [ ] RAG vectorial (embeddings + busqueda semantica)
- [ ] Evaluacion de agentes (metricas y tests)
- [ ] Historial de ejecuciones
- [ ] Autenticacion y multi-usuario

---

## Licencia

MIT
