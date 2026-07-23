import { describe, it } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

describe('openapi endpoint', () => {
  it('returns OpenAPI 3.1 spec with key paths', async () => {
    process.env.HUASCAR_DB_PATH = ':memory:';
    const { app, store } = await import(`../src/app.js?case=${Date.now()}`);
    const server = http.createServer(app);

    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address();
      const res = await fetch(`http://127.0.0.1:${port}/api/openapi.json`);
      const body = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.openapi, '3.1.0');
      assert.ok(body.paths['/api/health']);
      assert.ok(body.paths['/api/agent/execute']);
      assert.ok(body.paths['/api/hooks/commit-approval/{id}']);
      assert.ok(body.paths['/api/rag/sources']);
      assert.ok(body.paths['/api/v1/creator/catalog']);
    } finally {
      await new Promise(resolve => server.close(resolve));
      store.close();
    }
  });
});
