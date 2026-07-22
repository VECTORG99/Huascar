# Huascar

**Plataforma open-source para diseñar agentes de desarrollo y operación mediante un árbol de decisiones, generar su configuración y explicar por qué fue construida de esa manera.**

Huascar separa dos responsabilidades:

1. **Creator:** acompaña al usuario desde el problema hasta un bundle de configuración reproducible.
2. **Runtime:** ejecuta tareas con el motor ReAct, RAG, hooks y servidores MCP existentes.

El Creator no usa un LLM para decidir la arquitectura, no ejecuta comandos y no modifica el proyecto del usuario. Sus preguntas, recomendaciones y artefactos son deterministas y auditables.

---

## Estado actual

### Implementado en el backend

- Catálogo tecnológico versionado con lenguajes, frameworks, bases de datos, arquitecturas, cloud, CI/CD, IaC, contenedores, observabilidad, seguridad, repositorios, conocimiento y plataformas de agentes.
- Árbol de decisiones **stateless** de 26 preguntas con ramas diferentes para desarrollo y producción.
- Recomendaciones explicables con evidencia, beneficios, trade-offs y alternativas.
- Preview de un bundle con blueprint, manifest, hashes SHA-256, instalación y justificación.
- Generación condicional de Huascar, RAG, PR review, `AGENTS.md`, hooks, skills y configuración Kiro.
- Tutorial ficticio y skippable disponible como contenido de API.
- Pruebas unitarias e integración para ramas, validación, determinismo y compatibilidad legacy.

### Pendiente en las interfaces

- El frontend `agent-creator/` todavía utiliza el cuestionario lineal anterior. Debe migrarse para renderizar el workflow entregado por `/api/v1/creator/workflow`.
- El tutorial existe en backend, pero su experiencia visual tipo juego aún no está implementada.
- **Login, cuentas y multiusuario están documentados como roadmap; no están implementados.**
- El Creator entrega un bundle JSON de preview. La descarga ZIP, escritura automática en repositorios y despliegue se dejan para una fase posterior.

---

## Recorrido del usuario

```text
[Login futuro]
      ↓
[Tutorial ficticio opcional]
      ↓ saltar o completar
[Árbol de decisiones]
      ├─ problema y criterio de éxito
      ├─ stack y arquitectura
      ├─ desarrollo / producción / ambos
      ├─ DevOps, cloud y observabilidad
      ├─ permisos, conocimiento y PR review
      └─ Huascar / Kiro / Portable
      ↓
[Recomendaciones explicables]
      ↓
[Preview del bundle]
      ├─ configuraciones
      ├─ manifest + hashes
      ├─ INSTALL.md
      └─ WHY.md
      ↓
[Aplicación manual y validada en el proyecto]
```

La experiencia se inspira en un workflow como n8n: cada respuesta abre o cierra nodos. No es un formulario fijo. El cliente conserva las respuestas y las reenvía; el backend recalcula el camino completo, progreso y siguiente pregunta.

### 1. Login futuro

La entrada con cuenta permitirá guardar agentes, versionarlos y compartirlos. No existe actualmente ninguna ruta de autenticación ni almacenamiento de sesiones del Creator. Esta decisión evita presentar como segura una sesión anónima que todavía no tiene identidad, ownership o autorización.

### 2. Tutorial opcional

`GET /api/v1/creator/tutorial` entrega una historia ficticia: rescatar una API en producción. Enseña cuatro ideas antes de crear un agente real:

1. definir un resultado verificable;
2. separar reglas, documentación y datos vivos;
3. conceder permisos mínimos;
4. elegir artefactos Huascar, Kiro o portables.

El tutorial se puede omitir sin crear estado en el backend.

### 3. Creator guiado

El árbol pregunta por:

