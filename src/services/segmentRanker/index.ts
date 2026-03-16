import type { MergedCandidate, RankedSegment } from '../../types/index.js';

function overlapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}

function significantlyOverlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  aSource: string,
  bSource: string,
): boolean {
  const overlap = overlapSeconds(aStart, aEnd, bStart, bEnd);
  if (overlap === 0) return false;

  const aDuration = aEnd - aStart;
  const bDuration = bEnd - bStart;

  const isAudioSource = aSource === 'audio' || bSource === 'audio';

  if (isAudioSource) {
    return overlap > 8;
  }

  return overlap / aDuration > 0.5 || overlap / bDuration > 0.5;
}

function deduplicateSegments(
  segments: Array<{
    start: number;
    end: number;
    score: number;
    reason: string;
    source: string;
    audio_event?: string;
  }>,
): Array<{
  start: number;
  end: number;
  score: number;
  reason: string;
  source: string;
  audio_event?: string;
}> {
  const kept: typeof segments = [];

  for (const candidate of segments) {
    const dominated = kept.some((existing) =>
      significantlyOverlaps(
        existing.start,
        existing.end,
        candidate.start,
        candidate.end,
        existing.source,
        candidate.source,
      ),
    );
    if (!dominated) {
      kept.push(candidate);
    }
  }

  return kept;
}

export function rankSegments(
  segments: MergedCandidate[],
  threshold: number,
  topN: number,
): RankedSegment[] {
  const filtered = segments.filter((s) => s.score >= threshold).sort((a, b) => b.score - a.score);

  const deduped = deduplicateSegments(filtered);

  return deduped.slice(0, topN).map((s, i) => ({
    rank: i + 1,
    start: s.start,
    end: s.end,
    score: s.score,
    reason: s.reason,
    source: s.source as 'transcript' | 'audio' | 'both',
    audio_event: s.audio_event,
  }));
}
