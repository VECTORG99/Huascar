# ADR-0004: MCP for external tools instead of a custom tool protocol

## Status

Accepted

## Context

- `src/engine/McpConnectionPool.ts` uses `@modelcontextprotocol/sdk` clients over stdio transports.
- MCP server config comes from `src/kiro/mcps.json` or `MCPS_CONFIG_PATH`.
- `HuascarEngine.buildAiTools` maps MCP tool metadata and input schemas into AI SDK tools.
- Security hooks run before tool execution in `agentHooks.before_action`.

## Decision

- Use MCP as the external tool integration protocol.
- Keep custom code limited to config loading, connection pooling, timeouts, schema mapping, and hooks.
- Do not define a separate Huascar-specific tool server protocol.

## Alternatives Considered

- Custom JSON-over-stdio protocol: rejected; duplicates MCP discovery, schemas, transports, and ecosystem integrations.
- In-process plugin API only: rejected; weaker isolation and fewer reusable tools.
- Shell commands as tools directly: rejected; harder to schema, audit, timeout, and constrain.

## Consequences

- Compatible with existing MCP servers and tooling.
- Tool schemas can flow into model calls without bespoke adapters per tool.
- MCP server startup/runtime failures are external process failures; pool logs and skips failed servers.
- Current transport is stdio-focused; other MCP transports need explicit implementation.

## Revisit Conditions

- Required tools cannot be represented cleanly as MCP tools.
- Need remote MCP transports or auth modes not covered by current connection pool.
- MCP SDK changes break compatibility or impose unacceptable runtime cost.
