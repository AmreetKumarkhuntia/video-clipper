import type { MergedCandidate } from '../../types/index.js';
import type { ChunkEvaluation } from '../../types/index.js';
import type { AudioEvent } from '../../types/index.js';
import { config } from '../../config/index.js';

export function mergeSignals(
  llmSegments: ChunkEvaluation[],
  audioEvents: AudioEvent[],
  boostWindow?: number,
  scoreBoost?: number,
  preRoll?: number,
  postRoll?: number,
): MergedCandidate[] {
  const candidates: MergedCandidate[] = [];
  const windowSec = boostWindow ?? config.AUDIO_LLM_BOOST_WINDOW;
  const boost = scoreBoost ?? config.AUDIO_LLM_SCORE_BOOST;
  const pre = preRoll ?? config.AUDIO_CLIP_PRE_ROLL;
  const post = postRoll ?? config.AUDIO_CLIP_POST_ROLL;

  const successfulSegments = llmSegments.filter((s) => s.status === 'success');

  for (const seg of successfulSegments) {
    if (!seg.interesting) continue;

    const nearby = audioEvents.filter((e) => Math.abs(e.time - seg.clip_start) < windowSec);

    candidates.push({
      start: seg.clip_start,
      end: seg.clip_end,
      score: Math.min(10, seg.score + (nearby.length > 0 ? boost : 0)),
      source: nearby.length > 0 ? 'both' : 'transcript',
      reason: seg.reason,
      audio_event: nearby.length > 0 ? nearby[0].event : undefined,
    });
  }

  for (const evt of audioEvents) {
    const hasLLM = successfulSegments.some((s) => Math.abs(s.clip_start - evt.time) < windowSec);

    if (!hasLLM) {
      candidates.push({
        start: Math.max(0, evt.time - pre),
        end: evt.time + post,
        score: Math.round(evt.confidence * 10),
        source: 'audio',
        reason: `Audio event: ${evt.event} (${(evt.confidence * 100).toFixed(0)}% confidence)`,
        audio_event: evt.event,
      });
    }
  }

  return candidates;
}
