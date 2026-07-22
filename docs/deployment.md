# Deployment Guide

## 1. Prerequisites

- **Docker** + Docker Compose (v2)
- **Node.js** 20.x (for local dev)
- **make** (convenience, optional)
- **npx tsx** (for DB init script)

---

## 2. Quick Start with Docker

```bash
# 1. Create .env from template (then edit with your keys)
cp .env.example .env

# 2. Build all images
make docker-build

# 3. Start services in detached mode
make docker-up

# Check logs
make docker-logs

# Stop and clean up
make docker-down
```

Or without `make`:

```bash
docker compose build
docker compose up -d
```

This starts three services (see Service Ports below). The frontend waits for the backend health check before starting.

---

## 3. Environment Variables

All environment variables are defined in `.env.example`. Variables are grouped by category below.

### Server

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3001` | Backend HTTP listen port |
| `HOST` | No | `0.0.0.0` | Backend bind address |

### LLM Provider

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | **Yes** | — | OpenAI API key for LLM calls |
| `MODEL_ID` | No | `gpt-4o` | Model identifier to use |
| `LLM_MOCK_MODE` | No | `false` | Skip real LLM calls (for testing) |

### ReAct Loop

| Variable | Required | Default | Description |
|---|---|---|---|
| `REACT_MAX_ITERATIONS` | No | `3` | Max ReAct loop iterations per request |
| `TOOL_RESULT_MAX_CHARS` | No | `8192` | Max chars truncated per tool result |
| `MCP_TIMEOUT_MS` | No | `30000` | MCP tool timeout in milliseconds |

### RAG

| Variable | Required | Default | Description |
|---|---|---|---|
| `RAG_MAX_CONTENT_CHARS` | No | `16000` | Max chars ingested per RAG document |
| `FILE_ENCODING` | No | `utf8` | File encoding for RAG ingestion |

### Vector Embeddings

| Variable | Required | Default | Description |
|---|---|---|---|
| `EMBEDDING_MODEL` | No | `text-embedding-3-small` | OpenAI embedding model |
| `EMBEDDING_CHUNK_SIZE` | No | `500` | Chunk size for document splitting |
| `EMBEDDING_TOP_K` | No | `5` | Top-K results for similarity search |

### Persistence

| Variable | Required | Default | Description |
|---|---|---|---|
| `HUASCAR_DB_PATH` | No | `./data/huascar.db` | SQLite database file path |
| `HISTORY_LIMIT_DEFAULT` | No | `20` | Default conversation history limit |

### MCP / Security

| Variable | Required | Default | Description |
|---|---|---|---|
| `MCP_STDERR` | No | `ignore` | MCP stderr handling strategy |
| `SECURITY_POLICY_PATH` | No | `./src/kiro/security-policy.json` | Path to security policy file |
| `BYPASS_SECRET` | No | — | Emergency security bypass (auto-generated on Render) |

### Config Paths

| Variable | Required | Default | Description |
|---|---|---|---|
| `STEERING_CONFIG_PATH` | No | `./src/kiro/steering.json` | Steering configuration path |
| `MCPS_CONFIG_PATH` | No | `./src/kiro/mcps.json` | MCP server configuration path |
| `RAG_CONFIG_PATH` | No | `./src/kiro/rag.json` | RAG configuration path |

### GitHub Integration

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | No | — | GitHub token for MCP GitHub integration |

### Frontend (Next.js)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | **Yes** | _see below_ | Backend API URL (build-time arg) |

Defaults per environment:
- **Docker Compose**: `http://backend:3001` (set in `docker-compose.yml` build args)
- **Local dev**: `http://localhost:3001`
- **Render / production**: your backend deployment URL

> `NEXT_PUBLIC_API_URL` is consumed at **build time** by Next.js and baked into the JS bundle. Changing it requires a rebuild.

### Agent Creator (Vite)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `http://localhost:3001` | Backend API URL for the Vite dev tool |
| `VITE_DASHBOARD_URL` | No | `http://localhost:3000` | Dashboard URL link |

---

## 4. Service Ports

| Service | Container Port | Host Port | Notes |
|---|---|---|---|
| **Backend** (Express) | `3001` | `3001` | JSON API |
| **Frontend** (Next.js) | `3000` | `3000` | Dashboard UI |
| **Agent Creator** (Vite) | `5173` | `5173` | Dev tool (optional in production) |

