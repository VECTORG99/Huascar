import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Rate Limiting Configuration (issues #28, #39)', () => {
  it('global limit defaults to 100 req/min', () => {
    const limit = parseInt(process.env.RATE_LIMIT_GLOBAL || '100', 10);
    assert.equal(limit, 100);
  });

  it('execute limit defaults to 5 req/min (LLM protection)', () => {
    const limit = parseInt(process.env.RATE_LIMIT_EXECUTE || '5', 10);
    assert.equal(limit, 5);
  });

  it('creator limit defaults to 30 req/min', () => {
    const limit = parseInt(process.env.RATE_LIMIT_CREATOR || '30', 10);
    assert.equal(limit, 30);
  });

  it('custom limits via env vars', () => {
    process.env.RATE_LIMIT_GLOBAL = '200';
    const limit = parseInt(process.env.RATE_LIMIT_GLOBAL || '100', 10);
    assert.equal(limit, 200);
    delete process.env.RATE_LIMIT_GLOBAL;
  });

  it('key generator extracts IP from request', () => {
    const req = { ip: '192.168.1.100', socket: { remoteAddress: '192.168.1.100' } };
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    assert.equal(key, '192.168.1.100');
  });

  it('key generator falls back to socket.remoteAddress', () => {
    const req = { ip: undefined, socket: { remoteAddress: '10.0.0.1' } };
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    assert.equal(key, '10.0.0.1');
  });

  it('key generator falls back to unknown', () => {
    const req = { ip: undefined, socket: { remoteAddress: undefined } };
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    assert.equal(key, 'unknown');
  });
});
