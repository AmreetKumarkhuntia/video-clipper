import { createOpenAI, openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI, google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import { mistral } from '@ai-sdk/mistral';
import { groq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ModelFactoryApiKeys } from '@lib/types/config.js';

export function resolveLanguageModel(
  provider: string,
  model: string,
  apiKeys: ModelFactoryApiKeys,
): LanguageModel {
  switch (provider) {
    case 'openai': {
      const client = apiKeys.OPENAI_API_KEY
        ? createOpenAI({ apiKey: apiKeys.OPENAI_API_KEY })
        : openai;
      return client.languageModel(model);
    }

    case 'anthropic':
      return anthropic.languageModel(model);

    case 'google': {
      const client = apiKeys.GOOGLE_GENERATIVE_AI_API_KEY
        ? createGoogleGenerativeAI({ apiKey: apiKeys.GOOGLE_GENERATIVE_AI_API_KEY })
        : google;
      return client.languageModel(model);
    }

    case 'xai':
      return xai.languageModel(model);

    case 'mistral':
      return mistral.languageModel(model);

    case 'groq':
      return groq.languageModel(model);

    case 'zai':
      return createOpenAICompatible({
        name: 'zai',
        baseURL: 'https://api.z.ai/api/paas/v4',
        apiKey: apiKeys.ZAI_API_KEY!,
        supportsStructuredOutputs: true,
      }).languageModel(model);

    case 'zaicoding':
      return createOpenAICompatible({
        name: 'zaicoding',
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
