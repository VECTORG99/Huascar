import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { URL } from 'url';
import { config } from '../config.js';
import { Store } from './Store.js';
import { VectorIndex } from './VectorIndex.js';
import { logger } from '../logger.js';
import { ErrorCodes, RagError } from '../errors.js';

// SSRF prevention: block private/reserved IPs and dangerous hosts
const BLOCKED_HOSTS = [
  'localhost', '127.0.0.1', '::1', '0.0.0.0',
  '::ffff:127.0.0.1', '::ffff:0.0.0.0',
  '169.254.169.254', 'metadata.google.internal',
  '::ffff:a9fe:a9fe',
  'metadata.internal', 'kubernetes.default.svc',
];

/**
 * Check if an IP address is in a private/reserved range.
 * Covers: loopback, private (RFC1918), link-local, multicast, cloud metadata.
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 checks
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => p >= 0 && p <= 255)) {
    const [p0 = -1, p1 = -1] = parts;
    if (p0 === 127) return true;                          // 127.0.0.0/8 loopback
    if (p0 === 10) return true;                           // 10.0.0.0/8 private
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true; // 172.16.0.0/12
    if (p0 === 192 && p1 === 168) return true;     // 192.168.0.0/16
    if (p0 === 169 && p1 === 254) return true;     // 169.254.0.0/16 link-local
    if (p0 === 0) return true;                            // 0.0.0.0/8
    if (p0 >= 224) return true;                           // 224.0.0.0+ multicast/reserved
  }
  // IPv6 checks
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }
  // IPv4-mapped IPv6
  if (ip.startsWith('::ffff:')) {
    const mapped = ip.slice(7);
    return isPrivateIp(mapped);
  }
  return false;
}

/** Maximum bytes to download from a remote URL */
const MAX_DOWNLOAD_BYTES = 512 * 1024; // 512KB

function isBlockedUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    if (BLOCKED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) return true;
    if (isPrivateIp(parsed.hostname)) return true;
    // Block numeric IPs that could be private (octal, hex, decimal encodings)
    if (/^\d+$/.test(parsed.hostname)) return true; // decimal-encoded IP
    if (/^0x/i.test(parsed.hostname)) return true;  // hex-encoded IP
    return false;
  } catch {
    return true;
  }
}

/**
 * Stream-read a response body with a hard byte limit.
 * Prevents memory bombs from servers that omit Content-Length.
 */
async function readBounded(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let result = '';
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        logger.warn(`[RagEngine] Download exceeded ${maxBytes} bytes, truncating`);
        result += decoder.decode(value.slice(0, maxBytes - (totalBytes - value.byteLength)), { stream: false });
        break;
      }
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return result;
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type RagSource =
  | { type: 'local_file'; path: string }
  | { type: 'local_directory'; path: string; pattern: string }
  | { type: 'inline'; content: string }
  | { type: 'web_url'; url: string };

const RAG_ROOT = path.resolve(process.env.RAG_ROOT || '.');

// Allowed file extensions for RAG ingestion
const RAG_ALLOWED_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.yaml', '.yml', '.toml',
  '.ts', '.js', '.mjs', '.cjs', '.tsx', '.jsx',
  '.py', '.go', '.rs', '.java', '.rb', '.sh',
  '.css', '.html', '.xml', '.csv', '.sql',
  '.dockerfile', '.tf', '.hcl',
]);

// Blocked file patterns — sensitive files that should NEVER be ingested
const RAG_BLOCKED_PATTERNS = [
  /\.env(\.|$)/i,          // .env, .env.local, .env.production
  /\.pem$/i,               // Private keys
  /\.key$/i,               // Private keys
  /\.p12$/i,               // PKCS12 certs
  /\.pfx$/i,               // PFX certs
  /id_rsa/i,               // SSH keys
  /\.db$/i,                // Database files
  /\.sqlite$/i,            // SQLite databases
  /credentials/i,          // Credential files
  /secrets?\./i,           // Secret files
  /\.npmrc$/i,             // npm config (may have tokens)
  /\.netrc$/i,             // Network credentials
  /\.git\//,               // Git internals
  /node_modules\//,        // Dependencies
  /package-lock\.json$/i,  // Lock files (noise, no value)
];

function isPathSafe(target: string): boolean {
  const resolved = path.resolve(target);
  // Must be within RAG_ROOT (defaults to project root)
  if (resolved !== RAG_ROOT && !resolved.startsWith(RAG_ROOT + path.sep)) {
    return false;
  }
  // Resolve symlinks to prevent escape via symbolic links
  try {
    const real = fs.realpathSync(resolved);
    if (real !== RAG_ROOT && !real.startsWith(RAG_ROOT + path.sep)) {
      return false;
    }
  } catch {
    // If realpath fails (file doesn't exist), block it
    return false;
  }
  return true;
}

