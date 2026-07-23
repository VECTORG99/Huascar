import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

const agents = fs.readFileSync('AGENTS.md', 'utf8');

describe('AGENTS.md', () => {
  it('has required AI agent directive sections', () => {
    for (const heading of [
      'Required Reading Order',
      'Project Context',
      'Code Conventions Summary',
      'AI Workflow',
      'Testing Commands',
      'Environment Variables',
      'Useful Commands',
      'Rules',
    ]) {
      assert.match(agents, new RegExp(`^## ${heading.replace(/[/-]/g, '\\$&')}$`, 'm'));
    }
  });

  it('points agents at fuller docs instead of duplicating them', () => {
    for (const path of ['CONTEXT.md', 'docs/CONVENTIONS.md', 'CONTRIBUTING.md', 'docs/adr/*.md']) {
      assert.match(agents, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
});
