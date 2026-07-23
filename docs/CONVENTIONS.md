# Coding Conventions

Audience: LLM agents changing this repository. Use this as the default style guide for source, tests, routes, docs, and PRs. Prefer existing project patterns over generic framework advice. If a rule conflicts with `AGENTS.md`, `CONTEXT.md`, or an ADR, the more specific project document wins.

Core rule: smallest safe change that solves the issue. Do not add abstractions, dependencies, folders, config, background jobs, caches, or documentation unless the issue requires them or an existing caller needs them now.

## Files / module structure

Principles:

- Keep modules focused on one runtime concern: route registration, storage, engine logic, provider integration, schema/config loading, or UI component.
- Put code next to the layer that owns it. Do not create shared utilities until at least two real call sites need the same behavior.
- Preserve existing naming style in the target folder. Use PascalCase for classes and class-backed modules, camelCase for functions/values, kebab-case for docs/branch names.
- Prefer small exported functions over large exported objects. Export only what tests or other modules import.
- Keep side effects at edges: server startup, database writes, environment reads, network calls, and filesystem access should be easy to locate.
- Avoid barrel files unless already present in the same area. Direct imports make impact analysis easier for agents.
- Generated/build output stays out of source commits unless the repository already tracks that exact artifact type.

Recommended layout behavior:

- `src/server.ts` / app bootstrap: wiring only. No business rules hidden in startup.
- `src/routes` or route modules: HTTP parsing, validation, status codes, response shape.
- Engine/service modules: deterministic business behavior; no Express request/response objects.
- Store/persistence modules: SQL/filesystem details and durable invariants.
- `src/kiro/*.json`: agent-consumed config. Keep schema-valid and update tests when required.
- `test/*.test.mjs`: node:test unit and contract checks. Keep fixtures inline unless reused.
- `docs/*.md`: machine-readable operational documentation. Use concrete paths, rules, and update triggers.

Do:

```ts
// route owns HTTP concerns; engine owns behavior
app.post('/agents', async (req, res, next) => {
  try {
    const agent = await engine.createAgent(parseCreateAgent(req.body));
    res.status(201).json(agent);
  } catch (error) {
    next(error);
  }
});
```

Don't:

```ts
// business logic, persistence, and HTTP mixed together
app.post('/agents', async (req, res) => {
  const id = Math.random().toString();
  db.prepare('insert into agents ...').run(id, req.body.name);
  res.json({ ok: true });
});
```

Do:

```ts
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
```

Don't:

```ts
export class StringHelperFactory {
  create() {
    return { normalizeName: (value: string) => value.trim().replace(/\s+/g, ' ') };
  }
}
```

## TypeScript patterns

Compiler expectations:

- Keep `tsc --noEmit` clean. Do not silence errors with broad casts.
- Use explicit types at trust boundaries: request bodies, environment variables, JSON config, database rows, external provider results.
- Let TypeScript infer obvious local variables and return types for tiny private helpers. Add return types to exported functions, public methods, and callbacks where inference hides the contract.
- Avoid `any`. Use `unknown` at boundaries, narrow it, then convert into a typed internal shape.
- Prefer discriminated unions for finite states and provider results. Avoid stringly-typed branching scattered across files.
- Use `readonly` for arrays/objects passed as inputs when mutation is not part of the contract.
- Avoid non-null assertions (`!`) except after a local guard that TypeScript cannot understand; prefer a small guard function.
- Use `satisfies` for object literals checked against a type without widening values.
- Prefer `const` and pure helpers. Use mutation only when it makes the code shorter and local.
- No new runtime dependency for validation if a small guard covers the current input.

Boundary parsing pattern:

```ts
type CreateAgentInput = {
  name: string;
  role: string;
};

export function parseCreateAgent(value: unknown): CreateAgentInput {
  if (!value || typeof value !== 'object') throw new Error('request body must be an object');
  const body = value as Record<string, unknown>;
  if (typeof body.name !== 'string' || body.name.trim() === '') throw new Error('name is required');
  if (typeof body.role !== 'string' || body.role.trim() === '') throw new Error('role is required');
  return { name: body.name.trim(), role: body.role.trim() };
}
```

Do:

```ts
type ProviderResult =
  | { status: 'ok'; text: string }
  | { status: 'rate_limited'; retryAfterMs: number }
  | { status: 'failed'; error: Error };
```

Don't:

```ts
type ProviderResult = {
  status: string;
  text?: string;
  retryAfterMs?: number;
  error?: unknown;
};
```

Do:

```ts
const ragConfig = {
  knowledge_bases: [{ type: 'local_file', path: './CONTEXT.md' }],
} satisfies RagConfig;
```

Don't:

```ts
const ragConfig = loadConfig() as any;
```

## Error handling

Goals:

- Preserve enough context to debug failures without exposing secrets.
- Return predictable API errors to clients.
- Fail fast on invalid config, schema, request bodies, and impossible states.
- Keep process-level crashes for startup/configuration problems; runtime request failures should go through route error handling.

Rules:

- Throw `Error` instances, not strings or plain objects.
- Add context at the boundary that understands the operation. Do not wrap the same error repeatedly at every stack frame.
- Never log secrets, bearer tokens, API keys, raw `.env` values, or full provider payloads that may contain user data unless explicitly sanitized.
- Use `unknown` in `catch`, then normalize with `error instanceof Error ? error : new Error(String(error))`.
- For HTTP routes, map known validation/client failures to 4xx and unexpected failures to 500. Do not leak stack traces in responses.
- For persistence, prefer database constraints for durable invariants and translate constraint failures only when the API needs a stable message.
- Clean up resources with `finally` or ownership-specific close/dispose methods when the function opens them.
- Include identifiers useful for correlation (`agentId`, `sessionId`, `provider`) but not secret values.

