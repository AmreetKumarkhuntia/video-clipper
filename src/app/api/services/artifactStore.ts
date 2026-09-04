import type { ClipPlan } from '@lib/types/analysis.js';
import type { PublishDraft } from '@lib/types/publish.js';
import { getAnalysisFromDb, listAnalysesFromDb } from '@lib/services/db/index.js';
import { getPublishDraftByAnalysisId } from '@lib/services/db/index.js';
import { createArtifactId } from '@lib/utils/ids.js';

export { createArtifactId };

export async function getAnalysis(analysisId: string): Promise<ClipPlan | null> {
  return getAnalysisFromDb(analysisId);
}

export async function listAnalyses(): Promise<ClipPlan[]> {
  return listAnalysesFromDb();
}

export async function getPublishDraft(analysisId: string): Promise<PublishDraft | null> {
  return getPublishDraftByAnalysisId(analysisId);
}
