import { describe, it } from 'node:test';
import assert from 'node:assert';
import { VectorIndex } from '../src/engine/VectorIndex.js';

function chunk(id, text, embedding) {
  return {
    id,
    source: 'test',
    chunk_index: id,
    chunk_text: text,
    embedding,
    content_hash: null,
    chunk_hash: `${id}`,
    created_at: 'now',
  };
}

describe('VectorIndex', () => {
  it('returns the relevant top result for simple vectors', () => {
    const index = new VectorIndex([
      chunk(1, 'cat', [1, 0]),
      chunk(2, 'dog', [0, 1]),
      chunk(3, 'opposite', [-1, 0]),
    ]);

    assert.strictEqual(index.search([0.9, 0.1], 1)[0].text, 'cat');
  });

  it('shortlists fewer candidates than the full corpus', () => {
    const chunks = [chunk(1, 'target', [1, 0])];
    for (let i = 2; i <= 50; i++) chunks.push(chunk(i, `near ${i}`, [0.8, 0.2]));
    for (let i = 51; i <= 100; i++) chunks.push(chunk(i, `far ${i}`, [-1, 0]));
    const index = new VectorIndex(chunks);

    assert.strictEqual(index.search([1, 0], 3)[0].text, 'target');
    assert.ok(index.lastCandidateCount < index.size);
    assert.strictEqual(index.lastUsedExactFallback, false);
  });

  it('falls back to exact search for small corpora', () => {
    const index = new VectorIndex([
      chunk(1, 'weak', [0.2, 0.8]),
      chunk(2, 'strong', [1, 0]),
    ]);

    assert.strictEqual(index.search([1, 0], 1)[0].text, 'strong');
    assert.strictEqual(index.lastCandidateCount, 2);
    assert.strictEqual(index.lastUsedExactFallback, true);
  });
});
