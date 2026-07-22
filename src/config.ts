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
    topK: envInt('EMBEDDING_TOP_K', 5),
  },
  store: {
    historyLimit: envInt('HISTORY_LIMIT_DEFAULT', 20),
  },
  llm: {
    modelId: process.env.MODEL_ID || 'gpt-4o',
    mockMode: process.env.LLM_MOCK_MODE === 'true',
  },
  mcp: {
    stderr: envStderr('MCP_STDERR', 'ignore'),
  },
  hasApiKey: !!process.env.OPENAI_API_KEY,
};
