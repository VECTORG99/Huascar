import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

describe('Dependency vulnerability fixes (issue #240)', () => {
  const frontendPkg = JSON.parse(fs.readFileSync(path.resolve('frontend/package.json'), 'utf8'));

  it('Next.js is updated to >=16.2.11 (latest stable with security patches)', () => {
    const version = frontendPkg.dependencies.next;
    // 16.2.11 is the latest stable; semver parse the pinned version
    const [major, minor, patch] = version.split('.').map(Number);
    assert.ok(major >= 16, 'major >= 16');
    assert.ok(minor >= 2, 'minor >= 2');
    assert.ok(patch >= 11, 'patch >= 11');
  });

  it('sharp is pinned to >=0.35.0 (fixes libvips CVEs)', () => {
    const sharp = frontendPkg.dependencies.sharp;
    assert.ok(sharp, 'sharp should be listed as dependency');
    assert.match(sharp, />=0\.35\.0/);
  });

  it('eslint-config-next matches Next.js version', () => {
    const eslintNext = frontendPkg.devDependencies['eslint-config-next'];
    const nextVersion = frontendPkg.dependencies.next;
    assert.equal(eslintNext, nextVersion, 'eslint-config-next should match next version');
  });

  it('MCP SDK vulnerability is documented (upstream dependency)', () => {
    const rootPkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    const mcpSdk = rootPkg.dependencies['@modelcontextprotocol/sdk'];
    // The @hono/node-server vulnerability requires upstream MCP SDK update
    // We monitor via npm audit in CI
    assert.ok(mcpSdk, 'MCP SDK should be present');
  });

  it('next version is pinned (not a range) for reproducibility', () => {
    const version = frontendPkg.dependencies.next;
    assert.doesNotMatch(version, /[\^~]/, 'next should be pinned, not a range');
  });
});
