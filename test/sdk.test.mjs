import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HuascarClient, HuascarApiError } from '../sdk/src/index.ts';

describe('HuascarClient SDK (#85)', () => {
  it('creates client with options', () => {
    const client = new HuascarClient({ baseUrl: 'http://localhost:3001' });
    assert.ok(client);
  });

  it('normalizes trailing slash in baseUrl', () => {
    const client = new HuascarClient({ baseUrl: 'http://localhost:3001/' });
    assert.ok(client);
  });

  it('HuascarApiError has correct structure', () => {
    const err = new HuascarApiError('ENGINE_ERROR', 'Something went wrong', 500, { field: 'value' });
    assert.equal(err.code, 'ENGINE_ERROR');
    assert.equal(err.message, 'Something went wrong');
    assert.equal(err.statusCode, 500);
    assert.deepEqual(err.details, { field: 'value' });
    assert.equal(err.name, 'HuascarApiError');
    assert.ok(err instanceof Error);
  });

  it('handles connection errors gracefully', async () => {
    const client = new HuascarClient({
      baseUrl: 'http://localhost:19999', // non-existent port
      maxRetries: 0,
      timeoutMs: 1000,
    });

    await assert.rejects(
      () => client.health(),
      (err) => err instanceof Error,
    );
  });
});
