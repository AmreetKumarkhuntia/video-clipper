import { createOpenAI, openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import { mistral } from '@ai-sdk/mistral';
import { groq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';
import { config } from '../config/index.js';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

/**
 * Returns a Vercel AI SDK LanguageModel instance for the configured provider
 * and model. Both `llmAnalyzer` and `clipRefiner` call this instead of
 * hard-coding `openai(config.LLM_MODEL)`.
 *
 * The active provider is controlled by `LLM_PROVIDER` in the environment.
 * The model name is controlled by `LLM_MODEL`.
 *
 * In ai@5, all provider packages ship LanguageModelV3 which natively
 * satisfies the LanguageModel interface.
 */
export function getModel(): LanguageModel {
  const model = config.LLM_MODEL;

  switch (config.LLM_PROVIDER) {
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
        baseURL: 'https://api.z.ai/api/paas/v4',
        apiKey: config.ZAI_API_KEY,
        // Zai is OpenAI-compatible and supports json_schema response format.
        // Without this flag the SDK falls back to json_object mode and emits
        // a "responseFormat not supported" warning on every chunk call.
        supportsStructuredOutputs: true,
      }).languageModel(model);

    case 'openrouter':
      return createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: config.OPENROUTER_API_KEY,
      }).languageModel(model);
  }
}