- nombre, propósito, objetivo y criterio de éxito;
- proyecto nuevo, existente o migración;
- lenguajes, frameworks, persistencia y tecnologías personalizadas;
- monolito, monolito modular, microservicios, serverless, event-driven, hexagonal, CQRS o pipelines de datos;
- repositorio y CI/CD;
- entorno de desarrollo, producción o ambos;
- EC2, ECS, EKS, Lambda, Azure, GCP, Vercel, Render, Fly.io o VPS;
- Docker, Compose, Kubernetes, Helm y automatización de infraestructura;
- observabilidad, secretos, supply chain y mínimo privilegio;
- capacidades y autonomía del agente;
- RAG y fuentes de conocimiento;
- PR review y criterios de revisión;
- destinos Huascar, Kiro y portable;
- hooks y skills.

Todas las selecciones de stack aceptan `custom:<slug>`. Una opción custom se conserva en el blueprint y en `WHY.md`, pero se marca sin adaptador automático para no inventar integración.

### 4. Recomendaciones

Las recomendaciones son reglas deterministas. Algunos ejemplos:

- producción exige políticas distintas de desarrollo, mínimo privilegio y rollback;
- EC2 necesita proceso reproducible, parches, identidad, secretos y observabilidad;
- microservicios requieren límites, contratos y trazabilidad distribuida;
- SQLite en producción concurrente produce una advertencia;
- PR review mantiene el merge bajo control humano;
- Kiro separa steering, hooks y skills;
- deploy u operación generan una advertencia de privilegios.

Cada recomendación incluye motivo, evidencia usada, beneficios, trade-offs y alternativas. El backend no presenta una decisión probabilística como si fuera conocimiento del modelo.

### 5. Bundle listo para aplicar

Siempre se generan:

| Archivo | Función |
|---|---|
| `huascar.blueprint.json` | Modelo canónico de todas las decisiones. |
| `manifest.json` | Inventario de archivos y hashes SHA-256. |
| `docs/INSTALL.md` | Tutorial para aplicar y validar el agente. |
| `docs/WHY.md` | Explicación del objetivo, stack, entorno y recomendaciones. |

Según las respuestas se agregan:

| Condición | Artefactos |
|---|---|
| Desarrollo, Kiro o portable | `AGENTS.md` |
| Skills activadas | `skills/<agente>/SKILL.md` |
| Target Huascar | `huascar/steering.json`, `security-policy.json`, `governance.json`, `mcps.json` |
| Target Huascar + RAG activado | `huascar/rag.json` |
| Target Huascar + PR review activado | `huascar/pr-review.json` |
| Target Kiro | `.kiro/steering/<agente>.md` |
| Kiro + hooks | `.kiro/hooks/<agente>-quality.json` |
| Kiro + skills | `.kiro/skills/<agente>/SKILL.md` |

El bundle se devuelve como JSON. Huascar no escribe estos archivos automáticamente: el usuario debe revisarlos y copiarlos al proyecto destino.

---

## Desarrollo frente a producción

El entorno cambia el árbol, recomendaciones y tutorial de instalación.

### Agente de desarrollo

Prioriza:

- lectura acotada al repositorio;
- parches pequeños y revisables;
- comandos allowlisted de lint, test y build;
- `AGENTS.md`, steering y skills del equipo;
- Docker Compose o Dev Containers reproducibles;
- revisión antes de commit o merge.

### Agente de producción

Prioriza:

- identidad de workload separada;
- secretos en un gestor externo;
- mínimo privilegio y modo de sólo lectura por defecto;
- staging, aprobación humana, backup y rollback;
- logs, métricas, trazas, alertas y límites de costo;
- timeout, rate limiting y auditoría de herramientas.

Para EC2, Huascar recomienda documentar además el proceso de servicio, parcheo, acceso mediante SSM/IAM, CloudWatch, persistencia y recuperación. El preview **no despliega** en EC2 ni en otro proveedor.

---

## Arquitectura

```text
┌────────────────────────────────────────────────────────────┐
│ Frontend futuro del Creator                                │
│ Renderiza workflow + conserva answers localmente           │
└─────────────────────────────┬──────────────────────────────┘
                              │ JSON
┌─────────────────────────────▼──────────────────────────────┐
│ Creator API v1 (stateless)                                 │
│                                                            │
│  Catálogo → Árbol → Recomendaciones → Blueprint            │
│                                ↓                           │
│                    Generadores puros                       │
│                                ↓                           │
│       Bundle JSON + manifest + INSTALL + WHY               │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Runtime legacy separado                                    │
│ /api/agent/execute → HuascarEngine → RAG/MCP/Hooks/LLM     │
└────────────────────────────────────────────────────────────┘
```

