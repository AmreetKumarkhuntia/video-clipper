import { promises as fs } from 'fs';
import { join } from 'path';
import { ClipEditsSchema } from '@lib/types/clipEdit.js';
import type { ClipEdits } from '@lib/types/clipEdit.js';
import type { ClipArtifact } from '@app/web/types/analysis.js';
import type { ClipperConfig } from '@lib/types/video.js';
import {
  getClipArtifact,
  updateClipArtifactPaths,
} from '@app/web/lib/services/artifacts/artifactStore.js';
import { renderClipWithEdits } from '@lib/services/video/clipper/editor/renderer.js';

function clipEditsPath(outputDir: string, clipId: string): string {
  return join(outputDir, 'web', 'clip-edits', `${clipId}.json`);
}

export async function loadClipEdits(outputDir: string, clipId: string): Promise<ClipEdits> {
  const filePath = clipEditsPath(outputDir, clipId);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return ClipEditsSchema.parse(JSON.parse(raw));
  } catch (error) {
    const isEnoent =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT';

    if (!isEnoent) throw error;

    const artifact = await getClipArtifact(outputDir, clipId);
    if (!artifact) throw new Error(`Clip artifact not found: ${clipId}`);

    return ClipEditsSchema.parse({
      clipId,
      schemaVersion: 1,
      trim: { startSec: 0, endSec: artifact.durationSec },
      viewport: { preset: '9:16', focus: { xCenter: 0.5, yCenter: 0.5 }, fillMode: 'crop' },
      subtitles: [],
      overlays: [],
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function saveClipEdits(outputDir: string, edits: ClipEdits): Promise<ClipEdits> {
  const withTimestamp = { ...edits, updatedAt: new Date().toISOString() };
  const parsed = ClipEditsSchema.parse(withTimestamp);

  const dir = join(outputDir, 'web', 'clip-edits');
  await fs.mkdir(dir, { recursive: true });

  const filePath = clipEditsPath(outputDir, parsed.clipId);
  await fs.writeFile(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
  await updateClipArtifactPaths(outputDir, parsed.clipId, { editsPath: filePath });

  return parsed;
}

export async function renderEditedClip(
  outputDir: string,
  cfg: ClipperConfig,
  clipId: string,
): Promise<ClipArtifact> {
  const [edits, artifact] = await Promise.all([
    loadClipEdits(outputDir, clipId),
    getClipArtifact(outputDir, clipId),
  ]);

  if (!artifact) throw new Error(`Clip artifact not found: ${clipId}`);

  const editedPath = artifact.path.replace(/\.mp4$/i, '_edited.mp4');
  await renderClipWithEdits(artifact.path, edits, editedPath, cfg);
  return updateClipArtifactPaths(outputDir, clipId, { editedPath });
}
