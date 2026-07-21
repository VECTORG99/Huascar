# Arquitectura de Huascar

Huascar es un motor de agentes de IA configurable que abstrae la complejidad de ReAct, MCP, RAG y seguridad en primitivas declarativas.

---

## Tabla de Contenido

1. [Vision General](#vision-general)
2. [Modulos del Sistema](#modulos-del-sistema)
3. [Sistema de Configuracion](#sistema-de-configuracion)
4. [Modelo de Seguridad](#modelo-de-seguridad)
5. [Bucle ReAct](#bucle-react)
6. [Integracion MCP](#integracion-mcp)
7. [RAG (Retrieval-Augmented Generation)](#rag)
8. [Persistencia](#persistencia)
9. [Referencia de Variables de Entorno](#referencia-de-variables-de-entorno)
10. [Patrones de Error](#patrones-de-error)
11. [Estructura del Proyecto](#estructura-del-proyecto)

---

## Vision General

```
┌─────────────────────────────────────────────────────────┐
│                      server.ts                           │
│  Express + Store (singleton) + shutdown lifecycle        │
└──────────┬──────────────────────────────────────────┬────┘
           │ POST /api/agent/execute                  │ GET /api/history
┌──────────▼──────────────────────────────────────────┴────┐
│                   HuascarEngine                          │
│                                                          │
│  ┌─────────────┐  ┌────────┐  ┌──────────────────┐      │
│  │ config.ts   │  │ Store  │  │ RagEngine         │      │
│  │ (env vars)  │  │ (SQL)  │  │ (lectura archivos)│      │
│  └─────────────┘  └────────┘  └──────────────────┘      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  ReAct Loop (max 3 iteraciones)                   │    │
│  │  LLM (Vercel AI SDK) → USE_TOOL / FINAL parsing   │    │
│  │  ↓                                                 │    │
│  │  Hook de seguridad (structured (toolName, args))   │    │
│  │  ↓                                                 │    │
│  │  MCP Client → StdioClientTransport → Herramienta   │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Modulos del Sistema

### `server.ts`
Punto de entrada Express. Crea instancia unica de Store, configura rutas, maneja lifecycle (SIGTERM/SIGINT).

- `GET /api/health` → healthcheck
- `POST /api/agent/execute` → ejecuta tarea con rol
- `GET /api/history` → historial de ejecuciones

### `HuascarEngine.ts`
Motor principal. Orquesta el pipeline completo:
1. Carga steering (rol)
2. Conecta servidores MCP
3. Carga fuentes RAG
4. Ejecuta ReAct loop (real o mock)
5. Persiste resultado en Store
6. Desconecta MCP

### `config.ts`
Modulo centralizado de configuracion. Lee `process.env` con defaults tipados. No tiene dependencias externas ni riesgo de circular imports.

### `RagEngine.ts`
Recolector de contexto. Lee archivos locales/directorios/texto inline y produce un string para inyectar en el system prompt.

### `Store.ts`
Persistencia SQLite. WAL mode, indice en `created_at`. Singleton inyectado en `server.ts` y `HuascarEngine`.

### `hooks.ts`
Seguridad. Carga `security-policy.json` y valida cada tool call antes de ejecutarla.

---

## Sistema de Configuracion

### Diseno

`src/config.ts` es el unico punto de entrada para toda configuracion del sistema. Sigue estas reglas:

1. Lee de `process.env` en el momento de importacion
2. Provee defaults seguros para todo
3. Incluye `import 'dotenv/config'` (autocontenido, portable entre entry points)
4. Agrupado por dominio: `paths`, `server`, `react`, `llm`, `rag`, `store`, `mcp`
5. Usa helper `envInt()` con clamping `>= 0` para valores numericos

### Uso

```ts
import { config } from './config.js';

// File paths
config.paths.steering   // → './src/kiro/steering.json'
config.paths.mcps       // → './src/kiro/mcps.json'
config.paths.rag        // → './src/kiro/rag.json'
config.paths.db         // → './data/huascar.db'

// Server
config.server.port      // → 3001
config.server.host      // → '0.0.0.0'

// ReAct loop
config.react.maxIterations      // → 3
config.react.toolResultMaxChars // → 8192
config.react.mcpTimeoutMs       // → 30000

// RAG
config.rag.maxContentChars  // → 16000
config.rag.encoding         // → 'utf8'

// Store
config.store.historyLimit   // → 20

// LLM
config.llm.modelId  // → 'gpt-4o'
config.llm.mockMode // → false

// MCP
config.mcp.stderr   // → 'ignore'

// Estado
config.hasApiKey    // → !!process.env.OPENAI_API_KEY
```

### Como agregar una nueva variable

1. Agregar el default en `src/config.ts` dentro de la seccion correspondiente
2. Agregar la entrada en `.env.example`
3. Consumir via `config.*` en el codigo (nunca leer `process.env` directamente)

---

## Modelo de Seguridad

### Arquitectura

La seguridad se implementa en dos capas:

1. **Politica declarativa** (`src/kiro/security-policy.json`)
   - `blocked_tool_patterns`: patrones de nombre de herramienta bloqueados (substring match)
   - `blocked_args_substrings`: por herramienta, substrings en argumentos serializados que activan bloqueo

2. **Hook de ejecucion** (`src/kiro/hooks.ts`)
   - `agentHooks.before_action(toolName, args)`: validacion pre-ejecucion, recibe datos estructurados
   - `agentHooks.on_commit(diffContext)`: HITL para commits (stub, pending)

### Flujo de validacion

```
LLM produce USE_TOOL: execute_bash + args
  → HuascarEngine extrae toolName y args
  → agentHooks.before_action(toolName, args)
    → ¿toolName contiene "shell" o "sudo"? → BLOQUEAR
    → ¿execute_bash tiene args con "rm -rf" u otros? → BLOQUEAR
    → AUTORIZAR
  → MCP client.callTool(args)
```

### Principios

- **Fail-closed**: Si `security-policy.json` no se puede cargar, se bloquean todas las herramientas (patron `['.']`)
- **Datos estructurados**: El hook recibe `(toolName, args)` no un string plano
- **Parseo robusto**: Los argumentos JSON se extraen con un parser de profundidad de braces, no regex

---

## Bucle ReAct

### Flujo

```
1. System prompt = rol.system_prompt + RAG context + MCP tools list
2. User message = task
3. LLM responde → parsear:
   a. "FINAL: <respuesta>" → retornar respuesta
   b. "USE_TOOL: <nombre> + Argumentos: {...}" → continuar
   c. Ni FINAL ni USE_TOOL → retornar texto crudo
4. Si USE_TOOL:
   - Ejecutar hook de seguridad
   - Llamar MCP client.callTool()
   - Push resultado como user message
   - Loop (max N iteraciones)
5. Si max iteraciones alcanzado: LLM genera respuesta final forzada
```

### Configuracion

- `REACT_MAX_ITERATIONS` (default 3): profundidad maxima del bucle
- `TOOL_RESULT_MAX_CHARS` (default 8192): truncado de resultados de herramientas
- `MCP_TIMEOUT_MS` (default 30000): timeout por llamada a herramienta

### Mock mode

Sin `OPENAI_API_KEY` y con `LLM_MOCK_MODE=false`, el motor ejecuta un ReAct simulado que retorna pasos predefinidos. Esto permite desarrollo y tests sin conexion a LLM.

---

## Integracion MCP

### `src/kiro/mcps.json`

```json
{
  "mcpServers": {
    "nombre-servidor": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

### Ciclo de vida

1. `connectMcpServers()`: spawn subprocesos via `StdioClientTransport`, lista tools
2. Durante ReAct: `client.callTool({ name, arguments })` con AbortController timeout
3. `disconnectMcpServers()` en `finally` del bloque try/catch de `executeTask()`

### Variables de entorno

Las entradas `env` en `mcps.json` soportan sustitucion `${VAR_NAME}` via `resolveEnv()`.

---

## RAG

### `src/kiro/rag.json`

```json
{
  "knowledge_bases": [
    { "type": "local_file", "path": "./docs/CONVENTIONS.md" }
  ]
}
```

### Fuentes soportadas

- `local_file`: lee un archivo
- `local_directory`: lee archivos en directorio (filtro por extension)
- `inline`: texto directo en config

### Limites

- `RAG_MAX_CONTENT_CHARS` (default 16000): maximo de caracteres combinados

El contexto RAG se inyecta en el system prompt del LLM, antes de la seccion de herramientas MCP.

---

## Persistencia

### Store

- Base de datos SQLite con WAL mode
- Una sola tabla: `executions (id, role, task, response, created_at)`
- Indice en `created_at DESC`
- Path configurable via `HUASCAR_DB_PATH` o default `./data/huascar.db`

### Ciclo de vida

- Store es singleton, creado en `server.ts` e inyectado en `HuascarEngine`
- `store.close()` en SIGTERM y SIGINT
- Los fallos de escritura no afectan la respuesta al usuario (try/catch + warn)

---

## Referencia de Variables de Entorno

| Variable | Default | Descripcion |
|---|---|---|
| `PORT` | `3001` | Puerto del servidor HTTP |
| `HOST` | `0.0.0.0` | Interfaz de red |
| `OPENAI_API_KEY` | — | API key de OpenAI (requerida para modo real) |
| `MODEL_ID` | `gpt-4o` | Modelo LLM por defecto |
| `LLM_MOCK_MODE` | `false` | Forzar modo simulado incluso con API key |
| `REACT_MAX_ITERATIONS` | `3` | Maximo de iteraciones del bucle ReAct |
| `TOOL_RESULT_MAX_CHARS` | `8192` | Truncado de resultados de herramientas |
| `MCP_TIMEOUT_MS` | `30000` | Timeout por llamada MCP (ms) |
| `RAG_MAX_CONTENT_CHARS` | `16000` | Maximo de caracteres del contexto RAG |
| `FILE_ENCODING` | `utf8` | Encoding para lectura de archivos |
| `HUASCAR_DB_PATH` | `./data/huascar.db` | Ruta a la base de datos SQLite |
| `HISTORY_LIMIT_DEFAULT` | `20` | Limite por defecto en GET /api/history |
| `MCP_STDERR` | `ignore` | Manejo de stderr de MCP (ignore/piped/inherit) |
| `STEERING_CONFIG_PATH` | `./src/kiro/steering.json` | Ruta al archivo de roles |
| `MCPS_CONFIG_PATH` | `./src/kiro/mcps.json` | Ruta a config de servidores MCP |
| `RAG_CONFIG_PATH` | `./src/kiro/rag.json` | Ruta a config de fuentes RAG |
| `SECURITY_POLICY_PATH` | `./src/kiro/security-policy.json` | Ruta a politica de seguridad |
| `GITHUB_TOKEN` | — | Token para servidor MCP de GitHub |

---

## Patrones de Error

### Manejo de errores

| Escenario | Respuesta HTTP | Log |
|---|---|---|
| Faltan parametros | `400 { error: "..." }` | — |
| Rol inexistente | `500 { error: "..." }` | throw con detalle |
| Tool falla (MCP timeout) | — | warn, toolResult = "Error..." |
| Hook bloquea accion | `500 { error: "HOOK TRIGGERED: ..." }` | console.error |
| Fallo de store.saveExecution | — | console.warn (no afecta respuesta) |
| RAG source no encontrada | — | warn, skip source |
| Policy file corrupto | — | console.error, fail-closed |

### Principios

- `catch (err: unknown)` en lugar de `catch (err: any)`
- `instanceof Error` para extraer `.message`
- `String(err)` como fallback para throws primitivos
- Errores en store/persistencia jamas rompen la respuesta al usuario

---

## Estructura del Proyecto

```
huascar/
├── src/
│   ├── config.ts                    # Config central (env vars + defaults)
│   ├── server.ts                    # Express entry point + lifecycle
│   ├── engine/
│   │   ├── HuascarEngine.ts         # Motor ReAct + MCP + RAG
│   │   ├── RagEngine.ts             # Recolector de contexto RAG
│   │   └── Store.ts                 # Persistencia SQLite
│   └── kiro/
│       ├── steering.json            # Roles y system prompts
│       ├── mcps.json                # Servidores MCP
│       ├── rag.json                 # Fuentes RAG
│       ├── security-policy.json     # Politica de seguridad
│       └── hooks.ts                 # Implementacion de hooks (seguridad + HITL)
├── agent-creator/                   # Frontend de creacion de agentes (Vite + React)
├── docs/
│   ├── architecture.md              # Este documento
│   ├── CONVENTIONS.md               # Convenciones de equipo (ejemplo RAG)
│   ├── use_cases.md                 # Casos de uso
│   └── implementation_plan.md       # Plan de implementacion
├── test/
│   └── api_test.mjs                 # Tests de integracion (6 tests)
├── .env.example                     # Documentacion de variables de entorno
├── Dockerfile.backend               # Build multi-stage Node 20
├── Dockerfile.agent-creator         # Build multi-stage Vite
└── docker-compose.yml               # Orquestacion de servicios
```

---

## Principios Arquitectonicos

1. **Config centralizada**: Nunca leer `process.env` directamente en modulos de negocio. Usar `config.ts`.
2. **Fail-closed en seguridad**: Si la politica no puede cargarse, bloquear todo.
3. **Datos estructurados en hooks**: Los hooks reciben objetos tipados, no strings planos.
4. **Parseo robusto**: Los argumentos JSON se extraen con brace-depth parser, no regex.
5. **Persistencia como side-effect**: Fallos de store no afectan la respuesta al usuario.
6. **Sin dependencias circulares**: Los modulos importan config, no al reves.
7. **MCP lifecycle en finally**: Los servidores MCP siempre se desconectan, incluso en error.

