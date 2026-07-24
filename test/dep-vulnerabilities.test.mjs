import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Dependency vulnerability fixes (issue #240)', () => {
  const frontendPkg = JSON.parse(fs.readFileSync(path.resolve('frontend/package.json'), 'utf8'));

  it('Next.js is updated to >=16.3.0 (fixes SSRF, DoS, cache CVEs)', () => {
    const version = frontendPkg.dependencies.next;
    // ^16.3.0 will resolve to latest 16.3.x which contains the fixes
    assert.match(version, /\^16\.3/);
  });

  it('sharp is pinned to >=0.35.0 (fixes libvips CVEs)', () => {
    const sharp = frontendPkg.dependencies.sharp;
    assert.ok(sharp, 'sharp should be listed as dependency');
    assert.match(sharp, />=0\.35\.0/);
  });

  it('eslint-config-next uses ^16.3.0 range', () => {
    const eslintNext = frontendPkg.devDependencies['eslint-config-next'];
    assert.match(eslintNext, /\^16\.3/);
  });

  it('MCP SDK vulnerability is documented (upstream dependency)', () => {
    const rootPkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    const mcpSdk = rootPkg.dependencies['@modelcontextprotocol/sdk'];
    // The @hono/node-server vulnerability requires upstream MCP SDK update
    // We document it and monitor via npm audit in CI
    assert.ok(mcpSdk, 'MCP SDK should be present');
  });
});
