import { runAnalysis } from '@lib/orchestration/analysisOrchestrator.js';
import type { ClipPlan, CreateAnalysisRequest } from '@lib/types/analysis.js';
import type { StreamCallbacks } from '@lib/types/index.js';
import type { Config } from '@lib/types/config.js';

export async function analyzeTranscriptForWeb(
  input: CreateAnalysisRequest,
  cfg: Config,
  callbacks?: StreamCallbacks,
  requestId?: string,
  signal?: AbortSignal,
): Promise<ClipPlan> {
  return runAnalysis(input, cfg, callbacks, requestId, signal);
}
