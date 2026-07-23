# ADR-0002: ReAct loop in HuascarEngine instead of a graph runtime

## Status

Accepted

## Context

- `src/engine/HuascarEngine.ts` owns task execution, steering role selection, RAG context injection, MCP tool loading, and persistence.
- `config.react.maxIterations` bounds tool iterations.
- Tool calls are provided to the Vercel AI SDK as a `ToolSet`, and loop stopping uses SDK step-count behavior.
- Current tasks are short agent executions, not long-lived branching workflows.

## Decision

- Keep execution as a bounded ReAct loop inside `HuascarEngine`.
- Do not introduce a graph/workflow runtime for current task execution.
- Model orchestration remains: load context, expose tools, call LLM, save execution.

## Alternatives Considered

- Graph runtime/state machine: rejected for now; adds nodes, edges, checkpoints, and migration paths before workflows require them.
- One-shot prompt without tools: rejected; MCP/RAG/tool use is core runtime behavior.
- Recursive custom loop: rejected; harder to bound and test than the SDK step-count path.

## Consequences

- Small execution surface and direct tests around `HuascarEngine`.
- Easy injection of fake RAG, MCP pool, and LLM provider in unit tests.
- Complex branching, resumable workflows, and human-in-loop graph checkpoints are not first-class.
- Tool sequencing is primarily model-directed within configured iteration limits.

## Revisit Conditions

- Requirements add durable multi-step workflows, explicit branches, or resumable checkpoints.
- Agents need deterministic orchestration independent of model tool-choice behavior.
- ReAct iteration logs are insufficient for debugging production failures.
