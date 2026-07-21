import fs from 'fs';
import path from 'path';

export type RagSource =
  | { type: 'local_file'; path: string }
  | { type: 'local_directory'; path: string; pattern: string }
  | { type: 'inline'; content: string };

const MAX_CONTENT = 16_000;

export class RagEngine {
  private sources: RagSource[] = [];
  private loadedContent: string[] = [];

  loadSources(sources: RagSource[]): void {
    this.sources = sources;
    this.loadedContent = [];

    for (const source of sources) {
      try {
        switch (source.type) {
          case 'local_file': {
            const resolved = path.resolve(source.path);
            const content = fs.readFileSync(resolved, 'utf8');
            this.loadedContent.push(`--- ${source.path} ---\n${content}`);
            break;
          }
          case 'local_directory': {
            const resolved = path.resolve(source.path);
            const files = fs.readdirSync(resolved).filter(f => f.endsWith(source.pattern.replace('*.', '.')));
            for (const file of files) {
              const filePath = path.join(resolved, file);
              try {
                const content = fs.readFileSync(filePath, 'utf8');
                this.loadedContent.push(`--- ${path.join(source.path, file)} ---\n${content}`);
              } catch (err: unknown) {
                console.warn(`[RagEngine] Error leyendo ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
              }
            }
            break;
          }
          case 'inline': {
            this.loadedContent.push(`--- inline ---\n${source.content}`);
            break;
          }
        }
      } catch (err: unknown) {
        console.warn(`[RagEngine] Error procesando fuente ${source.type}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  getContext(): string {
    if (this.loadedContent.length === 0) return '';

    let combined = this.loadedContent.join('\n\n');
    if (combined.length > MAX_CONTENT) {
      combined = combined.slice(0, MAX_CONTENT) + '\n\n... [truncado - el contenido excede el maximo]';
    }
    return `## Contexto RAG (documentos cargados):\n\n${combined}`;
  }
}
