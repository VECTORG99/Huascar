import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { config } from '../src/config.js';
import { ConfigCache } from '../src/engine/ConfigCache.js';

describe('ConfigCache', () => {
  let originalSteering;
  let originalRag;
  let tmpDir;

  beforeEach(() => {
    ConfigCache.reset();
    originalSteering = config.paths.steering;
    originalRag = config.paths.rag;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-cache-'));
  });

  it('caches steering.json across multiple calls (no custom readFile)', () => {
    const steeringPath = path.join(tmpDir, 'steering.json');
    fs.writeFileSync(steeringPath, JSON.stringify({ roles: { TEST: { name: 'Test', system_prompt: 'hello', temperature: 0.5 } } }));
    config.paths.steering = steeringPath;

    try {
      const cache = ConfigCache.getInstance();
      const first = cache.getSteering();
      const second = cache.getSteering();

      assert.deepStrictEqual(first, second);
      // Same reference means it's cached
      assert.strictEqual(first, second);
    } finally {
      config.paths.steering = originalSteering;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('bypasses cache when custom readFile is provided', () => {
    const steeringPath = path.join(tmpDir, 'steering.json');
    fs.writeFileSync(steeringPath, JSON.stringify({ roles: {} }));
    config.paths.steering = steeringPath;

    try {
      const customData = JSON.stringify({ roles: { CUSTOM: { name: 'Custom', system_prompt: 'hi', temperature: 0 } } });
      const readFile = () => customData;

      const cache = ConfigCache.getInstance();
      const result = cache.getSteering(readFile);
      assert.deepStrictEqual(result, { roles: { CUSTOM: { name: 'Custom', system_prompt: 'hi', temperature: 0 } } });
    } finally {
      config.paths.steering = originalSteering;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('re-reads if file mtime changes', () => {
    const steeringPath = path.join(tmpDir, 'steering.json');
    fs.writeFileSync(steeringPath, JSON.stringify({ roles: { A: { name: 'A', system_prompt: 'v1', temperature: 0 } } }));
    config.paths.steering = steeringPath;

    try {
      const cache = ConfigCache.getInstance();
      const v1 = cache.getSteering();

      // Simulate file modification (advance mtime)
      const future = new Date(Date.now() + 2000);
      fs.utimesSync(steeringPath, future, future);
      fs.writeFileSync(steeringPath, JSON.stringify({ roles: { B: { name: 'B', system_prompt: 'v2', temperature: 0 } } }));

      const v2 = cache.getSteering();
      assert.notDeepStrictEqual(v1, v2);
    } finally {
      config.paths.steering = originalSteering;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns null for missing rag.json', () => {
    config.paths.rag = path.join(tmpDir, 'nonexistent.json');

    try {
      const cache = ConfigCache.getInstance();
      const result = cache.getRag();
      assert.strictEqual(result, null);
    } finally {
      config.paths.rag = originalRag;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('caches rag.json when present (no custom readFile)', () => {
    const ragPath = path.join(tmpDir, 'rag.json');
    fs.writeFileSync(ragPath, JSON.stringify({ knowledge_bases: [{ type: 'file', path: '/tmp/f.md' }] }));
    config.paths.rag = ragPath;

    try {
      const cache = ConfigCache.getInstance();
      const first = cache.getRag();
      const second = cache.getRag();
      assert.strictEqual(first, second);
    } finally {
      config.paths.rag = originalRag;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('invalidate forces re-read', () => {
    const steeringPath = path.join(tmpDir, 'steering.json');
    fs.writeFileSync(steeringPath, JSON.stringify({ roles: {} }));
    config.paths.steering = steeringPath;

    try {
      const cache = ConfigCache.getInstance();
      const first = cache.getSteering();
      cache.invalidate();
      const second = cache.getSteering();
      // After invalidate + re-read, we get a fresh parse (different reference)
      assert.notStrictEqual(first, second);
      assert.deepStrictEqual(first, second);
    } finally {
      config.paths.steering = originalSteering;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
