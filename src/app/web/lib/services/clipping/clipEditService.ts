import { createHash } from 'crypto';
import { ClipEditsSchema } from '@lib/types/clipEdit.js';
import type { ClipEdits } from '@lib/types/clipEdit.js';
import type { ClipArtifact } from '@app/web/types/analysis.js';
import type { ClipperConfig } from '@lib/types/video.js';
import {
  getClip,
  getClipRow,
  setClipEdits,
  setClipRender,
} from '@lib/services/db/repos/clipsRepo.js';
import { renderClipWithEdits } from '@lib/services/video/clipper/editor/renderer.js';

/**
 * Compute a structural hash of ClipEdits, excluding `updatedAt` so that
 * saving a timestamp change alone does not mark the render as stale.
 */
export function computeEditsHash(edits: ClipEdits): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { updatedAt: _updatedAt, ...stable } = edits;
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

export async function loadClipEdits(clipId: string): Promise<ClipEdits> {
  const row = getClipRow(clipId);
  if (!row) throw new Error(`Clip artifact not found: ${clipId}`);

  if (row.editsJson) {
    return ClipEditsSchema.parse({ ...JSON.parse(row.editsJson), clipId });
  }

  return ClipEditsSchema.parse({
    clipId,
    schemaVersion: 1,
    trim: { startSec: 0, endSec: row.durationSec },
    viewport: { preset: '9:16', focus: { xCenter: 0.5, yCenter: 0.5 }, fillMode: 'crop' },
    subtitles: [],
    overlays: [],
    updatedAt: new Date().toISOString(),
  });
}

export async function saveClipEdits(edits: ClipEdits): Promise<ClipEdits> {
  const withTimestamp = { ...edits, updatedAt: new Date().toISOString() };
  const parsed = ClipEditsSchema.parse(withTimestamp);

  // Strip clipId before storing (it's redundant with the row id)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { clipId: _clipId, ...stable } = parsed;
  setClipEdits(parsed.clipId, JSON.stringify(stable), computeEditsHash(parsed));

  return parsed;
}

export async function renderEditedClip(cfg: ClipperConfig, clipId: string): Promise<ClipArtifact> {
  const [edits, artifact] = await Promise.all([
    loadClipEdits(clipId),
    Promise.resolve(getClip(clipId)),
  ]);

  if (!artifact) throw new Error(`Clip artifact not found: ${clipId}`);

  const editedPath = artifact.path.replace(/\.mp4$/i, '_edited.mp4');
  await renderClipWithEdits(artifact.path, edits, editedPath, cfg);

  setClipRender(clipId, editedPath, computeEditsHash(edits));
  return getClip(clipId)!;
}
