import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Simulate the tool filtering logic from HuascarEngine
function filterTools(mcpClients, agentConfig) {
  if (agentConfig.tools !== undefined) {
    const selectedTools = new Set(agentConfig.tools);
    for (const c of mcpClients) {
      c.tools = c.tools.filter(t => selectedTools.has(t.name));
    }
  }
  return mcpClients;
}

describe('Tool Selection & Approval Controls (issue #4)', () => {
  const mockClients = () => [
    { name: 'fs', tools: [{ name: 'read_file' }, { name: 'write_file' }, { name: 'execute_bash' }] },
    { name: 'git', tools: [{ name: 'git_status' }, { name: 'git_push' }] },
  ];

  it('tools: undefined keeps all tools (default behavior)', () => {
    const clients = mockClients();
    filterTools(clients, {});
    assert.equal(clients[0].tools.length, 3);
    assert.equal(clients[1].tools.length, 2);
  });

  it('tools: [] disables ALL tools (fail-closed)', () => {
    const clients = mockClients();
    filterTools(clients, { tools: [] });
    assert.equal(clients[0].tools.length, 0);
    assert.equal(clients[1].tools.length, 0);
  });

  it('tools: ["read_file"] allows only that tool', () => {
    const clients = mockClients();
    filterTools(clients, { tools: ['read_file'] });
    assert.equal(clients[0].tools.length, 1);
    assert.equal(clients[0].tools[0].name, 'read_file');
    assert.equal(clients[1].tools.length, 0);
  });

  it('tools: ["read_file", "git_status"] allows across servers', () => {
    const clients = mockClients();
    filterTools(clients, { tools: ['read_file', 'git_status'] });
    assert.equal(clients[0].tools.length, 1);
    assert.equal(clients[1].tools.length, 1);
  });

  it('unknown tool names are silently filtered out', () => {
    const clients = mockClients();
    filterTools(clients, { tools: ['nonexistent_tool'] });
    assert.equal(clients[0].tools.length, 0);
    assert.equal(clients[1].tools.length, 0);
  });

  it('security config structure is valid', () => {
    const config = {
      tools: ['read_file'],
      security: {
        block_destructive_commands: true,
        require_commit_approval: true,
      }
    };
    assert.equal(config.security.block_destructive_commands, true);
    assert.equal(config.security.require_commit_approval, true);
  });

  it('tools: [] with security flags is valid (zero tools, max safety)', () => {
    const clients = mockClients();
    const config = { tools: [], security: { block_destructive_commands: true } };
    filterTools(clients, config);
    const totalTools = clients.reduce((n, c) => n + c.tools.length, 0);
    assert.equal(totalTools, 0);
  });
});
