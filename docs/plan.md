Here's the full updated build plan in markdown:

```markdown
# YouTube Clip Finder — Build Plan v2.0

### with Audio Event Detection

---

## Legend

| Symbol     | Meaning             |
| ---------- | ------------------- |
| ✅ Done    | Already built       |
| 🔧 To Do   | Not built yet       |
| 🆕 New     | Added in v2         |
| ⚡ Upgrade | Existing + extended |

---

## 1. System Architecture

The v2 pipeline adds audio event detection as a parallel signal alongside transcript analysis. Both signals feed into the merger before ranking.
```

User Input (YouTube URL)
│
▼
Module 1 — URL Parser
│
▼
Module 2 — Video Metadata Extractor
│
├─────────────────────────────────┐
▼ ▼
Module 3 — Transcript Fetcher Module 3b — Audio Downloader ★ NEW
│ │
▼ ▼
Module 4 — LLM Chunk Builder Module 3c — Audio Event Detector ★ NEW
│ │
▼ │
Module 5 — LLM Segment Analyzer │
│ │
└──────────────┬──────────────────┘
▼
Module 5b — Signal Merger ★ NEW
│
▼
Module 6 — Segment Ranking ⚡ UPGRADED
│
▼
Module 7 — Clip Refinement Pass
│
▼
Module 8 — Video Downloader
│
▼
Module 9 — Clip Generator (optional)

````

---

## 2. Module Status Overview

| # | Module | Status |
|---|--------|--------|
| 1 | URL Parser | ✅ Done |
| 2 | Video Metadata Extractor | ✅ Done |
| 3 | Transcript Fetcher + Micro-block Grouper | ✅ Done |
| 3b | Audio Downloader (yt-dlp audio-only) | 🆕 New |
| 3c | Audio Event Detector (Gemini primary + YAMNet fallback) | 🆕 New |
| 4 | LLM Chunk Builder | ✅ Done |
| 5 | LLM Segment Analyzer | ✅ Done |
| 5b | Signal Merger (transcript + audio events) | 🆕 New |
| 6 | Segment Ranking | ⚡ Upgrade |
| 7 | Clip Refinement Pass | ✅ Done |
| 8 | Video Downloader | ✅ Done |
| 9 | Clip Generator (ffmpeg) | ✅ Done |

---

## 3. Existing Modules

Modules 1–5 and 7–9 are fully built per v1 spec. No changes required.

---

## 4. New Modules — Audio Event Detection

### Module 3b — Audio Downloader 🆕

**Status: To Do**

Downloads audio-only from YouTube using yt-dlp. Runs in parallel with transcript fetching. Uses 16kHz mono WAV required by YAMNet.

```ts
import { execa } from 'execa';

export async function downloadAudio(videoId: string, outputDir: string): Promise<string> {
  const outputPath = `${outputDir}/${videoId}_audio.wav`;

  if (fs.existsSync(outputPath)) {
    console.log(`[audio] Cache hit: ${outputPath}`);
    return outputPath;
  }

  await execa('yt-dlp', [
    '-x',
    '--audio-format', 'wav',
    '--audio-quality', '0',
    '--postprocessor-args', '-ar 16000 -ac 1',  // 16kHz mono for YAMNet
    '-o', outputPath,
    `https://youtube.com/watch?v=${videoId}`,
  ]);

  return outputPath;
}
````

---

### Module 3c — Audio Event Detector (Gemini primary + Whisper local + YAMNet legacy) 🆕

**Status: To Do**

Three-tier audio event detection. Gemini 1.5 Flash is tried first — understands game context, needs no local setup. If Gemini fails or is disabled, Whisper runs locally: it transcribes the audio chunk and scans the resulting transcript for hype keywords per game profile. YAMNet remains available as a legacy option via `AUDIO_PROVIDER=yamnet`.

|              | Gemini Flash (primary)                   | Whisper (local fallback)                         | YAMNet (legacy)                       |
| ------------ | ---------------------------------------- | ------------------------------------------------ | ------------------------------------- |
| Cost         | ~$0.001/video (free tier: 60/day)        | Free, always                                     | Free, always                          |
| Setup        | Just an API key                          | pip install openai-whisper                       | pip install tensorflow tensorflow-hub |
| Game context | Understands "clutch", "ace", boss phases | Speech transcript + keyword matching per profile | Class IDs only (gunshot, explosion)   |
| Accuracy     | High — semantic understanding            | Medium-high — depends on speech clarity          | Medium — fixed class threshold        |
| Offline      | No                                       | Yes                                              | Yes                                   |

#### Tier 1 — Gemini 1.5 Flash (primary)

```ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';

const genai = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

export async function detectEventsGemini(
  audioPath: string,
  gameProfile: string,
  chunkOffsetSec: number,
): Promise<AudioEvent[]> {
  const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const audioData = fs.readFileSync(audioPath);
  const base64Audio = audioData.toString('base64');

  const prompt = `
    You are analyzing audio from a ${gameProfile} gaming video.
    Identify ALL significant game events: kills, deaths, explosions,
    ability uses, boss phases, crowd reactions, clutch moments.
    For each event return JSON: { time_sec, event, confidence }
    time_sec is relative to the START of this audio chunk.
    Return ONLY a JSON array, no explanation.
  `;

  const result = await model.generateContent([
    { inlineData: { mimeType: 'audio/wav', data: base64Audio } },
    prompt,
  ]);

  const events = JSON.parse(result.response.text());

  // Offset timestamps to absolute video time
  return events.map((e: any) => ({
    ...e,
    time: e.time_sec + chunkOffsetSec,
    source: 'gemini',
  }));
}
```

#### Tier 2 — YAMNet fallback (Python)

```python
import tensorflow_hub as hub
import soundfile as sf
import numpy as np, json, sys

model = hub.load('https://tfhub.dev/google/yamnet/1')

GAME_EVENTS = {
  67: 'gunshot', 366: 'explosion',
  389: 'crowd_cheering', 63: 'gunfire_burst',
}

def detect_events(audio_path, threshold=0.30):
  wav, sr = sf.read(audio_path, dtype='float32')
  scores, _, _ = model(wav)
  events = []
  for i, frame in enumerate(scores.numpy()):
    for cid, label in GAME_EVENTS.items():
      if frame[cid] > threshold:
        events.append({ 'time': round(i * 0.48, 2),
                         'event': label,
                         'confidence': float(frame[cid]),
                         'source': 'yamnet' })
  return cluster_events(events, gap=1.5)

print(json.dumps(detect_events(sys.argv[1], float(sys.argv[2]))))
```

#### Fallback orchestrator (TypeScript)

```ts
export async function detectAudioEvents(
  audioPath: string,
  gameProfile: string,
  chunkOffsetSec: number,
): Promise<AudioEvent[]> {
  // Try Gemini first
  if (config.AUDIO_PROVIDER !== 'yamnet' && config.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      const events = await detectEventsGemini(audioPath, gameProfile, chunkOffsetSec);
      console.log(`[audio] Gemini detected ${events.length} events`);
      return events;
    } catch (err) {
      console.warn('[audio] Gemini failed, falling back to YAMNet:', err.message);
    }
  }

  // Fallback: YAMNet
  const { stdout } = await execa('python', [
    'scripts/detect_events.py',
    audioPath,
    String(config.AUDIO_CONFIDENCE_THRESHOLD),
  ]);
  const events = JSON.parse(stdout) as AudioEvent[];
  console.log(`[audio] YAMNet detected ${events.length} events`);
  return events;
}
```

#### Output format (same shape from both providers)

```json
{
  "time": 142.08,
  "event": "gunshot",
  "confidence": 0.74,
  "source": "gemini"
}
```

---

### Module 5b — Signal Merger 🆕

**Status: To Do**

Merges LLM transcript scores and audio event detections into unified clip candidates.

**Merging logic:**

- Audio event at time T → clip window: `T - 5s` to `T + 15s`
- LLM segment within ±10s of an audio event → score boosted by +2
- Audio event with no nearby LLM signal → still a candidate (score = confidence × 10)
- LLM segment with no audio event → unchanged (existing behavior)

```ts
interface MergedCandidate {
  start: number;
  end: number;
  score: number;
  source: 'transcript' | 'audio' | 'both';
  reason: string;
  audio_event?: string;
}

export function mergeSignals(
  llmSegments: LLMSegment[],
  audioEvents: AudioEvent[],
  boostWindow = 10,
): MergedCandidate[] {
  const candidates: MergedCandidate[] = [];

  // Pass 1: LLM segments (possibly boosted by nearby audio)
  for (const seg of llmSegments) {
    const nearby = audioEvents.filter((e) => Math.abs(e.time - seg.clip_start) < boostWindow);
    candidates.push({
      start: seg.clip_start,
      end: seg.clip_end,
      score: seg.score + (nearby.length > 0 ? 2 : 0),
      source: nearby.length > 0 ? 'both' : 'transcript',
      reason: seg.reason,
      audio_event: nearby[0]?.event,
    });
  }

  // Pass 2: Audio-only events (the gap filler — silent kills, boss deaths)
  for (const evt of audioEvents) {
    const hasLLM = llmSegments.some((s) => Math.abs(s.clip_start - evt.time) < boostWindow);
    if (!hasLLM) {
      candidates.push({
        start: Math.max(0, evt.time - 5),
        end: evt.time + 15,
        score: Math.round(evt.confidence * 10),
        source: 'audio',
        reason: `Audio event: ${evt.event} (${(evt.confidence * 100).toFixed(0)}% confidence)`,
        audio_event: evt.event,
      });
    }
  }

  return candidates;
}
```

