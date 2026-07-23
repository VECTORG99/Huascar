import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

// Simulate the security checks from RagEngine
const RAG_ALLOWED_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.yaml', '.yml', '.toml',
  '.ts', '.js', '.mjs', '.cjs', '.tsx', '.jsx',
  '.py', '.go', '.rs', '.java', '.rb', '.sh',
  '.css', '.html', '.xml', '.csv', '.sql',
  '.dockerfile', '.tf', '.hcl',
]);

const RAG_BLOCKED_PATTERNS = [
  /\.env(\.|$)/i, /\.pem$/i, /\.key$/i, /\.p12$/i, /\.pfx$/i,
  /id_rsa/i, /\.db$/i, /\.sqlite$/i, /credentials/i,
  /secrets?\./i, /\.npmrc$/i, /\.netrc$/i,
  /\.git\//, /node_modules\//,  /package-lock\.json$/i,
];

function isFileAllowed(filePath) {
  const basename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (basename.startsWith('.') && !RAG_ALLOWED_EXTENSIONS.has(ext)) return false;
  for (const pattern of RAG_BLOCKED_PATTERNS) {
    if (pattern.test(filePath) || pattern.test(basename)) return false;
  }
  if (!RAG_ALLOWED_EXTENSIONS.has(ext) && ext !== '') return false;
  return true;
}

describe('RAG File Security (issue #2)', () => {
  it('allows .md files', () => assert.equal(isFileAllowed('docs/README.md'), true));
  it('allows .ts files', () => assert.equal(isFileAllowed('src/server.ts'), true));
  it('allows .json files', () => assert.equal(isFileAllowed('config.json'), true));
  it('allows .py files', () => assert.equal(isFileAllowed('scripts/deploy.py'), true));

  it('blocks .env files', () => assert.equal(isFileAllowed('.env'), false));
  it('blocks .env.local', () => assert.equal(isFileAllowed('.env.local'), false));
  it('blocks .env.production', () => assert.equal(isFileAllowed('.env.production'), false));
  it('blocks .pem files', () => assert.equal(isFileAllowed('certs/server.pem'), false));
  it('blocks .key files', () => assert.equal(isFileAllowed('ssl/private.key'), false));
  it('blocks id_rsa', () => assert.equal(isFileAllowed('.ssh/id_rsa'), false));
  it('blocks .db files', () => assert.equal(isFileAllowed('data/huascar.db'), false));
  it('blocks .sqlite files', () => assert.equal(isFileAllowed('app.sqlite'), false));
  it('blocks credentials files', () => assert.equal(isFileAllowed('credentials.json'), false));
  it('blocks secrets.yml', () => assert.equal(isFileAllowed('secrets.yml'), false));
  it('blocks .npmrc', () => assert.equal(isFileAllowed('.npmrc'), false));
  it('blocks node_modules paths', () => assert.equal(isFileAllowed('node_modules/pkg/index.js'), false));
  it('blocks package-lock.json', () => assert.equal(isFileAllowed('package-lock.json'), false));
  it('blocks .git/ paths', () => assert.equal(isFileAllowed('.git/config'), false));
  it('blocks binary files (.exe)', () => assert.equal(isFileAllowed('app.exe'), false));
  it('blocks .p12 certs', () => assert.equal(isFileAllowed('cert.p12'), false));
});
