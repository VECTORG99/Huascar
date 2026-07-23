import { z } from 'zod';

// --- Request Schemas ---

export const executeRequestSchema = z.object({
  task: z.string().min(1).max(10000),
  role: z.string().min(1).max(200),
  system_prompt: z.string().max(50000).optional(),
  config: z.object({
    tools: z.array(z.string().max(100)).max(50).optional(),
    knowledge: z.array(z.object({
      type: z.enum(['local_file', 'local_directory', 'web_url', 'inline']),
      path: z.string().max(500).optional(),
      url: z.string().url().max(2000).optional(),
      pattern: z.string().max(50).optional(),
      content: z.string().max(100000).optional(),
    })).max(20).optional(),
    security: z.object({
      block_destructive_commands: z.boolean().optional(),
      require_commit_approval: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

export const creatorEvaluateSchema = z.object({
  workflowVersion: z.string().optional(),
  catalogVersion: z.string().optional(),
  answers: z.record(z.unknown()),
});

export const commitApprovalSchema = z.object({
  diffContext: z.string().max(100000).optional(),
});

export const approvalDecisionSchema = z.object({
  approved: z.boolean(),
});

// --- Environment Schema ---

export const envSchema = z.object({
  PORT: z.string().regex(/^\d+$/).default('3001'),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  OPENAI_API_KEY: z.string().optional(),
  MODEL_ID: z.string().default('gpt-4o'),
  LLM_MOCK_MODE: z.enum(['true', 'false']).default('false'),
  REACT_MAX_ITERATIONS: z.string().regex(/^\d+$/).default('3'),
  MCP_TIMEOUT_MS: z.string().regex(/^\d+$/).default('30000'),
  RAG_MAX_CONTENT_CHARS: z.string().regex(/^\d+$/).default('16000'),
  HUASCAR_DB_PATH: z.string().default('./data/huascar.db'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
  BYPASS_SECRET: z.string().optional(),
  AUTH_REQUIRED: z.enum(['true', 'false']).default('false'),
  HUASCAR_API_KEYS: z.string().optional(),
  METRICS_SECRET: z.string().optional(),
  RATE_LIMIT_GLOBAL: z.string().regex(/^\d+$/).default('100'),
  RATE_LIMIT_EXECUTE: z.string().regex(/^\d+$/).default('5'),
  RATE_LIMIT_CREATOR: z.string().regex(/^\d+$/).default('30'),
  MCP_ALLOWED_ENV_VARS: z.string().optional(),
  RAG_ROOT: z.string().optional(),
  SECURITY_POLICY_PATH: z.string().default('./src/kiro/security-policy.json'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup.
 * Returns validated config or throws with detailed error messages.
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`[CONFIG] Environment validation failed:\n${issues}`);
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
