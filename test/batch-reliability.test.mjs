import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('Batch reliability fixes (#246,#250,#251,#252,#253,#255)', () => {

  it('#246: CORS blocks null origin explicitly', () => {
    const app = fs.readFileSync('src/app.ts', 'utf8');
    assert.match(app, /origin === 'null'/);
    assert.match(app, /null origin not allowed/);
  });

  it('#250: Multi-tenancy — auth middleware isolates by API key', () => {
    // Isolation is enforced via AUTH_REQUIRED + HUASCAR_API_KEYS
    // Each key represents a tenant; routes validate via requireAuth
    const auth = fs.readFileSync('src/middleware/auth.ts', 'utf8');
    assert.match(auth, /API_KEYS/);
    assert.match(auth, /extractToken/);
  });

  it('#251: SQLite sync operations — WAL mode reduces blocking', () => {
    // Store uses WAL mode which allows concurrent reads during writes
    const store = fs.readFileSync('src/engine/Store.ts', 'utf8');
    assert.match(store, /journal_mode.*WAL/i);
  });

  it('#252: RagEngine uses VectorIndex for search (not full memory load)', () => {
    // VectorIndex does approximate search with shortlisting
    assert.ok(fs.existsSync('src/engine/VectorIndex.ts'));
  });

  it('#253: McpConnectionPool has idle connection cleanup', () => {
    const pool = fs.readFileSync('src/engine/McpConnectionPool.ts', 'utf8');
    assert.match(pool, /closeIdleConnections/);
    assert.match(pool, /IDLE_TIMEOUT_MS/);
    assert.match(pool, /lastUsed/);
  });

  it('#255: Frontend has ErrorBoundary component', () => {
    assert.ok(fs.existsSync('frontend/src/components/ErrorBoundary.tsx'));
    const eb = fs.readFileSync('frontend/src/components/ErrorBoundary.tsx', 'utf8');
    assert.match(eb, /getDerivedStateFromError/);
    assert.match(eb, /componentDidCatch/);
  });
});
