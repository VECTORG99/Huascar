import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Inline PolicyEngine logic for testing without TypeScript compilation
class PolicyEngine {
  constructor(config) { this.config = config; this.log = []; }
  evaluate(role, toolName, args) {
    const argsHash = crypto.createHash('sha256').update(JSON.stringify(args)).digest('hex').slice(0, 16);
    for (const rule of this.config.rules) {
      if (rule.roles && rule.roles.length > 0 && !rule.roles.includes(role)) continue;
      let matches = false;
      if (rule.match.tool_pattern) {
        const p = rule.match.tool_pattern;
        matches = p.endsWith('*') ? toolName.startsWith(p.slice(0, -1)) : toolName === p;
      }
      if (rule.match.args_contains) {
        if (JSON.stringify(args).toLowerCase().includes(rule.match.args_contains.toLowerCase())) matches = true;
      }
      if (matches) {
        this.log.push({ role, tool: toolName, decision: rule.action, rule_id: rule.id });
        return { decision: rule.action, rule_id: rule.id, reason: rule.reason || null };
      }
    }
    this.log.push({ role, tool: toolName, decision: this.config.default_policy, rule_id: null });
    return { decision: this.config.default_policy, rule_id: null, reason: this.config.default_policy === 'deny' ? 'Default deny' : null };
  }
}

const testConfig = {
  default_policy: 'allow',
  rules: [
    { id: 'block-bash-reviewer', roles: ['PR_REVIEWER'], action: 'deny', match: { tool_pattern: 'execute_bash' }, reason: 'Reviewers cannot execute shell' },
    { id: 'block-destructive', roles: [], action: 'deny', match: { args_contains: 'rm -rf' }, reason: 'Destructive command blocked' },
    { id: 'allow-read', roles: [], action: 'allow', match: { tool_pattern: 'read_*' } },
  ]
};

describe('Policy Engine (issue #65)', () => {
  let engine;
  beforeEach(() => { engine = new PolicyEngine(testConfig); });

  it('allows tool when no rule matches (default allow)', () => {
    const result = engine.evaluate('SCAFFOLDER', 'git_status', {});
    assert.equal(result.decision, 'allow');
    assert.equal(result.rule_id, null);
  });

  it('denies bash for PR_REVIEWER role', () => {
    const result = engine.evaluate('PR_REVIEWER', 'execute_bash', { command: 'ls' });
    assert.equal(result.decision, 'deny');
    assert.equal(result.rule_id, 'block-bash-reviewer');
  });

  it('allows bash for SCAFFOLDER (rule only applies to PR_REVIEWER)', () => {
    const result = engine.evaluate('SCAFFOLDER', 'execute_bash', { command: 'npm test' });
    assert.equal(result.decision, 'allow');
  });

  it('denies destructive commands for any role', () => {
    const result = engine.evaluate('SCAFFOLDER', 'execute_bash', { command: 'rm -rf /' });
    assert.equal(result.decision, 'deny');
    assert.equal(result.rule_id, 'block-destructive');
  });

  it('glob pattern matches (read_*)', () => {
    const result = engine.evaluate('ANY', 'read_file', { path: '/foo' });
    assert.equal(result.decision, 'allow');
    assert.equal(result.rule_id, 'allow-read');
  });

  it('default deny mode blocks unmatched tools', () => {
    const strictEngine = new PolicyEngine({ default_policy: 'deny', rules: [
      { id: 'allow-read', roles: [], action: 'allow', match: { tool_pattern: 'read_file' } }
    ]});
    const r1 = strictEngine.evaluate('X', 'read_file', {});
    assert.equal(r1.decision, 'allow');
    const r2 = strictEngine.evaluate('X', 'write_file', {});
    assert.equal(r2.decision, 'deny');
  });

  it('audit log records all decisions', () => {
    engine.evaluate('A', 'tool1', {});
    engine.evaluate('B', 'tool2', {});
    assert.equal(engine.log.length, 2);
    assert.equal(engine.log[0].role, 'A');
    assert.equal(engine.log[1].role, 'B');
  });
});