All services share the `huascar-network` bridge network.

---

## 5. Building Individual Services

```bash
# Backend
docker build -f Dockerfile.backend -t huascar-backend .

# Frontend (must pass build-arg)
docker build -f Dockerfile.frontend \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 \
  -t huascar-frontend \
  ./frontend

# Agent Creator (optional)
docker build -f Dockerfile.agent-creator -t huascar-agent-creator .
```

---

## 6. Render.com Deployment

The `render.yaml` at the project root deploys the **backend only** as a Docker web service.

```yaml
# render.yaml — key settings
services:
  - type: web
    name: huascar-backend
    runtime: docker
    dockerfilePath: ./Dockerfile.backend
```

### Steps

1. Connect your GitHub repo to Render.
2. Render auto-detects `render.yaml` → create a **Blueprint**.
3. Set required env vars in the Render dashboard:
   - `OPENAI_API_KEY` — your OpenAI key
   - `LLM_MOCK_MODE` — set to `"true"` for testing without API costs
4. `BYPASS_SECRET` is auto-generated by Render.
5. Deploy.

> Render uses an **ephemeral filesystem**. The SQLite database at `/data/huascar.db` will be lost on each restart. For persistence, attach a Render Disk (paid plans only, Starter $7/mo+) or migrate to an external database.

---

## 7. Local Development

```bash
# Install all dependencies (root + frontend + agent-creator)
make install

# Or manually:
npm ci
cd frontend && npm ci
cd ../agent-creator && npm ci
cd ..

# Start development servers (each in its own terminal):
npm run dev              # Backend (tsx watch, port 3001)
cd frontend && npm run dev  # Frontend (Next.js, port 3000)
cd agent-creator && npm run dev  # Agent Creator (Vite, port 5173)
```

---

## 8. Database Initialization

The database is initialized automatically on first use (schema is created via `CREATE TABLE IF NOT EXISTS` in `Store.ts`). To verify or force initialization:

```bash
cp .env.example .env   # configure .env first
npx tsx src/engine/init.ts
```

This runs a health check against the store: creates tables if missing, verifies the `rag_documents` and history tables are accessible. Exits with code 0 on success.

---

## 9. Production Considerations

### Volume Mounts (Docker Compose)

SQLite data is persisted via the `huascar-data` named volume, mounted at `/app/data` in the backend container:

```yaml
volumes:
  - huascar-data:/app/data
```

To back up: `docker run --rm -v huascar-data:/data alpine tar -czf /tmp/backup.tar.gz /data`

### Secrets Management

- **`OPENAI_API_KEY`** and **`BYPASS_SECRET`** should never be committed. Use `.env` (gitignored) for local dev, or Render's secret env vars for production.
- The backend redacts `BYPASS_SECRET` from logs automatically.

### SQLite in Production

SQLite works well for single-server deployments but has limitations:
- **Not suitable for multi-replica setups** — consider PostgreSQL if you need horizontal scaling.
- **Backup regularly** — use `sqlite3 /app/data/huascar.db ".backup /tmp/backup.db"` or the Docker volume backup command above.
- **Render ephemeral storage** — on Render, attach a **Render Disk** and set `HUASCAR_DB_PATH` to the disk mount path, or use an external database.

### Health Checks

All three Docker images include `HEALTHCHECK` instructions:
- **Backend**: `GET /api/health` → expects 200
- **Frontend**: `GET /` → expects 200
- **Agent Creator**: `GET /` → expects 200

### Resource Limits (Docker)

No resource constraints are set in `docker-compose.yml`. For production, consider adding:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
```

### Post-Deploy Verification

After `make docker-up`, verify all services are running:

```bash
curl -s http://localhost:3001/api/health   # Backend → {"status":"Huascar Backend Online"}
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000  # Frontend → 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173  # Agent Creator → 200
```

### TLS / Reverse Proxy

For public deployments, services expose raw HTTP. Add a reverse proxy (Caddy, Nginx, Traefik) in front for TLS termination. Caddy is the simplest — single binary, auto-HTTPS via Let's Encrypt:

```bash
# Example: Caddy reverse-proxy in front of the frontend service
caddy reverse-proxy --from your-domain.com --to localhost:3000
```
