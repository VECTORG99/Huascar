import { describe, it, before } from 'node:test';
import assert from 'node:assert';

describe('HuascarEngine', () => {
  let HuascarEngine;
  let buildAiTools;

  before(async () => {
    process.env.LLM_MOCK_MODE = 'true';
    // Unset API key to force mock mode
    delete process.env.OPENAI_API_KEY;
    const mod = await import('../src/engine/HuascarEngine.js');
    HuascarEngine = mod.HuascarEngine;
    buildAiTools = mod.buildAiTools;
  });

  it('resolves role on executeTask', async () => {
    const engine = new HuascarEngine('PR_REVIEWER');
    await engine.executeTask('test');
    assert.ok(engine.activeRole);
    assert.strictEqual(engine.activeRole.name, 'Senior Code Reviewer');
  });

  it('accepts custom role with systemPrompt', async () => {
    const engine = new HuascarEngine('CUSTOM_ROLE');
    const result = await engine.executeTask('test', 'custom system prompt');
    assert.strictEqual(result.status, 'success');
  });

  it('throws for non-existent role without systemPrompt', async () => {
    const engine = new HuascarEngine('NONEXISTENT_ROLE');
    await assert.rejects(
      () => engine.executeTask('test'),
      /no existe en steering/
    );
  });

  it('runs mock mode without API key', async () => {
    const engine = new HuascarEngine('PR_REVIEWER');
    const result = await engine.executeTask('test task');
    assert.strictEqual(result.status, 'success');
    assert.ok(result.response.includes('SIMULADO'));
    assert.strictEqual(result.agent_role, 'Senior Code Reviewer');
  });

  it('returns blocked status on error', async () => {
    const engine = new HuascarEngine('PR_REVIEWER');
    const result = await engine.executeTask('test');
    assert.ok(result.status === 'success' || result.status === 'blocked');
    assert.ok(result.agent_role || result.error);
  });

  it('prefers explicit systemPrompt for existing roles', async () => {
    const { config } = await import('../src/config.js');
    const previousMock = config.llm.mockMode;
    const previousHasApiKey = config.hasApiKey;
    config.llm.mockMode = false;
    config.hasApiKey = true;

    const engine = new HuascarEngine('PR_REVIEWER');
    engine.connectMcpServers = async () => {};
    engine.loadRagSources = async () => {};
    engine.rag.getContext = async () => '';
    let capturedPrompt = '';
    engine.runReActLoop = async (systemPrompt) => {
      capturedPrompt = systemPrompt;
      return 'ok';
    };

    const result = await engine.executeTask('test', 'explicit prompt');
    assert.strictEqual(result.status, 'success');
    assert.strictEqual(capturedPrompt, 'explicit prompt');

    config.llm.mockMode = previousMock;
    config.hasApiKey = previousHasApiKey;
  });

  it('builds structured AI tools that call hooks and MCP with object args', async () => {
    const calls = [];
    const aiTools = buildAiTools([
      {
        name: 'server',
        client: {
          callTool: async call => {
            calls.push(call);
            return { content: [{ type: 'text', text: 'ok' }] };
          },
        },
        transport: {},
        tools: [{ name: 'search', description: 'Search', inputSchema: { type: 'object' } }],
      },
    ], { before_action: (name, args) => calls.push({ hook: name, args }) });

    const args = { query: 'no USE_TOOL text' };
    const result = await aiTools.search.execute(args, {});

    assert.strictEqual(result, 'ok');
    assert.deepStrictEqual(calls, [
      { hook: 'search', args },
      { name: 'search', arguments: args },
    ]);
  });

});