Do:

```ts
try {
  return await provider.generate(request);
} catch (error) {
  const cause = error instanceof Error ? error : new Error(String(error));
  throw new Error(`provider generate failed: ${providerName}`, { cause });
}
```

Don't:

```ts
try {
  return await provider.generate(request);
} catch (error) {
  console.error('provider failed', request, process.env.OPENAI_API_KEY, error);
  throw error;
}
```

Do:

```ts
if (!session) {
  res.status(404).json({ error: 'session not found' });
  return;
}
```

Don't:

```ts
res.status(200).json({ error: 'session not found' });
```

## Testing

Default test stack: Node's built-in `node:test` plus `node:assert/strict`. Do not add a test framework for ordinary unit coverage.

What to test:

- New business logic branches, parsers, validators, persistence behavior, route contracts, and docs/config invariants.
- Regressions fixed by the issue. Add the smallest test that would fail before the fix.
- Agent-consumed docs/config when requirements are structural, such as required headings or schema entries.

What not to test:

- Trivial one-line pass-throughs.
- Framework behavior already covered by Express/Node/TypeScript.
- Implementation details that make refactors noisy without protecting behavior.

Rules:

- Keep tests deterministic: no real network, no wall-clock assumptions without injection, no dependency on test order.
- Use temporary directories/files for filesystem tests and clean them up.
- Prefer inline fixtures. Move fixtures to files only when reuse or readability demands it.
- Keep each test name behavior-oriented: `rejects missing agent name`, not `test parseCreateAgent`.
- Use exact assertions for stable shapes and `assert.match` for messages/markdown headings.
- When adding docs required by RAG or Kiro config, test that the file remains discoverable and schema-valid if cheap.

Do:

```js
import assert from 'node:assert/strict';
import { it } from 'node:test';

it('rejects missing agent name', () => {
  assert.throws(() => parseCreateAgent({ role: 'planner' }), /name is required/);
});
```

Don't:

```js
it('works', () => {
  parseCreateAgent({ role: 'planner' });
});
```

Do:

```js
for (const heading of ['Files / module structure', 'Testing']) {
  assert.match(markdown, new RegExp(`^## ${heading.replace(/[/-]/g, '\\$&')}$`, 'm'));
}
```

Don't:

```js
assert.ok(markdown.includes('test'));
```

## API routes

Route responsibilities:

- Authenticate/authorize when applicable.
- Parse and validate params, query, and body.
- Call the smallest service/engine method needed.
- Return stable status codes and JSON response shapes.
- Pass unexpected errors to centralized error handling.

Route conventions:

- Use nouns and existing resource names. Avoid new route naming schemes in the same API.
- Use correct HTTP methods: `GET` read, `POST` create/action, `PATCH` partial update, `DELETE` remove.
- `201` for created resources, `200` for successful reads/actions with a body, `204` for successful deletion with no body.
- Client input errors are `400`; missing resources `404`; conflicts `409`; auth failures `401`/`403`; unexpected errors `500`.
- Validate route params before calling services. Do not let invalid IDs become SQL/provider calls.
- Keep response objects explicit. Avoid returning raw database rows or provider SDK objects directly.
- Do not change public API response fields without updating tests and relevant docs/OpenAPI files.
- Keep streaming/SSE/WebSocket behavior isolated from ordinary JSON routes.

Do:

```ts
app.get('/sessions/:sessionId', async (req, res, next) => {
  try {
    const session = await engine.getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    res.json({ session });
  } catch (error) {
    next(error);
  }
});
```

Don't:

```ts
app.get('/getSession', async (req, res) => {
  res.json(await db.prepare(`select * from sessions where id = '${req.query.id}'`).get());
});
```

Do:

```ts
res.status(201).json({ agent: toAgentResponse(agent) });
```

Don't:

```ts
res.json({ ok: true, data: providerRawResponse });
```

## Git / PR conventions

Repository flow:

- Base all feature/fix/docs branches on current `origin/development` unless the user explicitly requests a hotfix.
- Branch names: `feature/<short-topic>`, `fix/<short-topic>`, `docs/<short-topic>`, or `hotfix/<short-topic>`.
- Do not push directly to `master` or `development`.
- Every code/doc change goes through a PR targeting `development` unless explicitly authorized otherwise.
- Link the relevant issue in the PR body with `Closes #N`.

Commit conventions:

- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Keep commits scoped to the issue. Do not mix drive-by formatting or unrelated cleanups.
- Commit generated lockfile changes only when dependency changes require them.
- Before commit/PR, inspect `git status` and `git diff`; stage only intended files.

PR body conventions:

- Summary: 1-3 bullets of what changed.
- Validation: exact commands run and pass/fail/skip reason.
- Risk/deviations: note intentionally skipped requirements, known follow-up, or blockers.
- Issue link: `Closes #N`.

Do:

```text
docs: expand coding conventions (#70)

- Expands docs/CONVENTIONS.md with source, TS, errors, tests, API, and PR rules.
- Adds a docs invariant test for required headings.

Validation:
- npm run test:unit
- npx tsc --noEmit

Closes #70
```

Don't:

```text
updates

changed some docs and other stuff
```

Do:

```bash
git checkout -B docs/issue-70-conventions origin/development
git status --short
git diff
```

Don't:

```bash
git push origin development
```
