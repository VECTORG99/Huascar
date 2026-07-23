import { DocumentChunk } from './Store.js';

export type VectorSearchResult = { text: string; score: number };

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export class VectorIndex {
  private readonly chunks: DocumentChunk[];
  private readonly buckets = new Map<string, DocumentChunk[]>();
  private readonly smallCorpusSize = 32;
  private readonly tables = 4;
  private readonly bits = 6;
  lastCandidateCount = 0;
  lastUsedExactFallback = false;

  constructor(chunks: DocumentChunk[]) {
    this.chunks = chunks.filter(c => c.embedding);
    for (const chunk of this.chunks) {
      for (let table = 0; table < this.tables; table++) {
        const key = this.key(chunk.embedding!, table);
        const bucket = this.buckets.get(key);
        if (bucket) bucket.push(chunk);
        else this.buckets.set(key, [chunk]);
      }
    }
  }

  get size(): number {
    return this.chunks.length;
  }

  search(query: number[], topK: number): VectorSearchResult[] {
    const candidates = this.candidates(query, topK);
    return candidates
      .map(c => ({ text: c.chunk_text, score: cosineSimilarity(query, c.embedding!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private candidates(query: number[], topK: number): DocumentChunk[] {
    if (this.chunks.length < this.smallCorpusSize) return this.fallbackCandidates();

    const seen = new Set<number>();
    const out: DocumentChunk[] = [];
    for (let table = 0; table < this.tables; table++) {
      for (const chunk of this.buckets.get(this.key(query, table)) ?? []) {
        if (seen.has(chunk.id)) continue;
        seen.add(chunk.id);
        out.push(chunk);
      }
    }

    this.lastCandidateCount = out.length;
    this.lastUsedExactFallback = out.length < topK * 2;
    return this.lastUsedExactFallback ? this.chunks : out;
  }

  private fallbackCandidates(): DocumentChunk[] {
    this.lastCandidateCount = this.chunks.length;
    this.lastUsedExactFallback = true;
    return this.chunks;
  }

  private key(vector: number[], table: number): string {
    let key = `${table}:`;
    for (let bit = 0; bit < this.bits; bit++) key += this.projection(vector, table, bit) >= 0 ? '1' : '0';
    return key;
  }

  private projection(vector: number[], table: number, bit: number): number {
    let sum = 0;
    for (let i = 0; i < vector.length; i++) sum += (vector[i] ?? 0) * this.weight(i, table, bit);
    return sum;
  }

  private weight(dim: number, table: number, bit: number): number {
    // ponytail: deterministic pseudo-random projections; replace with persisted HNSW only if this bottlenecks.
    return Math.sin((dim + 1) * 12.9898 + (table + 1) * 78.233 + (bit + 1) * 37.719) >= 0 ? 1 : -1;
  }
}
