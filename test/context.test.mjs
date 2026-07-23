import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

const context = fs.readFileSync('CONTEXT.md', 'utf8');

describe('CONTEXT.md', () => {
  it('has required machine-readable sections and current year marker', () => {
    for (const heading of [
      'State',
      'What Works',
      'Known Limitations',
      'Constraints',
      'Module Dependency Graph',
      'Critical Paths',
      'Do Not Touch / High-Risk Zones',
      'Non-Goals',
      'How To Update This Document',
    ]) {
      assert.match(context, new RegExp(`^## ${heading.replace(/[/-]/g, '\\$&')}$`, 'm'));
    }
    assert.match(context, /^Updated: 2026-/m);
  });
});