function isFileAllowed(filePath: string): boolean {
  const basename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Block hidden files (except explicitly allowed like .eslintrc)
  if (basename.startsWith('.') && !RAG_ALLOWED_EXTENSIONS.has(ext)) {
    return false;
  }

  // Check against blocked patterns
  for (const pattern of RAG_BLOCKED_PATTERNS) {
    if (pattern.test(filePath) || pattern.test(basename)) {
      return false;
    }
  }

  // Must have an allowed extension
  if (!RAG_ALLOWED_EXTENSIONS.has(ext) && ext !== '') {
    return false;
  }

  return true;
}

/** Call OpenAI embedding API directly via fetch. Batching supported. */
async function getEmbeddings(inputs: string[], model: string): Promise<number[][]> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 10000);
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      signal: abort.signal,
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: inputs }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new RagError(ErrorCodes.RAG_EMBEDDING_FAILED, `Embedding API error ${res.status}: ${body}`, res.status);
    }
    const data = await res.json() as { data?: { index: number; embedding: number[] }[] };
    if (!Array.isArray(data.data) || data.data.length !== inputs.length) {
      throw new RagError(ErrorCodes.RAG_EMBEDDING_FAILED, `Embedding API returned ${data.data?.length ?? 0} vectors for ${inputs.length} inputs`, 502);
    }
    data.data.sort((a, b) => a.index - b.index);
    const embeddings = data.data.map(d => d.embedding);
    if (embeddings.some(e => !Array.isArray(e) || e.length === 0 || e.some(v => typeof v !== 'number' || !Number.isFinite(v)))) {
      throw new RagError(ErrorCodes.RAG_EMBEDDING_FAILED, 'Embedding API returned invalid vectors', 502);
    }
    return embeddings;
  } finally {
    clearTimeout(timeout);
  }
}

export class RagEngine {
  private loadedContent: string[] = [];
  private maxContentChars: number;
  private encoding: BufferEncoding;
  private store: Store | null;
  private vectorIndex: VectorIndex | null = null;
  private vectorIndexChunkCount = -1;

  constructor(options?: { maxContentChars?: number; encoding?: BufferEncoding; store?: Store }) {
    this.maxContentChars = options?.maxContentChars ?? config.rag.maxContentChars;
    this.encoding = options?.encoding ?? config.rag.encoding;
    this.store = options?.store ?? null;
  }

  /** Split text into chunks preserving paragraph/sentence boundaries. */
  private splitIntoChunks(text: string): string[] {
    const maxLen = config.rag.chunkSize;
    const overlapChars = config.rag.chunkOverlapChars;
    const paragraphs = this.withSections(text);
    const chunks: string[] = [];
    let current = '';
    let currentSection = '';

    const prefixed = (section: string, body: string) => section ? `[section: ${section}]\n${body.trim()}` : body.trim();
    const push = () => {
      const chunk = prefixed(currentSection, current);
      if (chunk && chunks[chunks.length - 1] !== chunk) chunks.push(chunk);
      current = '';
    };

    for (const { section, text: para } of paragraphs) {
      const prefixLen = section ? `[section: ${section}]\n`.length : 0;
      const bodyMaxLen = Math.max(1, maxLen - prefixLen);
      if (current && section !== currentSection) push();
      currentSection = section;

      const candidate = current ? current + '\n\n' + para : para;
      if (candidate.length <= bodyMaxLen) {
        current = candidate;
      } else {
        if (current) push();
        // Paragraph too long — split by sentence
        const sentences = this.sentences(para);
        let sub = '';
        for (const s of sentences) {
          const subCandidate = sub ? sub + s : s;
          if (subCandidate.length <= bodyMaxLen) {
            sub = subCandidate;
          } else {
            if (sub) {
              current = sub;
              push();
              sub = this.overlap(sub, overlapChars) + s;
            } else {
              for (let start = 0; start < s.length; start += bodyMaxLen) {
                current = s.slice(start, start + bodyMaxLen);
                if (start + bodyMaxLen < s.length) push();
              }
              sub = current;
              current = '';
            }
          }
        }
        current = sub;
      }
    }
    if (current) push();
    return chunks;
  }

  private async getEmbeddingsWithRetry(inputs: string[]): Promise<number[][]> {
    const attempts = Math.max(1, config.rag.embeddingRetryAttempts);
    for (let attempt = 1; ; attempt++) {
      try {
        return await getEmbeddings(inputs, config.rag.embeddingModel);
      } catch (err) {
        if ((err instanceof RagError && [401, 403].includes(err.statusCode)) || attempt >= attempts) throw err;
        await sleep(100 * 2 ** (attempt - 1));
      }
    }
  }

