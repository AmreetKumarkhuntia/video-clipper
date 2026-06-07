import { randomUUID } from 'crypto';
import { Model } from '@lib/services/modelFactory/index.js';
import { answerQuestion } from '@lib/services/analysis/qa/index.js';
import { loadOrFetchTranscript } from './transcriptOrchestrator.js';
import {
  findQaMessages,
  insertQaMessage,
  clearQaMessages,
} from '@lib/services/db/repos/qaMessagesRepo.js';
import { DEFAULT_QA_SYSTEM_PROMPT } from '@lib/services/analysis/prompts.js';
import type { QaRequest, QaAnswer, QaMessage, QaStreamCallbacks } from '@lib/types/qa.js';
import type { Config } from '@lib/types/config.js';

export async function answerVideoQuestion(
  input: QaRequest,
  cfg: Config,
  callbacks?: QaStreamCallbacks,
  requestId?: string,
  signal?: AbortSignal,
): Promise<QaAnswer> {
  const model = new Model({
    provider: cfg.LLM_PROVIDER,
    model: cfg.LLM_MODEL,
    apiKeys: {
      ZAI_API_KEY: cfg.ZAI_API_KEY,
      OPENROUTER_API_KEY: cfg.OPENROUTER_API_KEY,
      CUSTOM_OPENAI_BASE_URL: cfg.CUSTOM_OPENAI_BASE_URL,
      CUSTOM_OPENAI_API_KEY: cfg.CUSTOM_OPENAI_API_KEY,
    },
  });

  const bundle = await loadOrFetchTranscript(input.videoId, cfg);
  const systemPrompt = cfg.LLM_QA_SYSTEM_PROMPT ?? DEFAULT_QA_SYSTEM_PROMPT;

  // Persist user turn
  const userMessage: QaMessage = {
    id: randomUUID(),
    role: 'user',
    content: input.question,
    citations: [],
    createdAt: new Date().toISOString(),
  };
  insertQaMessage(input.videoId, userMessage);

  const answer = await answerQuestion({
    bundle,
    question: input.question,
    history: input.history,
    title: input.title,
    channelTitle: input.channelTitle,
    description: input.description,
    model,
    systemPrompt,
    callbacks,
    signal,
    requestId,
  });

  // Persist assistant turn
  const assistantMessage: QaMessage = {
    id: answer.messageId,
    role: 'assistant',
    content: answer.content,
    citations: answer.citations,
    createdAt: new Date().toISOString(),
  };
  insertQaMessage(input.videoId, assistantMessage);

  return answer;
}

export { findQaMessages, clearQaMessages };
