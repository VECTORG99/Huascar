# ADR-0003: Vercel AI SDK over direct provider APIs

## Status

Accepted

## Context

- `src/engine/LlmProvider.ts` imports `generateText` from `ai` and providers from `@ai-sdk/openai` and `@ai-sdk/anthropic`.
- Local OpenAI-compatible endpoints use `createOpenAI` with `LOCAL_BASE_URL`.
- `LLM_PROVIDER_CHAIN` controls fallback order across `openai`, `anthropic`, and `local`.
- `HuascarEngine` passes AI SDK tools built from MCP tool schemas.

## Decision

- Use the Vercel AI SDK as the model-provider abstraction.
- Keep provider retry/fallback policy in `LlmProvider.ts`, not scattered through engine code.
- Prefer OpenAI-compatible local providers through the SDK adapter instead of separate client code.

## Alternatives Considered

- Direct OpenAI/Anthropic SDK calls: rejected; duplicates text generation, tool-call, retry, and model configuration paths.
- Raw HTTP clients: rejected; more schema and error handling with no current benefit.
- One provider only: rejected; repo already supports provider fallback and local model mode.

## Consequences

- Shared API for OpenAI, Anthropic, and local compatible models.
- Engine code stays provider-agnostic.
- Dependency upgrades can affect tool schemas and generation semantics globally.
- Provider-specific features may require SDK support or narrow escape hatches.

## Revisit Conditions

- Required provider feature is unavailable or unstable in the AI SDK.
- SDK abstraction prevents secure/error-correct behavior that direct clients provide.
- Provider fallback policy becomes too provider-specific for one common wrapper.