  private sentences(text: string): string[] {
    return text.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g)?.filter(s => s.trim()) ?? [text];
  }

  private overlap(text: string, maxChars: number): string {
    if (maxChars <= 0) return '';
    const lastSentence = this.sentences(text).at(-1)?.trimStart() ?? '';
    const overlap = lastSentence.length <= maxChars ? lastSentence : text.slice(-maxChars);
    return overlap ? overlap.trimEnd() + ' ' : '';
  }

  private withSections(text: string): { section: string; text: string }[] {
    const blocks = text.split(/\n\s*\n+/);
    const out: { section: string; text: string }[] = [];
    let section = '';
    for (let i = 0; i < blocks.length; i++) {
      const block = (blocks[i] ?? '').trim();
      if (!block) continue;
      const [firstLine = '', ...restLines] = block.split('\n');
      const rest = restLines.join('\n').trim();
      const heading = firstLine.match(/^#{1,2}\s+(.+)$/)?.[1] ?? (rest || i < blocks.length - 1 ? this.titleLine(firstLine) : null);
      if (heading) {
        section = heading.trim();
        if (rest) out.push({ section, text: rest });
        continue;
      }
      out.push({ section, text: block });
    }
    return out;
  }

  private titleLine(block: string): string | null {
    return /^[^\n.!?:]{3,80}$/.test(block) ? block : null;
  }

  private wrapSnippet(label: string, text: string): string {
    const maxLen = this.maxContentChars;
    const truncated = text.length > maxLen ? text.slice(0, maxLen) + `\n... [truncado - el contenido excede el maximo]` : text;
    return `--- ${label} ---\n${truncated}\n`;
  }

  /** Embed text chunks and persist to store. Skips if no API key or store. */
  private async indexContent(source: string, content: string): Promise<void> {
    if (!this.store || !config.hasEmbeddingApiKey) return;

    const contentHash = sha256(content);
    if (this.store.getContentHashBySource(source) === contentHash) {
      logger.info(`[RagEngine] Fuente sin cambios, saltando reindex: "${source}"`);
      return;
    }

    this.store.deleteChunksBySource(source);
    this.vectorIndex = null;
    this.vectorIndexChunkCount = -1;
    const chunks = this.splitIntoChunks(content)
      .map(chunkText => ({ chunkText, chunkHash: sha256(chunkText) }))
      .filter((chunk, index, all) => all.findIndex(c => c.chunkHash === chunk.chunkHash) === index);

    let hasEmbeddings = false;
    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      let embeddings: number[][] | null = null;
      try {
        embeddings = await this.getEmbeddingsWithRetry(batch.map(c => c.chunkText));
        hasEmbeddings = true;
      } catch (err) {
        logger.warn({ err, source, start: i, end: i + batch.length }, '[RagEngine] Error embebiendo lote');
      }
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        if (!item) continue;
        this.store.saveChunk({
          source,
          chunkIndex: i + j,
          chunkText: item.chunkText,
          embedding: embeddings?.[j] ?? undefined,
          contentHash,
          chunkHash: item.chunkHash,
        });
      }
    }
    logger.info(`[RagEngine] Indexados ${chunks.length} chunks para "${source}"${hasEmbeddings ? ' con embeddings' : ' sin embeddings'}`);
  }

  /** Load documents from sources, chunk, store, and embed. */
  async loadSources(sources: RagSource[]): Promise<void> {
    if (this.loadedContent.length > 0) {
      logger.warn(`[RagEngine] Reemplazando ${this.loadedContent.length} fuentes cargadas anteriormente.`);
    }
    this.loadedContent = [];

    for (const source of sources) {
      try {
        switch (source.type) {
          case 'local_file': {
            if (!isPathSafe(source.path)) {
              logger.warn(`[RagEngine] Path blocked (outside RAG root or symlink escape): ${source.path}`);
              break;
            }
            const resolved = path.resolve(source.path);
            if (!isFileAllowed(resolved)) {
              logger.warn(`[RagEngine] File blocked by security policy: ${source.path}`);
              break;
            }
            const content = fs.readFileSync(resolved, this.encoding);
            this.loadedContent.push(this.wrapSnippet(source.path, content));
            await this.indexContent(source.path, content);
            break;
          }
          case 'local_directory': {
            if (!isPathSafe(source.path)) {
              logger.warn(`[RagEngine] Path blocked (outside RAG root or symlink escape): ${source.path}`);
              break;
            }
            const resolved = path.resolve(source.path);
            const ext = source.pattern.replace('*.', '.');
            const files = fs.readdirSync(resolved).filter(f => f.endsWith(ext));
            for (const file of files) {
              const filePath = path.join(resolved, file);
              if (!isFileAllowed(filePath)) {
                logger.warn(`[RagEngine] File blocked by security policy: ${file}`);
                continue;
              }
              try {
                const content = fs.readFileSync(filePath, this.encoding);
                const label = path.join(source.path, file);
                this.loadedContent.push(this.wrapSnippet(label, content));
                await this.indexContent(label, content);
              } catch (err: unknown) {
                logger.warn(`[RagEngine] Error leyendo ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
              }
            }
            break;
          }
          case 'inline': {
            this.loadedContent.push(this.wrapSnippet('inline', source.content));
            await this.indexContent('inline', source.content);
            break;
          }
          case 'web_url': {
            if (!source.url) {
              logger.warn(`[RagEngine] web_url source sin URL, saltando.`);
              break;
            }
            if (isBlockedUrl(source.url)) {
              logger.warn(`[RagEngine] URL bloqueada por seguridad: ${source.url}`);
              break;
            }
            let timeout: ReturnType<typeof setTimeout> | undefined;
            try {
              const abort = new AbortController();
              timeout = setTimeout(() => abort.abort(), 10000);
              const response = await fetch(source.url, { signal: abort.signal, redirect: 'error' });
              if (!response.ok) {
                logger.warn(`[RagEngine] Error fetching ${source.url}: HTTP ${response.status}`);
                break;
              }
              const contentLen = response.headers.get('content-length');
              if (contentLen && parseInt(contentLen, 10) > MAX_DOWNLOAD_BYTES) {
                logger.warn(`[RagEngine] URL ${source.url} too large (${contentLen} bytes), skipping.`);
                break;
              }
              // Stream-read with hard byte limit (prevents memory bombs)
              const html = await readBounded(response, MAX_DOWNLOAD_BYTES);
              const text = html
                .replace(/<!--[\s\S]*?-->/g, '')
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&[^;]+;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              if (text) {
                const label = `URL: ${source.url}`;
                this.loadedContent.push(this.wrapSnippet(label, text));
                await this.indexContent(label, text);
              }
            } finally {
              if (timeout) clearTimeout(timeout);
            }
            break;
          }
          default: {
            logger.warn(`[RagEngine] Tipo de fuente desconocido: ${(source as any).type}`);
            break;
          }
        }
      } catch (err: unknown) {
        const extra = source.type === 'web_url' ? ` (${(source as { url: string }).url})` : '';
        logger.warn(`[RagEngine] Error procesando fuente ${source.type}${extra}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /** Search for chunks semantically similar to query. Returns empty if no embeddings. */
  async searchSimilar(query: string): Promise<{ text: string; score: number }[]> {
    if (!config.hasEmbeddingApiKey || !this.store) return [];

    let queryVec: number[];
    try {
      const embeddings = await this.getEmbeddingsWithRetry([query]);
      const first = embeddings[0];
      if (!first) return [];
      queryVec = first;
    } catch (err) {
      logger.warn({ err }, '[RagEngine] Error generando embedding de query');
      return [];
    }

    const count = this.store.getChunksCount();
    if (!this.vectorIndex || this.vectorIndexChunkCount !== count) {
      const chunks = this.store.getAllChunks().filter(c => c.embedding);
      this.vectorIndex = new VectorIndex(chunks);
      this.vectorIndexChunkCount = count;
    }

    return this.vectorIndex.search(queryVec, config.rag.topK);
  }

  /**
   * Get RAG context. When query is provided and embeddings exist, performs
   * semantic search. Falls back to text-based context concatenation.
   */
  async getContext(query?: string): Promise<string> {
    if (query && config.hasEmbeddingApiKey && this.store) {
      const results = await this.searchSimilar(query);
      if (results.length > 0) {
        const context = results
          .map(r => `[relevancia: ${(r.score * 100).toFixed(0)}%]\n${r.text}`)
          .join('\n\n---\n\n');
        logger.info(`[RagEngine] Busqueda semantica: ${results.length} resultados para query "${query.slice(0, 60)}..."`);
        return `## Contexto RAG (busqueda semantica):\n\n${context}`;
      }
    }

    // Fallback: text-based concatenation
    if (this.loadedContent.length === 0) return '';
    let combined = this.loadedContent.join('\n\n');
    if (combined.length > this.maxContentChars) {
      combined = combined.slice(0, this.maxContentChars) + '\n\n... [truncado - el contenido excede el maximo]';
    }
    return `## Contexto RAG (documentos cargados):\n\n${combined}`;
  }
}
