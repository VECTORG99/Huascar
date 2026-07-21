import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = 'http://localhost:3002';
let passed = 0;
let failed = 0;

async function assertJson(method, path, body, expectedStatus, expectedKey) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  const ok = res.status === expectedStatus && data[expectedKey] !== undefined;
  const label = `${method} ${path} -> ${res.status} ${ok ? 'PASS' : 'FAIL'}`;
  console.log(label);
  if (ok) passed++; else { failed++; console.log('  expected:', expectedStatus, 'got:', res.status, JSON.stringify(data).slice(0, 100)); }
  if (!ok) throw new Error(`Test failed: ${method} ${path}`);
}

console.log('=== Huascar API Integration Tests ===\n');

const proc = spawn('npx', ['tsx', 'src/server.ts'], {
  env: { ...process.env, PORT: '3002', HUASCAR_DB_PATH: '/tmp/huascar_test.db' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
proc.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
proc.stderr.on('data', d => process.stderr.write(`[server:err] ${d}`));

for (let i = 0; i < 30; i++) {
  try {
    const r = await fetch(`${BASE}/api/health`);
    if (r.ok) break;
  } catch {}
  await sleep(500);
}

try {
  await assertJson('GET', '/api/health', null, 200, 'status');
  await assertJson('POST', '/api/agent/execute', {}, 400, 'error');
  await assertJson('POST', '/api/agent/execute', { task: 'Revisa el codigo', role: 'PR_REVIEWER' }, 200, 'response');
  await assertJson('GET', '/api/history', null, 200, 'history');

  const res = await fetch(`${BASE}/api/history?limit=5`);
  const history = await res.json();
  const ok = res.status === 200 && Array.isArray(history.history);
  console.log(`GET /api/history?limit=5 -> ${res.status} ${ok ? 'PASS' : 'FAIL'}`);
  if (ok) passed++; else failed++;

  await assertJson('POST', '/api/agent/execute', { task: 'test', role: 'NONEXISTENT' }, 500, 'error');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
} catch (e) {
  console.error('\nTest error:', e.message);
  failed++;
} finally {
  proc.kill();
  process.exit(failed > 0 ? 1 : 0);
}
