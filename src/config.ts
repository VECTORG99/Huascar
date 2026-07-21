import 'dotenv/config';
import path from 'path';

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) || n < 0 ? fallback : n;
}

export const config = {
  paths: {
    steering: process.env.STEERING_CONFIG_PATH || path.resolve('./src/kiro/steering.json'),
    mcps: process.env.MCPS_CONFIG_PATH || path.resolve('./src/kiro/mcps.json'),
    rag: process.env.RAG_CONFIG_PATH || path.resolve('./src/kiro/rag.json'),
    db: process.env.HUASCAR_DB_PATH || path.resolve('./data/huascar.db'),
  },
  server: {
    port: envInt('PORT', 3001),
    host: process.env.HOST || '0.0.0.0',
  },
  react: {
    maxIterations: envInt('REACT_MAX_ITERATIONS', 3),
    toolResultMaxChars: envInt('TOOL_RESULT_MAX_CHARS', 8192),
    mcpTimeoutMs: envInt('MCP_TIMEOUT_MS', 30000),
  },
  rag: {
    maxContentChars: envInt('RAG_MAX_CONTENT_CHARS', 16000),
    encoding: (process.env.FILE_ENCODING || 'utf8') as BufferEncoding,
  },
  store: {
    historyLimit: envInt('HISTORY_LIMIT_DEFAULT', 20),
  },
  llm: {
    modelId: process.env.MODEL_ID || 'gpt-4o',
    mockMode: process.env.LLM_MOCK_MODE === 'true',
  },
  mcp: {
    stderr: (process.env.MCP_STDERR || 'ignore') as 'inherit' | 'pipe' | 'ignore',
  },
  hasApiKey: !!process.env.OPENAI_API_KEY,
};
