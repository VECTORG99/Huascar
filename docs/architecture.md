# Arquitectura

La construcción tradicional de agentes enfrenta múltiples desafíos:
- **Limitaciones de Contexto:** Los modelos olvidan información o se degradan con prompts largos.
- **ReAct (Reason+Act):** Implementar bucles de razonamiento y uso de herramientas es propenso a errores.
- **MCP (Model Context Protocol):** Integrar múltiples fuentes de contexto requiere código repetitivo.
- **RAG (Retrieval-Augmented Generation):** Mantener bases vectoriales y estrategias de chunking es complejo.
- **LoRA (Low-Rank Adaptation):** Ajustar modelos es costoso. Nuestro `Steering` avanzado y `RAG` reducen la necesidad de fine-tuning.
- **Orquestadores:** Coordinar múltiples agentes añade sobrecarga.
- **Evaluación de Agentes:** Medir el rendimiento de forma determinista es difícil.

## Nuestra Solución (Inspirada en Kiro)

Simplificamos estos conceptos complejos en primitivas manejables:

1. **Steering (Dirección):** Reemplaza la complejidad de ReAct y Orquestadores con instrucciones claras y directrices de comportamiento.
2. **RAG:** Abstrae la vectorización y recuperación; solo conectas tus fuentes de datos.
3. **Hooks:** Intercepta y modifica el flujo del agente sin reescribir el bucle principal (soluciona limitaciones de contexto y evaluación).
4. **Configuraciones MCP:** Conecta herramientas y APIs de forma declarativa, sin código de integración manual.
