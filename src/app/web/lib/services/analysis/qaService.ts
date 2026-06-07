import { answerVideoQuestion } from '@lib/orchestration/qaOrchestrator.js';
import { findQaMessages, clearQaMessages } from '@lib/services/db/repos/qaMessagesRepo.js';
import type { QaRequest, QaAnswer, QaMessage } from '@lib/types/qa.js';
import type { Config } from '@lib/types/config.js';
import type { QaStreamCallbacks } from '@app/web/types/qa.js';

export async function answerVideoQuestionForWeb(
  input: QaRequest,
  cfg: Config,
  callbacks?: QaStreamCallbacks,
  requestId?: string,
  signal?: AbortSignal,
): Promise<QaAnswer> {
  return answerVideoQuestion(input, cfg, callbacks, requestId, signal);
}

export function getQaThreadForWeb(videoId: string): QaMessage[] {
  return findQaMessages(videoId);
}

export function clearQaThreadForWeb(videoId: string): boolean {
  return clearQaMessages(videoId);
}
