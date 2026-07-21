import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { config } from '../config.js';

// ponytail: blocklist-based SSRF prevention. Upgrade to DNS-resolution check if deployed publicly.
const BLOCKED_HOSTS = [
  'localhost', '127.0.0.1', '::1', '0.0.0.0',
  '::ffff:127.0.0.1', '::ffff:0.0.0.0',
  '169.254.169.254', 'metadata.google.internal',
  '::ffff:a9fe:a9fe',
];

function isBlockedUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    // Block by hostname (catches both direct IP and hostname matches)
    return BLOCKED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
  } catch {
    return true; // unparseable URL = blocked
  }
}

export type RagSource =
  | { type: 'local_file'; path: string }
  | { type: 'local_directory'; path: string; pattern: string }
  | { type: 'inline'; content: string }
  | { type: 'web_url'; url: string };

// ponytail: basic path traversal guard. Upgrade to configurable allow-list if needed.
const PROJECT_ROOT = path.resolve('.');
function isPathSafe(target: string): boolean {
  const resolved = path.resolve(target);
  return resolved === PROJECT_ROOT || resolved.startsWith(PROJECT_ROOT + path.sep);
}

export class RagEngine {
  private sources: RagSource[] = [];
  private loadedContent: string[] = [];
  private maxContentChars: number;
  private encoding: BufferEncoding;

  constructor(options?: { maxContentChars?: number; encoding?: BufferEncoding }) {
    this.maxContentChars = options?.maxContentChars ?? config.rag.maxContentChars;
    this.encoding = options?.encoding ?? config.rag.encoding;
  }

  private wrapSnippet(label: string, text: string): string {
    const maxLen = this.maxContentChars;
    const truncated = text.length > maxLen ? text.slice(0, maxLen) + `\n... [truncado - el contenido excede el maximo]` : text;
    return `--- ${label} ---\n${truncated}\n`;
  }

  async loadSources(sources: RagSource[]): Promise<void> {
    if (this.loadedContent.length > 0) {
      console.warn(`[RagEngine] Reemplazando ${this.loadedContent.length} fuentes cargadas anteriormente.`);
    }
    this.sources = sources;
    this.loadedContent = [];

    for (const source of sources) {
      try {
        switch (source.type) {
          case 'local_file': {
            if (!isPathSafe(source.path)) {
              console.warn(`[RagEngine] Path traversal bloqueado: ${source.path}`);
              break;
            }
            const resolved = path.resolve(source.path);
            const content = fs.readFileSync(resolved, this.encoding);
            this.loadedContent.push(this.wrapSnippet(source.path, content));
            break;
          }
          case 'local_directory': {
            if (!isPathSafe(source.path)) {
              console.warn(`[RagEngine] Path traversal bloqueado: ${source.path}`);
              break;
            }
            const resolved = path.resolve(source.path);
            const files = fs.readdirSync(resolved).filter(f => f.endsWith(source.pattern.replace('*.', '.')));
            for (const file of files) {
              const filePath = path.join(resolved, file);
              try {
                const content = fs.readFileSync(filePath, this.encoding);
                this.loadedContent.push(this.wrapSnippet(path.join(source.path, file), content));
              } catch (err: unknown) {
                console.warn(`[RagEngine] Error leyendo ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
              }
            }
            break;
          }
          case 'inline': {
            this.loadedContent.push(this.wrapSnippet('inline', source.content));
            break;
          }
          case 'web_url': {
            if (!source.url) {
              console.warn(`[RagEngine] web_url source sin URL, saltando.`);
              break;
            }
            if (isBlockedUrl(source.url)) {
              console.warn(`[RagEngine] URL bloqueada por seguridad: ${source.url}`);
              break;
            }
            let timeout: ReturnType<typeof setTimeout> | undefined;
            try {
              const abort = new AbortController();
              timeout = setTimeout(() => abort.abort(), 10000);
              const response = await fetch(source.url, { signal: abort.signal, redirect: 'error' });
              if (!response.ok) {
                console.warn(`[RagEngine] Error fetching ${source.url}: HTTP ${response.status}`);
                break;
              }
              // Check content-length header before buffering
              const contentLen = response.headers.get('content-length');
              if (contentLen && parseInt(contentLen, 10) > 512 * 1024) {
                console.warn(`[RagEngine] URL ${source.url} demasiado grande (${contentLen} bytes), saltando.`);
                break;
              }
              const html = await response.text();
              // Basic text extraction: strip HTML tags
              const text = html
                .replace(/<!--[\s\S]*?-->/g, '')
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&[^;]+;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              if (text) {
                this.loadedContent.push(this.wrapSnippet(`URL: ${source.url}`, text));
              }
            } finally {
              if (timeout) clearTimeout(timeout);
            }
            break;
          }
          default: {
            console.warn(`[RagEngine] Tipo de fuente desconocido: ${(source as any).type}`);
            break;
          }
        }
      } catch (err: unknown) {
        const extra = source.type === 'web_url' ? ` (${(source as { url: string }).url})` : '';
        console.warn(`[RagEngine] Error procesando fuente ${source.type}${extra}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  getContext(): string {
    if (this.loadedContent.length === 0) return '';

    let combined = this.loadedContent.join('\n\n');
    if (combined.length > this.maxContentChars) {
      combined = combined.slice(0, this.maxContentChars) + '\n\n... [truncado - el contenido excede el maximo]';
    }
    return `## Contexto RAG (documentos cargados):\n\n${combined}`;
  }
}
