#!/usr/bin/env node
/**
 * Huascar Eval Runner — executes evaluation suites against the engine.
 *
 * Usage:
 *   npm run eval                    — run all suites
 *   npm run eval -- --suite basic_qa  — run specific suite
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EvalRunner } from '../src/eval/EvalRunner.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUITES_DIR = path.resolve(__dirname, '../eval/suites');
const REPORTS_DIR = path.resolve(__dirname, '../eval/reports');

const BASE_URL = process.env.HUASCAR_URL || 'http://localhost:3001';

// Parse CLI args
const args = process.argv.slice(2);
const suiteFilter = args.includes('--suite') ? args[args.indexOf('--suite') + 1] : null;

async function executeFn(task, role) {
  try {
    const res = await fetch(`${BASE_URL}/api/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, role }),
    });
    const data = await res.json();
    return { status: data.status || 'error', response: data.response, error: data.error };
  } catch (err) {
    return { status: 'blocked', error: err.message };
  }
}

async function main() {
  const runner = new EvalRunner(executeFn);

  // Load suites
  const suiteFiles = fs.readdirSync(SUITES_DIR).filter((f) => f.endsWith('.json'));
  const suites = suiteFiles
    .map((f) => JSON.parse(fs.readFileSync(path.join(SUITES_DIR, f), 'utf-8')))
    .filter((s) => !suiteFilter || s.id === suiteFilter);

  if (suites.length === 0) {
    console.log(`No suites found${suiteFilter ? ` matching "${suiteFilter}"` : ''}`);
    process.exit(1);
  }

  console.log(`\nHuascar Eval Runner`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Suites: ${suites.length}\n`);

  const allReports = [];

  for (const suite of suites) {
    console.log(`Running: ${suite.name} (${suite.cases.length} cases)`);
    const report = await runner.runSuite(suite);
    allReports.push(report);

    console.log(
      `  ✓ ${report.summary.passed}/${report.summary.total} passed (${(report.summary.passRate * 100).toFixed(0)}%)`,
    );
    console.log(`  ⏱ Avg latency: ${report.summary.avgLatencyMs.toFixed(0)}ms`);
    if (report.summary.failed > 0) {
      for (const r of report.results.filter((r) => !r.passed)) {
        console.log(`  ✗ ${r.caseId}: ${r.errors.join(', ')}`);
      }
    }
    console.log('');
  }

  // Save report
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(allReports, null, 2));
  console.log(`Report saved: ${reportPath}`);

  // Exit with failure if any suite failed
  const anyFailed = allReports.some((r) => r.summary.failed > 0);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error('Eval failed:', err.message);
  process.exit(1);
});
