import type { ClipCandidate } from '@app/web/types/analysis.js';
import type { RankedSegment, TranscriptLine } from '@lib/types/index.js';

export function toClipCandidate(
  videoId: string,
  segment: RankedSegment,
  lines: TranscriptLine[],
): ClipCandidate {
  return {
    id: `${videoId}-rank-${segment.rank}`,
    rank: segment.rank,
    startSec: segment.start,
    endSec: segment.end,
    score: segment.score,
    reason: segment.reason,
    source: segment.source,
    audioEvent: segment.audio_event,
    transcriptExcerpt: excerptForSegment(lines, segment.start, segment.end),
    selected: true,
  };
}

export function excerptForSegment(
  lines: TranscriptLine[],
  startSec: number,
  endSec: number,
): string {
  const text = lines
    .filter((line) => line.start >= Math.max(0, startSec - 3) && line.start <= endSec + 3)
    .map((line) => line.text)
    .join(' ')
    .trim();

  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}
