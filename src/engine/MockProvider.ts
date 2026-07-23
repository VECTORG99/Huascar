import { readFileSync } from 'fs';
import { config } from '../config.js';
import { agentHooks } from '../kiro/hooks.js';

type MockStep = {
  type: 'message' | 'tool_call' | 'final' | 'error';
  text?: string;
  tool?: string;
  args?: Record<string, unknown>;
  delay_ms?: number;
};

type MockScenario = { steps: MockStep[] };
type Hooks = Pick<typeof agentHooks, 'before_action'>;

const builtIns: Record<string, MockScenario> = {
  happy_path: { steps: [{ type: 'message', text: 'analyzed task' }, { type: 'final', text: 'completed' }] },
  multi_step: { steps: [{ type: 'message', text: 'planned' }, { type: 'message', text: 'checked tools' }, { type: 'final', text: 'completed after multiple steps' }] },
  blocked: { steps: [{ type: 'tool_call', tool: 'execute_bash', args: { command: 'rm -rf /tmp/huascar-mock' } }, { type: 'final', text: 'blocked action recorded' }] },
  timeout: { steps: [{ type: 'message', text: 'waiting', delay_ms: 10 }, { type: 'error', text: 'mock timeout' }] },
  error: { steps: [{ type: 'error', text: 'mock provider error' }] },
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function template(text: string | undefined, task: string, scenario: string): string {
  return (text ?? '').replaceAll('{{task}}', task).replaceAll('{{scenario}}', scenario);
}

function asScenario(value: unknown): MockScenario | null {
  if (!value || typeof value !== 'object') return null;
  const steps = (value as { steps?: unknown }).steps;
  return Array.isArray(steps) ? { steps: steps as MockStep[] } : null;
}

export function loadMockScenario(name = config.llm.mockScenario, readFile = (path: string, encoding: BufferEncoding) => readFileSync(path, encoding)): MockScenario {
  if (config.paths.mockScenarios) {
    const parsed: unknown = JSON.parse(readFile(config.paths.mockScenarios, config.rag.encoding));
    const custom = asScenario(parsed) ?? (parsed && typeof parsed === 'object' ? asScenario((parsed as Record<string, unknown>)[name]) : null);
    if (custom) return custom;
  }
  const scenario = builtIns[name] ?? builtIns.happy_path;
  if (!scenario) throw new Error('[MockProvider] built-in scenario "happy_path" is missing');
  return scenario;
}

export async function runMockScenario(options: {
  task: string;
  scenario?: string;
  hooks?: Hooks;
  readFile?: (path: string, encoding: BufferEncoding) => string;
}): Promise<string> {
  const scenarioName = options.scenario || config.llm.mockScenario;
  const scenario = loadMockScenario(scenarioName, options.readFile);
  const lines = [`[MOCK:${scenarioName}] task=${options.task}`];

  for (const step of scenario.steps) {
    if (step.delay_ms && step.delay_ms > 0) await sleep(step.delay_ms);
    if (step.type === 'message') lines.push(`step: ${template(step.text, options.task, scenarioName)}`);
    if (step.type === 'tool_call') {
      const tool = step.tool ?? 'mock_tool';
      const args = step.args ?? {};
      try {
        (options.hooks ?? agentHooks).before_action(tool, { ...args });
        lines.push(`tool_call: ${tool} ok`);
      } catch (err) {
        lines.push(`tool_call: ${tool} blocked: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (step.type === 'final') return [...lines, `final: ${template(step.text, options.task, scenarioName)}`].join('\n');
    if (step.type === 'error') throw new Error(`[MOCK:${scenarioName}] ${template(step.text, options.task, scenarioName)}`);
  }

  return [...lines, 'final: completed'].join('\n');
}
