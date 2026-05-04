import { createOpenAI, openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import { mistral } from '@ai-sdk/mistral';
import { groq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export interface ModelFactoryApiKeys {
  ZAI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  CUSTOM_OPENAI_BASE_URL?: string;
  CUSTOM_OPENAI_API_KEY?: string;
}

export function getModel(
  provider: string,
  model: string,
  apiKeys: ModelFactoryApiKeys,
): LanguageModel {
  switch (provider) {
    case 'openai':
      return openai.languageModel(model);

    case 'anthropic':
      return anthropic.languageModel(model);

    case 'google':
      return google.languageModel(model);

    case 'xai':
      return xai.languageModel(model);

    case 'mistral':
      return mistral.languageModel(model);

    case 'groq':
      return groq.languageModel(model);

    case 'zai':
      return createOpenAICompatible({
        name: 'zai',
        baseURL: 'https://api.z.ai/api/coding/paas/v4',
        apiKey: apiKeys.ZAI_API_KEY!,
        supportsStructuredOutputs: true,
      }).languageModel(model);

    case 'openrouter':
      return createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: apiKeys.OPENROUTER_API_KEY,
      }).languageModel(model);

    case 'custom':
      return createOpenAICompatible({
        name: 'custom',
        baseURL: apiKeys.CUSTOM_OPENAI_BASE_URL!,
        apiKey: apiKeys.CUSTOM_OPENAI_API_KEY,
        supportsStructuredOutputs: true,
      }).languageModel(model);

    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