### Por qué el Creator es stateless

- Permite volver atrás cambiando respuestas y recalcular el camino.
- Evita sesiones anónimas y estado huérfano antes de implementar login.
- Facilita reproducibilidad, pruebas y versionado.
- El mismo input produce el mismo blueprint, contenido y hash.
- Escala horizontalmente sin coordinar sesiones.

### Por qué generación y ejecución están separadas

Generar configuración no debe iniciar procesos, llamar un LLM, cargar archivos, consultar URLs ni usar credenciales. El preview es una compilación pura. La ejecución permanece en `/api/agent/execute` y requiere controles de autenticación, sandbox y autorización antes de exponerse como servicio real.

---

## API del Creator

Base URL:

```text
/api/v1/creator
```

### `GET /catalog`

Devuelve versión, categorías y tecnologías.

Filtros opcionales:

```text
?category=cloud
?environment=production
?q=kubernetes
```

### `GET /workflow`

Devuelve el contrato de preguntas y condiciones. El cliente no debe codificar el orden por su cuenta.

### `GET /tutorial`

Devuelve el tutorial ficticio con `skippable: true`.

### `POST /evaluate`

Recalcula el árbol desde las respuestas acumuladas.

```json
{
  "workflowVersion": "1.0.0",
  "catalogVersion": "1.0.0",
  "answers": {
    "agent_name": "Platform Reviewer",
    "purpose": "pr-review",
    "objective": "Revisar cambios y explicar riesgos sin hacer merge.",
    "success_criteria": "Cada PR recibe hallazgos priorizados con evidencia."
  }
}
```

Respuesta resumida:

```json
{
  "workflowVersion": "1.0.0",
  "nextQuestion": {
    "id": "project_stage",
    "section": "Proyecto",
    "prompt": "¿En qué estado está el proyecto?"
  },
  "progress": {
    "answered": 4,
    "total": 18,
    "percent": 22,
    "complete": false
  },
  "recommendations": [],
  "warnings": [],
  "issues": []
}
```

El total cambia porque sólo cuenta preguntas visibles para la rama actual.

### `POST /preview`

Exige un árbol completo y devuelve blueprint, artefactos, manifest, guía y warnings.

### `POST /generate`

Alias semántico de `/preview`. También genera únicamente el bundle en memoria; no escribe archivos ni ejecuta el agente.

### Versionado y errores

El cliente puede fijar `workflowVersion` y `catalogVersion`:

- `200`: evaluación o generación correcta;
- `400`: body o respuestas con tipo inválido;
- `409`: versión de workflow/catálogo obsoleta;
- `422`: árbol incompleto, secreto literal o bundle inseguro;
- `500`: error interno.

Los errores de Creator usan `application/problem+json` e incluyen `issues[]` con rutas de campo.

---

## Seguridad y determinismo del Creator

El Creator:

- valida tipos, opciones, duplicados y máximos por pregunta;
- ignora respuestas de otra versión con warning;
- limita JSON HTTP a 128 KB;
- rechaza rutas absolutas, `..`, backslashes y archivos duplicados;
- limita el preview a 40 archivos y 256 KB generados;
- rechaza tokens y claves privadas con patrones conocidos;
- usa referencias como `${GITHUB_TOKEN}` en vez de secretos literales;
- serializa objetos con claves ordenadas;
- calcula SHA-256 para cada artefacto;
- no usa filesystem, red, SQLite, LLM, MCP ni shell.

Las configuraciones MCP generadas son sugerencias. Antes de producción deben fijarse versiones exactas, aplicarse allowlists y ejecutarse en sandbox.

---

## Runtime existente

El runtime mantiene las rutas anteriores:

