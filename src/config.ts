import 'dotenv/config';
import path from 'path';

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) || n < 0 ? fallback : n;
}

const VALID_ENCODINGS = ['ascii', 'utf8', 'utf-8', 'utf16le', 'ucs2', 'ucs-2', 'base64', 'base64url', 'latin1', 'binary', 'hex'];
function envEncoding(key: string, fallback: BufferEncoding): BufferEncoding {
  const v = process.env[key];
  if (!v) return fallback;
  return (VALID_ENCODINGS.includes(v) ? v : fallback) as BufferEncoding;
}

const VALID_STDERR: ReadonlyArray<'inherit' | 'pipe' | 'ignore'> = ['inherit', 'pipe', 'ignore'];
function envStderr(key: string, fallback: 'inherit' | 'pipe' | 'ignore'): 'inherit' | 'pipe' | 'ignore' {
  const v = process.env[key];
  return v && VALID_STDERR.includes(v as 'inherit' | 'pipe' | 'ignore') ? (v as 'inherit' | 'pipe' | 'ignore') : fallback;
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
    requestTimeoutMs: envInt('REQUEST_TIMEOUT_MS', 120000),
  },
  react: {
    maxIterations: envInt('REACT_MAX_ITERATIONS', 3),
    toolResultMaxChars: envInt('TOOL_RESULT_MAX_CHARS', 8192),
    mcpTimeoutMs: envInt('MCP_TIMEOUT_MS', 30000),
  },
  rag: {
    maxContentChars: envInt('RAG_MAX_CONTENT_CHARS', 16000),
    encoding: envEncoding('FILE_ENCODING', 'utf8'),
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    chunkSize: envInt('EMBEDDING_CHUNK_SIZE', 500),
    chunkOverlapChars: envInt('RAG_CHUNK_OVERLAP_CHARS', 100),
    topK: envInt('EMBEDDING_TOP_K', 5),
    embeddingRetryAttempts: envInt('EMBEDDING_RETRY_ATTEMPTS', 2),
  },
  store: {
    historyLimit: envInt('HISTORY_LIMIT_DEFAULT', 20),
  },
  sessions: {
    ttlMs: envInt('SESSION_TTL_MS', 60 * 60 * 1000),
    maxMessages: envInt('SESSION_MAX_MESSAGES', 10),
  },
  llm: {
    providerChain: process.env.LLM_PROVIDER_CHAIN || 'openai',
    modelId: process.env.MODEL_ID || 'gpt-4o',
    openaiModel: process.env.OPENAI_MODEL || process.env.MODEL_ID || 'gpt-4o',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
    localModel: process.env.LOCAL_MODEL || 'gpt-oss:20b',
    localBaseUrl: process.env.LOCAL_BASE_URL || 'http://localhost:11434/v1',
    localApiKey: process.env.LOCAL_API_KEY || 'local',
    mockMode: process.env.LLM_MOCK_MODE === 'true',
    retryMax: envInt('LLM_RETRY_MAX', 3),
    retryDelayMs: envInt('LLM_RETRY_DELAY_MS', 1000),
    retryMaxDelayMs: envInt('LLM_RETRY_MAX_DELAY_MS', 30000),
  },
  mcp: {
    stderr: envStderr('MCP_STDERR', 'ignore'),
  },
  hasLlmProvider: !!(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.LOCAL_BASE_URL
  ),
  hasEmbeddingApiKey: !!process.env.OPENAI_API_KEY,
};
