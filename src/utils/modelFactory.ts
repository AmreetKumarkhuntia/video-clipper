import { createOpenAI, openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import { mistral } from '@ai-sdk/mistral';
import { groq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';
import { config } from '../config/index.js';

/**
 * Returns a Vercel AI SDK LanguageModel instance for the configured provider
 * and model. Both `llmAnalyzer` and `clipRefiner` call this instead of
 * hard-coding `openai(config.LLM_MODEL)`.
 *
 * The active provider is controlled by `LLM_PROVIDER` in the environment.
 * The model name is controlled by `LLM_MODEL`.
 *
 * Note: newer provider packages (anthropic, google, xai, mistral, groq) ship
 * `LanguageModelV3` from their own bundled `@ai-sdk/provider`, which is a
 * superset of `LanguageModelV1`. The cast to `LanguageModel` is safe because
 * all concrete objects satisfy the interface expected by `generateObject` at
 * runtime.
 */
export function getModel(): LanguageModel {
  const model = config.LLM_MODEL;

  switch (config.LLM_PROVIDER) {
    case 'openai':
      return openai(model);

    case 'anthropic':
      return anthropic(model) as unknown as LanguageModel;

    case 'google':
      return google(model) as unknown as LanguageModel;

    case 'xai':
      return xai(model) as unknown as LanguageModel;

    case 'mistral':
      return mistral(model) as unknown as LanguageModel;

    case 'groq':
      return groq(model) as unknown as LanguageModel;

    case 'zai':
      return createOpenAI({
        baseURL: 'https://api.z.ai/api/paas/v4/',
        apiKey: config.ZAI_API_KEY,
      })(model);

    case 'openrouter':
      return createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: config.OPENROUTER_API_KEY,
      })(model);
  }
}