---

## 5. Upgraded Modules

### Module 6 — Segment Ranking ⚡

**Status: Upgrade — extend existing ranking to handle MergedCandidate[]**

Changes from v1:

- Input is now `MergedCandidate[]` instead of `LLMSegment[]`
- New `source` field in output: `'transcript'`, `'audio'`, or `'both'`
- Deduplication window widened to ±8s for audio events
- `audio_event` field passed through to final JSON output

---

## 6. New Config Options (.env)

```env
# Audio Event Detection
AUDIO_DETECTION_ENABLED=true        # set false to skip (transcript-only mode)
AUDIO_PROVIDER=both                 # gemini | yamnet | whisper | both (gemini with whisper fallback)
AUDIO_CONFIDENCE_THRESHOLD=0.30     # confidence minimum (0-1); for Whisper: 1.0=exact, 0.8=partial
AUDIO_WHISPER_MODEL=medium          # tiny | base | small | medium | large-v3
AUDIO_CLIP_PRE_ROLL=5               # seconds before event to start clip
AUDIO_CLIP_POST_ROLL=15             # seconds after event to end clip
AUDIO_LLM_BOOST_WINDOW=10           # seconds within which audio boosts LLM score
AUDIO_LLM_SCORE_BOOST=2             # score boost when audio+LLM both signal

# Game Profile
GAME_PROFILE=valorant               # valorant | fps | boss_fight | general
```

---

## 7. Game Profiles 🆕

| Profile    | YAMNet classes boosted                          | LLM keyword hints                    |
| ---------- | ----------------------------------------------- | ------------------------------------ |
| valorant   | gunshot, gunfire_burst, explosion               | ace, clutch, defuse, spike, 1v1      |
| boss_fight | explosion, crowd_cheering, battle_cry           | phase, dead, down, finally, let's go |
| fps        | gunshot, gunfire_burst, explosion, crowd_booing | kill, streak, headshot, collateral   |
| general    | crowd_cheering, applause                        | insane, crazy, no way, let's go      |

---

## 8. Updated Final Output Format

```json
{
  "video_id": "abc123",
  "title": "Valorant ranked grind",
  "duration": 3640,
  "segments": [
    {
      "rank": 1,
      "start": 834,
      "end": 849,
      "score": 9,
      "source": "both",
      "reason": "Ace reaction with hype phrases",
      "audio_event": "gunshot"
    },
    {
      "rank": 2,
      "start": 1205,
      "end": 1220,
      "score": 7,
      "source": "audio",
      "reason": "Audio event: gunshot (81% confidence)",
      "audio_event": "gunshot"
    },
    {
      "rank": 3,
      "start": 420,
      "end": 455,
      "score": 8,
      "source": "transcript",
      "reason": "Funny storytelling moment"
    }
  ]
}
```

---

## 9. New Dependencies

```bash
pip install tensorflow tensorflow-hub soundfile numpy
```

| Package               | Language | Cost      | Purpose                |
| --------------------- | -------- | --------- | ---------------------- |
| tensorflow_hub        | Python   | Free      | Load YAMNet model      |
| soundfile             | Python   | Free      | Read WAV files         |
| numpy                 | Python   | Free      | Score array processing |
| @google/generative-ai | Node     | Free tier | Gemini audio analysis  |

---

## 10. To-Do Checklist

- ✅ Module 1 — URL Parser
- ✅ Module 2 — Video Metadata Extractor
- ✅ Module 3 — Transcript Fetcher + Micro-block Grouper
- ✅ Module 4 — LLM Chunk Builder
- ✅ Module 5 — LLM Segment Analyzer
- ✅ Module 7 — Clip Refinement Pass
- ✅ Module 8 — Video Downloader
- ✅ Module 9 — Clip Generator
- 🆕 Module 3b — Audio Downloader (yt-dlp audio-only, 16kHz mono WAV)
- 🆕 Module 3c — Gemini Flash audio detector (chunked audio + game prompt)
- 🆕 Module 3c — YAMNet fallback (Python script + Node execa caller)
- 🆕 Module 3c — Fallback orchestrator (try Gemini → catch → YAMNet)
- 🆕 Module 5b — Signal Merger (transcript + audio candidates)
- ⚡ Module 6 — Segment Ranking (update to accept MergedCandidate[])
- 🆕 Add AUDIO_PROVIDER env var (gemini | yamnet | both)
- 🆕 Add GAME_PROFILE env var + profile configs
- 🆕 Add all AUDIO\_\* env vars to .env and zod ConfigSchema
- 🆕 Update final JSON output — add source and audio_event fields
- 🆕 Cache audio event results per video ID

```

```
