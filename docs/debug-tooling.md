# Debug Tooling

Development-only tools for inspecting, testing, and debugging the Huascar engine.

## Request Inspector

Captures the last 100 requests with timing breakdown.

```bash
# List recent requests
curl http://localhost:3001/api/debug/requests

# Get specific request details
curl http://localhost:3001/api/debug/requests/<id>
```

## Timing Breakdown

Include `X-Debug: true` header to get timing info in responses:

```bash
curl -H "X-Debug: true" -X POST http://localhost:3001/api/agent/execute \
  -H "Content-Type: application/json" \
  -d '{"task": "Hello", "role": "DEVELOPER"}'
```

## Request Replay

Re-execute a previous request from history:

```bash
curl -X POST http://localhost:3001/api/debug/replay/<executionId>
```

## REPL

Interactive shell for testing without HTTP:

```bash
npm run repl
```

Commands:

- `.role <ROLE_NAME>` — set active role
- `.task <text>` — set task
- `.execute` — run task
- `.last` — show last result
- `.history [n]` — show history
- `.health` — check backend
- `.tools` — list tools
- `.help` — show help
- `.exit` — quit

## System Stats

```bash
curl http://localhost:3001/api/debug/stats
```

## Security

All debug routes are **disabled in production** (`NODE_ENV=production`).
They return 404 when disabled.
