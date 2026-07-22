import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RagEngine } from '../src/engine/RagEngine.js';

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
});
