import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

const contributing = fs.readFileSync('CONTRIBUTING.md', 'utf8');
const rag = JSON.parse(fs.readFileSync('src/kiro/rag.json', 'utf8'));

describe('CONTRIBUTING.md', () => {
  it('has required AI contributor sections and checkboxes', () => {
    for (const heading of ['Quick Reference', 'PR Quality Gate', 'Architecture Rules / Constraints', 'How To Test Changes', 'Recipes']) {
      assert.match(contributing, new RegExp(`^## ${heading.replace(/[/-]/g, '\\$&')}$`, 'm'));
    }

    assert.ok((contributing.match(/^\| .* \| .* \| .* \| .* \|$/gm) ?? []).length > 10);
    assert.ok((contributing.match(/^- \[ \] /gm) ?? []).length >= 10);
  });

  it('is included in RAG sources', () => {
    assert.ok(rag.knowledge_bases.some((source) => source.type === 'local_file' && source.path === './CONTRIBUTING.md'));
  });
});
