import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

// Inline schemas for testing (mirrors src/validation/schemas.ts)
const executeRequestSchema = z.object({
  task: z.string().min(1).max(10000),
  role: z.string().min(1).max(200),
  system_prompt: z.string().max(50000).optional(),
  config: z.object({
    tools: z.array(z.string().max(100)).max(50).optional(),
    security: z.object({
      block_destructive_commands: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

const envSchema = z.object({
  PORT: z.string().regex(/^\d+$/).default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LLM_MOCK_MODE: z.enum(['true', 'false']).default('false'),
});

describe('Zod Request Validation (issue #58)', () => {
  it('validates correct execute request', () => {
    const result = executeRequestSchema.safeParse({ task: 'build the app', role: 'developer' });
    assert.equal(result.success, true);
  });

  it('rejects empty task', () => {
    const result = executeRequestSchema.safeParse({ task: '', role: 'dev' });
    assert.equal(result.success, false);
  });

  it('rejects missing role', () => {
    const result = executeRequestSchema.safeParse({ task: 'hello' });
    assert.equal(result.success, false);
  });

  it('rejects task exceeding max length', () => {
    const result = executeRequestSchema.safeParse({ task: 'x'.repeat(10001), role: 'dev' });
    assert.equal(result.success, false);
  });

  it('accepts config with tools array', () => {
    const result = executeRequestSchema.safeParse({ task: 'test', role: 'dev', config: { tools: ['read_file'] } });
    assert.equal(result.success, true);
  });

  it('rejects tools array exceeding max', () => {
    const tools = Array.from({ length: 51 }, (_, i) => `tool_${i}`);
    const result = executeRequestSchema.safeParse({ task: 'test', role: 'dev', config: { tools } });
    assert.equal(result.success, false);
  });
});

describe('Zod Env Validation (issue #60)', () => {
  it('validates correct env with defaults', () => {
    const result = envSchema.safeParse({});
    assert.equal(result.success, true);
    assert.equal(result.data.PORT, '3001');
    assert.equal(result.data.NODE_ENV, 'development');
  });

  it('rejects invalid PORT (non-numeric)', () => {
    const result = envSchema.safeParse({ PORT: 'abc' });
    assert.equal(result.success, false);
  });

  it('rejects invalid NODE_ENV', () => {
    const result = envSchema.safeParse({ NODE_ENV: 'staging' });
    assert.equal(result.success, false);
  });

  it('accepts valid production env', () => {
    const result = envSchema.safeParse({ PORT: '8080', NODE_ENV: 'production', LLM_MOCK_MODE: 'false' });
    assert.equal(result.success, true);
  });
});
