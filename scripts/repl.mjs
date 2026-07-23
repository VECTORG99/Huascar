#!/usr/bin/env node
/**
 * Huascar REPL — interactive shell for testing the engine without HTTP.
 *
 * Commands:
 *   .role <ROLE_NAME>  — set active role
 *   .task <text>       — set task text
 *   .execute           — run current task with current role
 *   .last              — show last execution result
 *   .history           — show execution history
 *   .help              — show available commands
 *   .exit              — quit REPL
 */
import readline from 'readline';

const BASE_URL = process.env.HUASCAR_URL || 'http://localhost:3001';

let currentRole = 'DEVELOPER';
let currentTask = '';
let lastResult = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'huascar> ',
});

function printHelp() {
  console.log(`
Huascar REPL — Interactive Engine Testing

Commands:
  .role <ROLE_NAME>    Set the active role (default: DEVELOPER)
  .task <text>         Set the task to execute
  .execute             Execute current task with current role
  .last                Show last execution result
  .history [n]         Show last N executions (default: 5)
  .health              Check backend health
  .tools               List available tools
  .help                Show this help
  .exit                Quit REPL

Example:
  huascar> .role PR_REVIEWER
  huascar> .task Review this code for security issues
  huascar> .execute
`);
}

async function fetchJson(path, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    return { status: res.status, data: await res.json() };
  } catch (err) {
    return { status: 0, data: { error: err.message } };
  }
}

async function executeTask() {
  if (!currentTask) {
    console.log('No task set. Use .task <text> first.');
    return;
  }
  console.log(`\n[Executing] Role: ${currentRole} | Task: ${currentTask}\n`);
  const start = Date.now();
  const { status, data } = await fetchJson('/api/agent/execute', {
    method: 'POST',
    body: JSON.stringify({ role: currentRole, task: currentTask }),
  });
  const duration = Date.now() - start;
  lastResult = { ...data, duration, httpStatus: status };
  console.log(`[${data.status || 'error'}] (${duration}ms)`);
  if (data.response) console.log(data.response);
  if (data.error) console.log(`Error: ${data.error}`);
  console.log('');
}

async function processCommand(line) {
  const trimmed = line.trim();
  if (!trimmed) return;

  if (trimmed.startsWith('.role ')) {
    currentRole = trimmed.slice(6).trim();
    console.log(`Role set to: ${currentRole}`);
  } else if (trimmed.startsWith('.task ')) {
    currentTask = trimmed.slice(6).trim();
    console.log(`Task set: ${currentTask}`);
  } else if (trimmed === '.execute') {
    await executeTask();
  } else if (trimmed === '.last') {
    if (lastResult) {
      console.log(JSON.stringify(lastResult, null, 2));
    } else {
      console.log('No previous execution.');
    }
  } else if (trimmed.startsWith('.history')) {
    const n = parseInt(trimmed.split(' ')[1]) || 5;
    const { data } = await fetchJson(`/api/history?limit=${n}`);
    if (Array.isArray(data)) {
      for (const entry of data) {
        console.log(`[${entry.created_at}] ${entry.role}: ${entry.task.slice(0, 60)}...`);
      }
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  } else if (trimmed === '.health') {
    const { data } = await fetchJson('/api/health');
    console.log(JSON.stringify(data, null, 2));
  } else if (trimmed === '.tools') {
    const { data } = await fetchJson('/api/tools');
    console.log(JSON.stringify(data, null, 2));
  } else if (trimmed === '.help') {
    printHelp();
  } else if (trimmed === '.exit' || trimmed === '.quit') {
    rl.close();
    process.exit(0);
  } else {
    // Treat non-command input as setting task + execute
    currentTask = trimmed;
    await executeTask();
  }
}

console.log(`Huascar REPL v1.0 — connected to ${BASE_URL}`);
console.log(`Current role: ${currentRole}`);
console.log('Type .help for commands\n');

rl.prompt();
rl.on('line', async (line) => {
  await processCommand(line);
  rl.prompt();
});
rl.on('close', () => process.exit(0));
