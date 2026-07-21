# Plan de Implementación: Proyecto Huascar (Hackathon Sprint)

Este documento detalla la hoja de ruta exacta, estructurada para ejecutarse en el marco de tiempo de una Hackathon (24-48 hrs). El objetivo es maximizar la entrega de valor visual y funcional en el menor tiempo posible.

## Fase 1: Setup y Motor Core (Día 1 - Noche)
**Objetivo:** Tener la infraestructura base y el "Motor Huascar" capaz de leer una configuración y comunicarse con un LLM.
- [ ] **Setup del Monorepo:** Inicializar Next.js (Frontend) y Express/Fastify (Backend) con TypeScript.
- [ ] **Motor de Configuración:** Crear una clase `HuascarEngine` que reciba el `agent-config.json`.
- [ ] **Integración LLM:** Conectar el SDK de OpenAI/Anthropic.
- [ ] **Integración MCP:** Instalar `@modelcontextprotocol/sdk`. Crear un MCP local de prueba que simplemente lea un archivo (simulando el `rag` o `context`).

## Fase 2: APIs y Casos de Uso (Día 2 - Mañana)
**Objetivo:** Exponer la funcionalidad del agente a través de una API REST.
- [ ] **Endpoint `/api/agent/build`:**
  - *Request:* Recibe el JSON de configuración de Huascar.
  - *Response:* Confirma que el agente está instanciado y listo en memoria.
- [ ] **Endpoint `/api/agent/execute`:**
  - *Request:* `{ "task": "Generar pruebas unitarias para auth.js", "agent_id": "..." }`
  - *Acción:* El backend inyecta los `Hooks` y usa los `MCPs` configurados para generar la respuesta.
  - *Response:* El código generado o el análisis del PR.

## Fase 3: Interfaz de Usuario / Frontend (Día 2 - Tarde)
**Objetivo:** Una interfaz atractiva que demuestre lo fácil que es crear agentes de productividad.
- [ ] **Vista 1 - El "Builder":** Un panel estilo "drag and drop" o formulario visual moderno con Tailwind donde el usuario selecciona: Rol del Agente, Fuentes de RAG, y Herramientas (MCP).
- [ ] **Vista 2 - La "Terminal de Ejecución":** Una vista estilo consola que muestre los logs en tiempo real (ej. "Agente leyendo contexto...", "Agente detectando errores...", "Aplicando Hook de seguridad..."). Esto "vende" el proyecto a los jueces.

## Fase 4: Preparación de la Demo (Día 3 - Mañana)
**Objetivo:** Asegurar que la presentación no falle en vivo.
- [ ] **Repositorio de Prueba:** Crear un repositorio falso (`dummy-repo`) con un error de código intencional.
- [ ] **Ensayo del Flujo:** 
  1. Mostrar el código con el error.
  2. Construir el agente "Code Reviewer" en 3 clics usando la UI de Huascar.
  3. Ejecutar el agente y ver cómo detecta el error mediante su conexión MCP.
- [ ] **Pitch Deck:** Resumir la Propuesta de Valor (Productividad, Abstracción de MCP/RAG, Escalabilidad).

---

## Anexo: Contratos de Datos (JSON)
Definir esto evita bloqueos entre el equipo de Frontend y Backend.

**Payload de Configuración de Huascar (`agent-config.json` virtual):**
```json
{
  "name": "DevOpsPRReviewer",
  "steering": {
    "role": "Senior DevOps Engineer",
    "instructions": "Busca vulnerabilidades de seguridad y problemas de CI/CD."
  },
  "rag": {
    "sources": ["./local-dummy-repo"]
  },
  "mcps": ["filesystem-read", "github-comments"],
  "hooks": {
    "require_human_approval_on": "commit"
  }
}
```
