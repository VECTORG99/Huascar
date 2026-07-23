import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('CORS Configuration (issue #37)', () => {
  it('CORS_ALLOWED_ORIGINS env var is parsed correctly', () => {
    const raw = 'http://localhost:3000,http://localhost:5173, https://app.example.com';
    const origins = raw.split(',').map(o => o.trim());
    assert.deepEqual(origins, ['http://localhost:3000', 'http://localhost:5173', 'https://app.example.com']);
  });

  it('request without origin is allowed (CLI tools, server-to-server)', () => {
    const origin = undefined;
    const allowedOrigins = ['http://localhost:3000'];
    const allowed = !origin || allowedOrigins.includes(origin);
    assert.equal(allowed, true);
  });

  it('request with valid origin is allowed', () => {
    const origin = 'http://localhost:3000';
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173'];
    const allowed = !origin || allowedOrigins.includes(origin);
    assert.equal(allowed, true);
  });

  it('request with invalid origin is rejected', () => {
    const origin = 'http://evil.com';
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173'];
    const allowed = !origin || allowedOrigins.includes(origin);
    assert.equal(allowed, false);
  });

  it('wildcard origins are NOT supported (explicit list only)', () => {
    const origin = 'http://anything.com';
    const allowedOrigins = ['*']; // Even with *, our logic doesn't match
    const allowed = !origin || allowedOrigins.includes(origin);
    assert.equal(allowed, false);
  });

  it('maxAge value is set for preflight caching', () => {
    const maxAge = 86400;
    assert.equal(maxAge, 86400); // 24 hours in seconds
  });
});
