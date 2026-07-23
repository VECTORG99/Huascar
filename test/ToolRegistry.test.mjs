import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ToolRegistry } from '../src/engine/ToolRegistry.ts';

describe('ToolRegistry (#53)', () => {
  it('registers and retrieves server tools', () => {
    const registry = new ToolRegistry();
    registry.registerServer('github', [
      { name: 'create_pr', description: 'Create pull request' },
      { name: 'list_issues', description: 'List issues' },
    ]);
    const tools = registry.getAllTools();
    assert.equal(tools.length, 2);
    assert.equal(tools[0].serverName, 'github');
  });

  it('unregisters server', () => {
    const registry = new ToolRegistry();
    registry.registerServer('github', [{ name: 'create_pr' }]);
    registry.unregisterServer('github');
    assert.equal(registry.getAllTools().length, 0);
  });

  it('filters tools by allowed list', () => {
    const registry = new ToolRegistry();
    registry.registerServer('github', [
      { name: 'create_pr' },
      { name: 'list_issues' },
    ]);
    registry.registerServer('bash', [
      { name: 'execute_bash' },
    ]);

    const filtered = registry.getToolsForRole({ allowed: ['create_pr', 'list_issues'] });
    assert.equal(filtered.length, 2);
    assert.ok(filtered.every((t) => t.serverName === 'github'));
  });

  it('filters tools by blocked list', () => {
    const registry = new ToolRegistry();
    registry.registerServer('github', [{ name: 'create_pr' }]);
    registry.registerServer('bash', [{ name: 'execute_bash' }]);

    const filtered = registry.getToolsForRole({ blocked: ['execute_bash'] });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].name, 'create_pr');
  });

  it('supports wildcard server patterns', () => {
    const registry = new ToolRegistry();
    registry.registerServer('github', [
      { name: 'create_pr' },
      { name: 'list_issues' },
    ]);
    registry.registerServer('bash', [{ name: 'execute_bash' }]);

    const filtered = registry.getToolsForRole({ allowed: ['github.*'] });
    assert.equal(filtered.length, 2);
  });

  it('tracks health status', () => {
    const registry = new ToolRegistry();
    registry.registerServer('github', [{ name: 'create_pr' }]);
    assert.equal(registry.getHealthStatus()[0].status, 'healthy');

    registry.markUnhealthy('github', 'connection refused');
    assert.equal(registry.getHealthStatus()[0].status, 'unhealthy');
    assert.equal(registry.getHealthStatus()[0].lastError, 'connection refused');

    registry.markHealthy('github');
    assert.equal(registry.getHealthStatus()[0].status, 'healthy');
  });

  it('reports stats', () => {
    const registry = new ToolRegistry();
    registry.registerServer('a', [{ name: 't1' }, { name: 't2' }]);
    registry.registerServer('b', [{ name: 't3' }]);
    const stats = registry.stats;
    assert.equal(stats.servers, 2);
    assert.equal(stats.totalTools, 3);
    assert.equal(stats.healthyServers, 2);
  });

  it('returns all tools without filter', () => {
    const registry = new ToolRegistry();
    registry.registerServer('s1', [{ name: 'tool_a' }]);
    const tools = registry.getToolsForRole();
    assert.equal(tools.length, 1);
  });
});
