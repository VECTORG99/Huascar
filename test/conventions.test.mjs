import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

const conventions = fs.readFileSync('docs/CONVENTIONS.md', 'utf8');

describe('docs/CONVENTIONS.md', () => {
  it('has required coding standard sections', () => {
    for (const heading of [
      'Files / module structure',
      'TypeScript patterns',
      'Error handling',
      'Testing',
      'API routes',
      'Git / PR conventions',
    ]) {
      assert.match(conventions, new RegExp(`^## ${heading.replace(/[/-]/g, '\\$&')}$`, 'm'));
    }
  });
});
