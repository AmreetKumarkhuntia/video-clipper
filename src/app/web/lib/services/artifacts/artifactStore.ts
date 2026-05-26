import type { ClipPlan } from '@lib/types/analysis.js';
import type { PublishDraft, UploadArtifact } from '@app/web/types/publish.js';
import {
  saveAnalysisToDb,
  getAnalysisFromDb,
  listAnalysesFromDb,
} from '@lib/services/db/repos/analysesRepo.js';
import {
  upsertPublishDraft,
  getPublishDraftByAnalysisId,
} from '@lib/services/db/repos/publishDraftsRepo.js';
import {
  upsertUploadArtifact,
  listUploadArtifactsByAnalysisId as listUploadsFromDb,
} from '@lib/services/db/repos/uploadArtifactsRepo.js';
import { createArtifactId } from '@lib/orchestration/analysisOrchestrator.js';

export { createArtifactId };

export async function saveAnalysis(plan: ClipPlan, optionsHash: string): Promise<ClipPlan> {
  saveAnalysisToDb(plan, optionsHash);
  return plan;
}

export async function getAnalysis(analysisId: string): Promise<ClipPlan | null> {
  return getAnalysisFromDb(analysisId);
}

export async function listAnalyses(): Promise<ClipPlan[]> {
  return listAnalysesFromDb();
}

export async function savePublishDraft(draft: PublishDraft): Promise<PublishDraft> {
  upsertPublishDraft(draft);
  return draft;
}

export async function getPublishDraft(analysisId: string): Promise<PublishDraft | null> {
  return getPublishDraftByAnalysisId(analysisId);
}

export async function saveUploadArtifacts(uploads: UploadArtifact[]): Promise<UploadArtifact[]> {
  for (const upload of uploads) {
    upsertUploadArtifact(upload);
  }
  return uploads;
}

export async function listUploadArtifactsByAnalysisId(
  analysisId: string,
): Promise<UploadArtifact[]> {
  return listUploadsFromDb(analysisId);
}
