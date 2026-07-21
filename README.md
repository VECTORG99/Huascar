# Huascar - Plataforma de Agentes IA

**El problema:** Construir agentes de IA robustos requiere orquestar RAG, MCP, ReAct y evaluaciones complejas.
**La solución:** Una plataforma que abstrae la complejidad en configuraciones declarativas simples.

## Propuesta de Valor
Construye, evalúa y despliega agentes en minutos, no en semanas. Simplificamos la arquitectura cognitiva para que te enfoques en el caso de uso.

## Instalación
```bash
npm install
npm start
```

### ¿Cómo se ve?
```json
{
  "steering": { "role": "DevOps Reviewer" },
  "rag": { "docs": "./wiki" },
  "hooks": { "on_error": "notify_slack" },
  "mcps": ["github-pr", "bash"]
}
```
