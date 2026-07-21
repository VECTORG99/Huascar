# Plan de Implementación (Hackathon)

Hoja de ruta paso a paso para la ejecución.

## 1. Backend
- Configurar servidor base.
- Integrar LLM / Agente.
- Exponer endpoints principales (`/generate`, `/review`).

## 2. UI
- Crear interfaz minimalista.
- Conectar con endpoints del backend.
- Mostrar resultados (código, tests, reviews).

## 3. Demo
- Preparar repositorio de prueba.
- Ejecutar flujo principal (scaffolding -> test -> PR review).
- Refinar pitch y grabar demostración.

## Anexo: Decisiones Técnicas (Hackathon)
- **Stack Backend:** Node.js (TypeScript), Express, `@modelcontextprotocol/sdk`.
- **Stack Frontend:** Next.js (React), TailwindCSS.
- **Contratos JSON (API):**
  - `POST /api/agent/scaffold` -> `{ "steering": "...", "mcps": [...] }`
