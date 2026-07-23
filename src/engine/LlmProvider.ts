import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { generateText, type LanguageModel } from 'ai';
import { config } from '../config.js';
import { logger } from '../logger.js';

type ProviderName = 'openai' | 'anthropic' | 'local';

export interface ConfiguredModel {
  provider: ProviderName;
  modelId: string;
  model: LanguageModel;
}

export type GenerateTextFn = (options: Parameters<typeof generateText>[0]) => ReturnType<typeof generateText>;
type GenerateTextOptions = Parameters<typeof generateText>[0];
type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const NON_RETRYABLE_STATUS = new Set([400, 401, 403]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  const status = e.status ?? e.statusCode ?? (e.response as Record<string, unknown> | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
}

function getHeader(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const get = (headers as { get?: (key: string) => string | null | undefined }).get;
  if (get) return get(name) ?? get(name.toLowerCase()) ?? undefined;
  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()];
  return typeof value === 'string' ? value : undefined;
}

function getRetryAfterMs(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  const response = e.response as Record<string, unknown> | undefined;
  const value = getHeader(e.headers, 'Retry-After') ?? getHeader(response?.headers, 'Retry-After');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(value);
  return Number.isNaN(dateMs) ? undefined : Math.max(0, dateMs - Date.now());
}

function isRetryableError(err: unknown): boolean {
  const status = getStatus(err);
  if (status !== undefined) return RETRYABLE_STATUS.has(status) && !NON_RETRYABLE_STATUS.has(status);
  if (!err || typeof err !== 'object') return false;
  const code = String((err as Record<string, unknown>).code ?? '').toLowerCase();
  const name = String((err as Record<string, unknown>).name ?? '').toLowerCase();
  return ['etimedout', 'econnreset', 'econnrefused', 'enotfound', 'timeout', 'aborterror'].some(v => code.includes(v) || name.includes(v));
}

export function parseProviderChain(value = config.llm.providerChain): ProviderName[] {
  const providers = value
    .split(',')
    .map(v => v.trim())
    .filter((v): v is ProviderName => v === 'openai' || v === 'anthropic' || v === 'local');

  return providers.length ? providers : ['openai'];
}

export function getConfiguredModels(): ConfiguredModel[] {
  const local = createOpenAI({ baseURL: config.llm.localBaseUrl, apiKey: config.llm.localApiKey });

  return parseProviderChain().map(provider => {
    if (provider === 'anthropic') return { provider, modelId: config.llm.anthropicModel, model: anthropic(config.llm.anthropicModel) };
    if (provider === 'local') return { provider, modelId: config.llm.localModel, model: local(config.llm.localModel) };
    return { provider, modelId: config.llm.openaiModel, model: openai(config.llm.openaiModel) };
  });
}

export async function generateTextWithFallback(
  options: Omit<Parameters<typeof generateText>[0], 'model'>,
  models: ConfiguredModel[] = getConfiguredModels(),
  generate: GenerateTextFn = generateText,
  canFallback: () => boolean = () => true,
  retryOptions: RetryOptions = {},
): ReturnType<typeof generateText> {
  let lastError: unknown;
  const maxAttempts = Math.max(1, retryOptions.maxAttempts ?? config.llm.retryMax);
  const baseDelayMs = retryOptions.baseDelayMs ?? config.llm.retryDelayMs;
  const maxDelayMs = retryOptions.maxDelayMs ?? config.llm.retryMaxDelayMs;
  const wait = retryOptions.sleep ?? sleep;
  const random = retryOptions.random ?? Math.random;

  for (const providerModel of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await generate({ ...options, model: providerModel.model } as GenerateTextOptions);
      } catch (err) {
        lastError = err;
        if (!canFallback()) throw err;
        if (attempt < maxAttempts && isRetryableError(err)) {
          const retryAfterMs = getRetryAfterMs(err);
          const exponentialMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
          const delayMs = retryAfterMs ?? Math.min(exponentialMs + Math.floor(exponentialMs * 0.25 * random()), maxDelayMs);
          logger.warn({ err, provider: providerModel.provider, model: providerModel.modelId, attempt, delayMs }, '[LlmProvider] Provider failed, retrying');
          if (delayMs > 0) await wait(delayMs);
          continue;
        }
        break;
      }
    }

    if (!canFallback()) throw lastError;
    logger.warn({ err: lastError, provider: providerModel.provider, model: providerModel.modelId }, '[LlmProvider] Provider failed, trying next');
  }

  throw lastError;
}
