import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Render deployment security (issue #286)', () => {
  const renderYaml = fs.readFileSync(path.resolve('render.yaml'), 'utf8');

  it('render.yaml sets AUTH_REQUIRED=true', () => {
    assert.match(renderYaml, /AUTH_REQUIRED[\s\S]*value:\s*["']?true["']?/);
  });

  it('render.yaml generates HUASCAR_API_KEYS', () => {
    assert.match(renderYaml, /HUASCAR_API_KEYS[\s\S]*generateValue:\s*true/);
  });

  it('render.yaml sets NODE_ENV=production', () => {
    assert.match(renderYaml, /NODE_ENV[\s\S]*value:\s*["']?production["']?/);
  });

  it('render.yaml generates METRICS_SECRET', () => {
    assert.match(renderYaml, /METRICS_SECRET[\s\S]*generateValue:\s*true/);
  });

  it('frontend api.ts does NOT hardcode a production URL', () => {
    const apiTs = fs.readFileSync(path.resolve('frontend/src/lib/api.ts'), 'utf8');
    assert.doesNotMatch(apiTs, /onrender\.com/);
    assert.doesNotMatch(apiTs, /https:\/\/huascar\./);
  });

  it('frontend api.ts falls back to empty string (relative path)', () => {
    const apiTs = fs.readFileSync(path.resolve('frontend/src/lib/api.ts'), 'utf8');
    assert.match(apiTs, /process\.env\.NEXT_PUBLIC_API_URL \|\| ""/);
  });
});
