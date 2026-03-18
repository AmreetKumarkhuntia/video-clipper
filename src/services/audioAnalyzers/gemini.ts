import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import { z } from 'zod';
import { config } from '../../config/index.js';
import { log } from '../../utils/logger.js';
import type { AudioEvent } from '../../types/index.js';
import { AudioAnalyzer } from './base.js';

const GeminiEventSchema = z.array(
  z.object({
    // Gemini inconsistently returns timestamps in either:
    //   - MM.SS notation: 1.03 = 1 min 3 sec = 63s
    //   - True decimal seconds: 53.403 = 53.403s
    // Use normalizeGeminiTime() to resolve the correct value.
    time_sec: z.number(),
    event: z.string(),
    confidence: z.number().min(0).max(1),
  }),
);

const GAME_PROFILE_PROMPTS: Record<string, string> = {
  valorant:
    'You are analyzing audio from a Valorant gaming video. Identify ALL significant game events: kills, deaths, explosions, ability uses, spike plants/defuses, ace moments, clutch situations, crowd reactions, hype moments.',
  fps: 'You are analyzing audio from an FPS gaming video. Identify ALL significant game events: kills, deaths, explosions, weapon fire, headshot sounds, kill streaks, crowd reactions, battle cries.',
  boss_fight:
    'You are analyzing audio from a boss fight video. Identify ALL significant game events: boss phase transitions, big hits, explosions, boss death, crowd cheering, epic moments, victory sounds.',
  general:
    'You are analyzing audio from a gaming video. Identify ALL significant audio events: explosions, gunshots, crowd reactions, cheering, epic moments, dramatic sounds.',
};

/**
 * Converts a MM.SS-notation value to decimal seconds.
 * e.g. 1.03 → 63, 1.40 → 100
 */
function mmssToSeconds(value: number): number {
  const minutes = Math.floor(value);
  const seconds = Math.round((value % 1) * 100);
  return minutes * 60 + seconds;
}

/**
 * Resolves a Gemini `time_sec` value to true decimal seconds.
 *
 * Gemini inconsistently returns either MM.SS notation (e.g. 1.03 meaning 63s)
 * or true decimal seconds (e.g. 53.403). This function disambiguates using
 * the known chunk duration:
 *
 * 1. If the fractional part > 0.59, it cannot be a seconds component (seconds
 *    only go 0-59), so it must be true decimal seconds — use as-is.
 * 2. Otherwise, check if the MM.SS conversion produces a value within the
 *    valid chunk range [0, chunkDurationSec). If yes, treat as MM.SS.
 * 3. Fallback: use the value as true decimal seconds (the format we asked for).
 *
 * YAMNet always returns true decimal seconds and does NOT use this function.
 */
export function normalizeGeminiTime(value: number, chunkDurationSec: number): number {
  const frac = value % 1;

  // Fractional part > 0.59 is impossible in MM.SS — must be decimal seconds
  if (Math.round(frac * 100) > 59) {
    return value;
  }

  // Fractional part ≤ 0.59: could be MM.SS — check if converted value fits in chunk
  const mmss = mmssToSeconds(value);
  if (mmss < chunkDurationSec) {
    return mmss;
  }

  // MM.SS conversion overflows the chunk — must be true decimal seconds
  return value;
}

/**
 * Uses Google Gemini's multimodal API to detect audio events in a WAV slice.
 * Understands game context semantically — best accuracy for gaming content.
 *
 * Requires GOOGLE_GENERATIVE_AI_API_KEY to be set.
 */
export class GeminiAudioAnalyzer extends AudioAnalyzer {
  readonly source = 'gemini' as const;

  async detect(
    audioPath: string,
    gameProfile: string,
    chunkOffsetSec: number,
    chunkDurationSec: number,
  ): Promise<AudioEvent[]> {
    const genai = new GoogleGenerativeAI(config.GOOGLE_GENERATIVE_AI_API_KEY!);
    const model = genai.getGenerativeModel({ model: config.AUDIO_GEMINI_MODEL });

    const audioData = fs.readFileSync(audioPath);
    const base64Audio = audioData.toString('base64');

    const extraInstructions = config.AUDIO_EXTRA_INSTRUCTIONS
      ? `\nAdditional instructions:\n${config.AUDIO_EXTRA_INSTRUCTIONS}\n`
      : '';

    const prompt = `${GAME_PROFILE_PROMPTS[gameProfile] ?? GAME_PROFILE_PROMPTS.general} ${extraInstructions}

For each event, return a JSON object with:
- time_sec: the time in seconds (be very precise with the timestamp, Gemini is good at this when the format is correct)
- event: a short description of the event (e.g., "gunshot", "explosion", "clutch moment")
- confidence: your confidence level (0.0 to 1.0)

Return ONLY a JSON array, no explanation. Format:
[
  {"time_sec": 12.5, "event": "gunshot", "confidence": 0.8},
  {"time_sec": 45.2, "event": "explosion", "confidence": 0.9}
]`;

    const result = await model.generateContent([
      { inlineData: { mimeType: 'audio/wav', data: base64Audio } },
      prompt,
    ]);

    const text = result.response.text();
    log.info(`[audio:gemini] response: ${text}`);

    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    const parsed = GeminiEventSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      throw new Error(`Gemini response failed validation: ${parsed.error.message}`);
    }

    return parsed.data.map((e) => ({
      time: normalizeGeminiTime(e.time_sec, chunkDurationSec) + chunkOffsetSec,
      event: e.event,
      confidence: e.confidence,
      source: this.source,
    }));
  }
}
