import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const adrDir = path.resolve('docs/adr');
const requiredHeadings = [
  '## Status',
  '## Context',
  '## Decision',
  '## Alternatives Considered',
  '## Consequences',
  '## Revisit Conditions',
];

test('ADR markdown files contain required headings', async () => {
  const files = (await readdir(adrDir)).filter(file => file.endsWith('.md'));
  assert.ok(files.length >= 7, 'template plus at least 6 ADRs expected');

  for (const file of files) {
    const markdown = await readFile(path.join(adrDir, file), 'utf8');
    for (const heading of requiredHeadings) {
      assert.match(markdown, new RegExp(`^${heading}$`, 'm'), `${file} missing ${heading}`);
    }
  }
});
