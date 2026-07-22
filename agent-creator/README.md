# Huascar Agent Creator

Frontend Vite + React que renderiza el árbol de decisiones del Creator Backend v1.

## Funcionalidad

- Carga catálogo, workflow y tutorial desde `/api/v1/creator`.
- Presenta un tutorial ficticio y skippable.
- Renderiza preguntas de texto, booleanas, opciones y catálogo sin codificar el flujo en el cliente.
- Permite buscar tecnologías y agregar opciones `custom:<slug>`.
- Conserva respuestas, cursor visible y fase de navegación en `sessionStorage`.
- Reevalúa ramas, progreso, recomendaciones y advertencias con el backend.
- Revisa todas las decisiones antes de generar.
- Descarga el bundle JSON o cada artefacto individual.

El frontend no ejecuta agentes, no escribe archivos y no realiza despliegues.

## Desarrollo

```bash
cp .env.example .env
npm ci
npm run dev
```

Variables:

```env
VITE_API_URL=http://localhost:3001
```

La URL debe ser accesible desde el navegador, no sólo desde la red interna de Docker.

## Validación

```bash
npm run lint
npm run build
```

## Contrato utilizado

```text
GET  /api/v1/creator/catalog
GET  /api/v1/creator/workflow
GET  /api/v1/creator/tutorial
POST /api/v1/creator/evaluate
POST /api/v1/creator/preview
```

Las respuestas se mantienen en el cliente. El backend es stateless, devuelve la evaluación canónica y poda ramas ocultas. El cursor restaura la pregunta visible exacta; para datos antiguos sin cursor, el cliente retoma la primera decisión visible pendiente. Con respuestas requeridas completas, restaura la edición sólo si esa era la fase guardada y, en caso contrario, abre la revisión.
