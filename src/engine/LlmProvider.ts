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
): ReturnType<typeof generateText> {
  let lastError: unknown;

  for (const providerModel of models) {
    try {
      return await generate({ ...options, model: providerModel.model } as GenerateTextOptions);
    } catch (err) {
      lastError = err;
      logger.warn({ err, provider: providerModel.provider, model: providerModel.modelId }, '[LlmProvider] Provider failed, trying next');
    }
  }

  throw lastError;
}
