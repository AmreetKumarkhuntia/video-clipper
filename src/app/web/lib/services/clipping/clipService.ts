import { basename } from 'path';
import { exportClips } from '@lib/pipeline/stages/clipExporter.js';
import {
  createArtifactId,
  saveClipArtifacts,
} from '@app/web/lib/services/artifacts/artifactStore.js';
import type { ClipArtifact, CreateClipsRequest } from '@app/web/types/analysis.js';
import type { RankedSegment } from '@lib/types/index.js';

export async function generateWebClips(input: CreateClipsRequest): Promise<ClipArtifact[]> {
  const segments = input.segments.map(toRankedSegment);
  const paths = await exportClips(input.videoId, segments, {
    downloadSections: 'all',
  });
  const createdAt = new Date().toISOString();

  const artifacts = paths.map((path, index) => {
    const source = input.segments[index];
    const startSec = source.startSec;
    const endSec = source.endSec;

    return {
      id: createArtifactId(`clip-${input.videoId}`),
      videoId: input.videoId,
      analysisId: input.analysisId,
      segmentId: source.id,
      filename: basename(path),
      path,
      startSec,
      endSec,
      durationSec: Math.max(0.01, endSec - startSec),
      createdAt,
    };
  });

  return saveClipArtifacts(artifacts);
}

function toRankedSegment(segment: CreateClipsRequest['segments'][number]): RankedSegment {
  return {
    rank: segment.rank,
    start: segment.startSec,
    end: segment.endSec,
    score: segment.score,
    reason: segment.reason,
    source: segment.source,
    audio_event: segment.audioEvent,
  };
}