| Ruta | Función |
|---|---|
| `GET /api/health` | Salud del backend. |
| `GET /api/history` | Historial SQLite. |
| `POST /api/agent/execute` | Ejecuta una tarea con HuascarEngine. |
| `/api/hooks/commit-approval/*` | Prototipo de aprobación. |

`HuascarEngine` carga steering, fuentes RAG, servidores MCP y ejecuta un bucle ReAct. Sin API key o con `LLM_MOCK_MODE=true`, usa modo simulado.

> El runtime legacy no hereda automáticamente un blueprint generado. La instalación y ejecución versionada de bundles es una fase posterior.

---

## Quick start

### Backend

```bash
npm ci
cp .env.example .env
npm run dev
```

Backend local:

```text
http://localhost:3001
```

Comprobar Creator:

```bash
curl http://localhost:3001/api/v1/creator/catalog
curl http://localhost:3001/api/v1/creator/workflow
curl http://localhost:3001/api/v1/creator/tutorial
```

### Frontends actuales

```bash
cd frontend && npm ci && npm run dev
cd agent-creator && npm ci && npm run dev
```

- Dashboard Next.js: `http://localhost:3000`
- Agent Creator Vite: `http://localhost:5173`

El Agent Creator actual aún debe migrarse al workflow server-driven.

### Docker

```bash
make docker-build
make docker-up
```

Consulta [`docs/deployment.md`](docs/deployment.md) para despliegue.

---

## Pruebas

```bash
npm run build
npm run test:unit
npm test
```

La suite cubre:

- catálogo, búsqueda y opciones custom;
- progreso y ramas desarrollo/producción;
- recomendaciones explicables;
- generación Huascar, Kiro y portable;
- RAG, PR review, hooks, skills y `AGENTS.md`;
- determinismo y hashes;
- árbol incompleto y secretos literales;
- contratos HTTP y compatibilidad legacy.

---

## Estructura relevante

```text
src/
├── creator/
│   ├── domain.ts        # Contratos y errores
│   ├── catalog.ts       # Catálogo tecnológico versionado
│   ├── decisionTree.ts  # Preguntas, condiciones y recomendaciones
│   ├── generator.ts     # Blueprint y artefactos puros
│   └── router.ts        # API /api/v1/creator
├── engine/
│   ├── HuascarEngine.ts
│   ├── RagEngine.ts
│   └── Store.ts
├── kiro/                # Configuración runtime actual de Huascar
├── config.ts
└── server.ts

test/
├── CreatorDecisionTree.test.mjs
├── CreatorGenerator.test.mjs
├── creatorFixture.mjs
└── api_test.mjs
```

---

## Roadmap

### Próxima fase: experiencia web

- [ ] Renderizar preguntas dinámicas desde `/workflow`.
- [ ] Conservar answers en `sessionStorage` y llamar `/evaluate` al cambiar.
- [ ] Implementar tutorial visual skippable tipo juego.
- [ ] Mostrar recomendaciones, warnings y diferencias entre targets.
- [ ] Descargar artefactos individuales o un ZIP validado.

### Identidad y persistencia

- [ ] Login mediante OIDC/OAuth.
- [ ] Organizaciones, ownership y roles.
- [ ] Guardar blueprints versionados y comparar revisiones.
- [ ] Reanudar borradores de forma autenticada.
- [ ] Auditoría de generación y ejecución.

### Ejecución segura

- [ ] Autenticación y autorización de toda la API runtime.
- [ ] Sandbox por agente y allowlists de herramientas.
- [ ] HITL unificado y reanudable.
- [ ] Namespaces RAG por agente.
- [ ] Rate limiting, cuotas y presupuestos.
- [ ] Aplicación del bundle mediante PR revisable.
- [ ] Despliegue controlado en EC2, contenedores y Kubernetes.

---

## Documentación adicional

- [`docs/architecture.md`](docs/architecture.md): motor y arquitectura interna.
- [`docs/deployment.md`](docs/deployment.md): despliegue local, Docker y Render.
- [`docs/use_cases.md`](docs/use_cases.md): casos de uso iniciales.
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md): ejemplo de conocimiento versionado.

## Licencia

MIT
