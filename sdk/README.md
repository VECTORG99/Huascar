# @huascar/sdk

TypeScript client library for consuming the Huascar API programmatically.

## Installation

```bash
npm install @huascar/sdk
```

## Quick Start

```typescript
import { HuascarClient } from '@huascar/sdk';

const client = new HuascarClient({
  baseUrl: 'http://localhost:3001',
  apiKey: 'your-api-key', // optional
});

// Execute a task
const result = await client.execute({
  task: 'Review this code for security issues',
  role: 'PR_REVIEWER',
});
console.log(result.response);

// Streaming execution
for await (const event of client.executeStream({ task: 'Analyze codebase', role: 'DEVELOPER' })) {
  console.log(event.type, event.data);
}

// Check health
const health = await client.health();

// Get history
const history = await client.history({ limit: 10 });

// List available tools
const tools = await client.tools();
```

## Features

- **Type-safe**: Full TypeScript types for all request/response shapes
- **Retry with backoff**: Automatic retry on transient failures (5xx, network errors)
- **Streaming**: SSE support via async generators
- **Error handling**: Structured `HuascarApiError` with code, message, and status
- **Configurable**: Custom headers, timeout, retry policy

## API

### `new HuascarClient(options)`

| Option         | Type                   | Default   | Description           |
| -------------- | ---------------------- | --------- | --------------------- |
| `baseUrl`      | string                 | required  | Backend URL           |
| `apiKey`       | string                 | undefined | Bearer token for auth |
| `maxRetries`   | number                 | 2         | Max retry attempts    |
| `retryDelayMs` | number                 | 1000      | Initial retry delay   |
| `timeoutMs`    | number                 | 120000    | Request timeout       |
| `headers`      | Record<string, string> | {}        | Additional headers    |

### Methods

- `client.execute(request)` — Execute a task
- `client.executeStream(request)` — Execute with SSE streaming
- `client.health()` — Health check
- `client.history(options?)` — Get execution history
- `client.tools()` — List available tools

## Error Handling

```typescript
import { HuascarApiError } from '@huascar/sdk';

try {
  await client.execute({ task: '...', role: '...' });
} catch (err) {
  if (err instanceof HuascarApiError) {
    console.error(`[${err.code}] ${err.message} (HTTP ${err.statusCode})`);
  }
}
```
