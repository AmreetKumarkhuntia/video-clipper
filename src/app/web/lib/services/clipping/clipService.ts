import { generateClipsForAnalysis } from '@lib/orchestration/clipOrchestrator.js';
import type { ClipArtifact, CreateClipsRequest } from '@lib/types/analysis.js';
import type { Config } from '@lib/types/config.js';

export async function generateWebClips(
  input: CreateClipsRequest,
  cfg: Config,
  requestId?: string,
): Promise<ClipArtifact[]> {
  return generateClipsForAnalysis(input, cfg, requestId);
}
