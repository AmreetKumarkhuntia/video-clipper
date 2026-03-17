import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import { execa } from 'execa';
import { config } from '../../config/index.js';
import { log } from '../../utils/logger.js';
import type { AudioEvent } from '../../types/index.js';

const GAME_PROFILE_PROMPTS: Record<string, string> = {
  valorant:
    'You are analyzing audio from a Valorant gaming video. Identify ALL significant game events: kills, deaths, explosions, ability uses, spike plants/defuses, ace moments, clutch situations, crowd reactions, hype moments.',
  fps: 'You are analyzing audio from an FPS gaming video. Identify ALL significant game events: kills, deaths, explosions, weapon fire, headshot sounds, kill streaks, crowd reactions, battle cries.',
  boss_fight:
    'You are analyzing audio from a boss fight video. Identify ALL significant game events: boss phase transitions, big hits, explosions, boss death, crowd cheering, epic moments, victory sounds.',
  general:
    'You are analyzing audio from a gaming video. Identify ALL significant audio events: explosions, gunshots, crowd reactions, cheering, epic moments, dramatic sounds.',
};

let _pythonBin: string | null = null;

async function getPythonBin(): Promise<string> {
  if (_pythonBin) return _pythonBin;

  for (const bin of ['python3', 'python']) {
    try {
      await execa(bin, ['--version']);
      _pythonBin = bin;
      return bin;
    } catch {
      log.warn(`[audio] ${bin} not found, trying next binary...`);
    }
  }

  log.error(
    '[audio] No Python interpreter found (tried python3, python). Install Python 3 to use YAMNet fallback.',
  );
  throw new Error(
    'No Python interpreter found (tried python3, python). Install Python 3 to use YAMNet fallback.',
  );
}

async function detectEventsGemini(
  audioPath: string,
  gameProfile: string,
  chunkOffsetSec: number,
): Promise<AudioEvent[]> {
  const genai = new GoogleGenerativeAI(config.GOOGLE_GENERATIVE_AI_API_KEY!);
  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const audioData = fs.readFileSync(audioPath);
  const base64Audio = audioData.toString('base64');

  const prompt = `${GAME_PROFILE_PROMPTS[gameProfile] || GAME_PROFILE_PROMPTS.general}

For each event, return a JSON object with:
- time_sec: the time in seconds relative to the START of this audio chunk
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
  console.log(`[audio] Gemini response: ${text}`);
  const events = JSON.parse(text) as Array<{ time_sec: number; event: string; confidence: number }>;

  return events.map((e) => ({
    time: e.time_sec + chunkOffsetSec,
    event: e.event,
    confidence: Math.max(0, Math.min(1, e.confidence)),
    source: 'gemini' as const,
  }));
}

async function detectEventsYAMNet(
  audioPath: string,
  chunkOffsetSec: number,
): Promise<AudioEvent[]> {
  const python = await getPythonBin();

  let stdout: string;
  try {
    const result = await execa(python, [
      'scripts/detect_events.py',
      audioPath,
      String(config.AUDIO_CONFIDENCE_THRESHOLD),
    ]);
    stdout = result.stdout;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('ModuleNotFoundError') || message.includes('No module named')) {
      throw new Error(
        'YAMNet dependencies missing. Run: pip3 install tensorflow-hub soundfile numpy\n' +
          'Or set AUDIO_PROVIDER=gemini in .env and configure GOOGLE_GENERATIVE_AI_API_KEY.',
      );
    }

    throw new Error(`YAMNet detection failed: ${message}`);
  }

  const events = JSON.parse(stdout) as Array<{ time: number; event: string; confidence: number }>;

  return events.map((e) => ({
    time: e.time + chunkOffsetSec,
    event: e.event,
    confidence: e.confidence,
    source: 'yamnet' as const,
  }));
}

export async function detectAudioEvents(
  audioPath: string,
  gameProfile: string,
  chunkOffsetSec: number,
): Promise<AudioEvent[]> {
  const useGemini = config.AUDIO_PROVIDER !== 'yamnet' && config.GOOGLE_GENERATIVE_AI_API_KEY;

  if (useGemini) {
    try {
      const events = await detectEventsGemini(audioPath, gameProfile, chunkOffsetSec);
      console.log(`[audio] Gemini detected ${events.length} events`);
      return events;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[audio] Gemini failed, falling back to YAMNet: ${message}`);
    }
  }

  const events = await detectEventsYAMNet(audioPath, chunkOffsetSec);
  console.log(`[audio] YAMNet detected ${events.length} events`);
  return events;
}
