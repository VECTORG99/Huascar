import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('app module', () => {
  it('exports express app without listening', async () => {
    process.env.HUASCAR_DB_PATH = ':memory:';
    const { app, store } = await import(`../src/app.js?case=${Date.now()}`);
    assert.strictEqual(typeof app.use, 'function');
    store.close();
  });
});
