# ADR-0006: Security hooks fail closed

## Status

Accepted

## Context

- `src/kiro/hooks.ts` loads `src/kiro/security-policy.json` or `SECURITY_POLICY_PATH`.
- If policy loading fails, `loadPolicy()` returns a policy that blocks all tools.
- `agentHooks.before_action` strips model-supplied `bypass_secret`, checks allowlists, blocked tool names, and blocked argument substrings.
- Admin bypass is only activated through exported server-side state, not model-generated tool arguments.

## Decision

- Keep security hooks fail-closed when policy configuration is missing or invalid.
- Enforce hook checks before every MCP tool execution.
- Never accept bypass credentials from model/tool arguments.

## Alternatives Considered

- Fail open on missing policy: rejected; a config/read error would silently allow unsafe tool use.
- Prompt-only safety policy: rejected; model instructions are not an enforcement boundary.
- Per-tool optional hooks: rejected; unsafe defaults during tool registration are too easy.

## Consequences

- Misconfigured policy can block all tool execution until fixed.
- Prompt injection that tries to pass bypass data through tool args is ignored.
- Tests can assert security behavior without real MCP servers.
- New tool integrations must be compatible with hook allow/block policy.

## Revisit Conditions

- Production needs scoped, auditable administrative overrides with stronger identity than a shared secret.
- Policy evaluation becomes too coarse for legitimate high-risk tools.
- Hook latency or false positives materially block expected agent execution.
