import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { ClipArtifactSchema, ClipPlanSchema } from '@app/web/types/analysis.js';
import type { ClipArtifact, ClipPlan } from '@app/web/types/analysis.js';
import { PublishDraftSchema, UploadArtifactSchema } from '@app/web/types/publish.js';
import type { PublishDraft, UploadArtifact } from '@app/web/types/publish.js';

const WEB_OUTPUT_DIR = 'web';

function artifactRoot(
  outputDir: string,
  kind: 'analyses' | 'clips' | 'publish-drafts' | 'uploads' | 'clip-edits',
): string {
  return resolve(outputDir, WEB_OUTPUT_DIR, kind);
}

async function ensureArtifactDir(
  outputDir: string,
  kind: 'analyses' | 'clips' | 'publish-drafts' | 'uploads' | 'clip-edits',
): Promise<string> {
  const dir = artifactRoot(outputDir, kind);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function createArtifactId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export async function saveAnalysis(plan: ClipPlan, outputDir: string): Promise<ClipPlan> {
  const dir = await ensureArtifactDir(outputDir, 'analyses');
  await fs.writeFile(join(dir, `${plan.id}.json`), JSON.stringify(plan, null, 2), 'utf-8');
  return plan;
}

export async function getAnalysis(outputDir: string, analysisId: string): Promise<ClipPlan | null> {
  const dir = await ensureArtifactDir(outputDir, 'analyses');

  try {
    const raw = await fs.readFile(join(dir, `${analysisId}.json`), 'utf-8');
    return ClipPlanSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

export async function listAnalyses(outputDir: string): Promise<ClipPlan[]> {
  const dir = await ensureArtifactDir(outputDir, 'analyses');
  const names = await fs.readdir(dir);
  const plans: ClipPlan[] = [];

  for (const name of names.filter((item) => item.endsWith('.json'))) {
    const raw = await fs.readFile(join(dir, name), 'utf-8');
    plans.push(ClipPlanSchema.parse(JSON.parse(raw)));
  }

  return plans.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getClipArtifact(
  outputDir: string,
  clipId: string,
): Promise<ClipArtifact | null> {
  const dir = await ensureArtifactDir(outputDir, 'clips');

  try {
    const raw = await fs.readFile(join(dir, `${clipId}.json`), 'utf-8');
    return ClipArtifactSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

export async function updateClipArtifactPaths(
  outputDir: string,
  clipId: string,
  patch: { editsPath?: string; editedPath?: string },
): Promise<ClipArtifact> {
  const existing = await getClipArtifact(outputDir, clipId);
  if (!existing) throw new Error(`Clip artifact not found: ${clipId}`);

  const updated = ClipArtifactSchema.parse({ ...existing, ...patch });
  const dir = artifactRoot(outputDir, 'clips');
  await fs.writeFile(join(dir, `${clipId}.json`), JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export async function saveClipArtifacts(
  artifacts: ClipArtifact[],
  outputDir: string,
): Promise<ClipArtifact[]> {
  const dir = await ensureArtifactDir(outputDir, 'clips');

  for (const artifact of artifacts) {
    await fs.writeFile(
      join(dir, `${artifact.id}.json`),
      JSON.stringify(artifact, null, 2),
      'utf-8',
    );
  }

  return artifacts;
}

export async function savePublishDraft(
  draft: PublishDraft,
  outputDir: string,
): Promise<PublishDraft> {
  const dir = await ensureArtifactDir(outputDir, 'publish-drafts');
  await fs.writeFile(
    join(dir, `${draft.analysisId}.json`),
    JSON.stringify(draft, null, 2),
    'utf-8',
  );
  return draft;
}

export async function saveUploadArtifacts(
  uploads: UploadArtifact[],
  outputDir: string,
): Promise<UploadArtifact[]> {
  const dir = await ensureArtifactDir(outputDir, 'uploads');

  for (const upload of uploads) {
    await fs.writeFile(join(dir, `${upload.id}.json`), JSON.stringify(upload, null, 2), 'utf-8');
  }

  return uploads;
}

export async function listClipArtifacts(outputDir: string): Promise<ClipArtifact[]> {
  const dir = await ensureArtifactDir(outputDir, 'clips');
  const names = await fs.readdir(dir);
  const artifacts: ClipArtifact[] = [];

  for (const name of names.filter((item) => item.endsWith('.json'))) {
    const raw = await fs.readFile(join(dir, name), 'utf-8');
    artifacts.push(ClipArtifactSchema.parse(JSON.parse(raw)));
  }

  return artifacts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listClipArtifactsByAnalysisId(
  outputDir: string,
  analysisId: string,
): Promise<ClipArtifact[]> {
  const artifacts = await listClipArtifacts(outputDir);
  return artifacts.filter((artifact) => artifact.analysisId === analysisId);
}

export async function getPublishDraft(
  outputDir: string,
  analysisId: string,
): Promise<PublishDraft | null> {
  const dir = await ensureArtifactDir(outputDir, 'publish-drafts');

  try {
    const raw = await fs.readFile(join(dir, `${analysisId}.json`), 'utf-8');
    return PublishDraftSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

export async function listUploadArtifactsByAnalysisId(
  outputDir: string,
  analysisId: string,
): Promise<UploadArtifact[]> {
  const dir = await ensureArtifactDir(outputDir, 'uploads');
  const names = await fs.readdir(dir);
  const uploads: UploadArtifact[] = [];

  for (const name of names.filter((item) => item.endsWith('.json'))) {
    const raw = await fs.readFile(join(dir, name), 'utf-8');
    const upload = UploadArtifactSchema.parse(JSON.parse(raw));

    if (upload.analysisId === analysisId) {
      uploads.push(upload);
    }
  }

  return uploads.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}
