import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { RagEngine } from '../src/engine/RagEngine.js';
import { Store } from '../src/engine/Store.js';
import { config } from '../src/config.js';

function cleanupDb(dbPath) {
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(dbPath + suffix)) fs.unlinkSync(dbPath + suffix);
  }
}

describe('RagEngine', () => {
  it('loads inline source', async () => {
    const engine = new RagEngine({ maxContentChars: 1000 });
    await engine.loadSources([{ type: 'inline', content: 'test content' }]);
    const ctx = await engine.getContext();
    assert.ok(ctx.includes('test content'));
    assert.ok(ctx.includes('inline'));
  });

  it('returns empty context with no sources', async () => {
    const engine = new RagEngine();
    await engine.loadSources([]);
    assert.strictEqual(await engine.getContext(), '');
  });

  it('truncates content exceeding maxContentChars', async () => {
    const engine = new RagEngine({ maxContentChars: 10 });
    await engine.loadSources([{ type: 'inline', content: 'a'.repeat(100) }]);
    const ctx = await engine.getContext();
    assert.ok(ctx.includes('truncado'));
    assert.ok(ctx.length < 150);
  });

  it('handles web_url with blocked host', async () => {
    const engine = new RagEngine();
    await engine.loadSources([{ type: 'web_url', url: 'http://localhost:3001/test' }]);
    assert.strictEqual(await engine.getContext(), '');
  });

  it('handles unknown source type with warning', async () => {
    const engine = new RagEngine();
    await engine.loadSources([{ type: 'ftp_url' }]);
    assert.strictEqual(await engine.getContext(), '');
  });

  it('warns on replacing existing sources', async () => {
    const engine = new RagEngine();
    await engine.loadSources([{ type: 'inline', content: 'first' }]);
    assert.ok((await engine.getContext()).includes('first'));
    await engine.loadSources([{ type: 'inline', content: 'second' }]);
    assert.ok((await engine.getContext()).includes('second'));
    assert.ok(!(await engine.getContext()).includes('first'));
  });

  it('skips unchanged source reindexing but keeps context loaded', async () => {
    const dbPath = '/tmp/huascar_rag_hash_unchanged_unit.db';
    cleanupDb(dbPath);
    const store = new Store(dbPath);
    const originalHasKey = config.hasEmbeddingApiKey;
    const originalFetch = globalThis.fetch;
    let embeddingCalls = 0;

    config.hasEmbeddingApiKey = true;
    globalThis.fetch = async () => {
      embeddingCalls++;
      return { ok: true, json: async () => ({ data: [{ index: 0, embedding: [1, 0] }] }) };
    };

    try {
      const engine = new RagEngine({ store });
      await engine.loadSources([{ type: 'inline', content: 'same content' }]);
      const firstHash = store.getContentHashBySource('inline');
      await engine.loadSources([{ type: 'inline', content: 'same content' }]);

      assert.strictEqual(store.getChunksCount(), 1);
      assert.strictEqual(store.getContentHashBySource('inline'), firstHash);
      assert.strictEqual(embeddingCalls, 1);
      assert.ok((await engine.getContext()).includes('same content'));
    } finally {
      config.hasEmbeddingApiKey = originalHasKey;
      globalThis.fetch = originalFetch;
      store.close();
      cleanupDb(dbPath);
    }
  });

  it('reindexes changed source content', async () => {
    const dbPath = '/tmp/huascar_rag_hash_changed_unit.db';
    cleanupDb(dbPath);
    const store = new Store(dbPath);
    const originalHasKey = config.hasEmbeddingApiKey;
    const originalFetch = globalThis.fetch;
    let embeddingCalls = 0;

    config.hasEmbeddingApiKey = true;
    globalThis.fetch = async () => {
      embeddingCalls++;
      return { ok: true, json: async () => ({ data: [{ index: 0, embedding: [1, 0] }] }) };
    };

    try {
      const engine = new RagEngine({ store });
      await engine.loadSources([{ type: 'inline', content: 'first content' }]);
      const firstHash = store.getContentHashBySource('inline');
      await engine.loadSources([{ type: 'inline', content: 'changed content' }]);

      assert.strictEqual(store.getChunksCount(), 1);
      assert.notStrictEqual(store.getContentHashBySource('inline'), firstHash);
      assert.strictEqual(store.getAllChunks()[0].chunk_text, 'changed content');
      assert.strictEqual(embeddingCalls, 2);
    } finally {
      config.hasEmbeddingApiKey = originalHasKey;
      globalThis.fetch = originalFetch;
      store.close();
      cleanupDb(dbPath);
    }
  });
});
