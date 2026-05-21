import { Model, defineTool } from '@lib/services/modelFactory/index.js';
import { log } from '@lib/utils/logger.js';
import type { Config } from '@lib/types/config.js';
import {
  PlanSubtitlesResultSchema,
  type PlannedSubtitleLine,
  type PlanSubtitlesRequest,
  type PlanSubtitlesResult,
} from '@app/web/types/subtitlePlan.js';

const DEFAULT_SUBTITLE_PLAN_SYSTEM_PROMPT = `You are an expert subtitle editor. You receive a list of subtitle lines from auto-captions, each with startSec, endSec, text, and per-word timings.

Return a corrected version that:
1. Regroups text into readable lines (≤ ~7 words or ~42 chars, no mid-clause splits, no orphan words).
2. Fixes spacing, punctuation, capitalization, and removes artifacts like [Music], >>, --.
3. Corrects obvious misspellings, especially proper nouns. Never invent facts.
4. Adjusts each line's startSec/endSec and per-word timings for readability. Words must be in order and non-overlapping within a line. Each word's endSec must be strictly greater than its startSec; do not collapse multiple words to the same instant.

Constraints:
- Total span (first startSec … last endSec) must stay within [0, durationSec].
- Preserve the original meaning. Do not translate. Do not add lines not in the source.
- Always populate the words array with one entry per word in text.`;

export async function planSubtitles(
  req: PlanSubtitlesRequest,
  cfg: Config,
  requestId?: string,
): Promise<PlanSubtitlesResult> {
  const done = log.fnCalled('planSubtitles', requestId, { lines: req.subtitles.length });

  const model = new Model({
    provider: cfg.LLM_PROVIDER,
    model: cfg.LLM_MODEL,
    apiKeys: {
      ZAI_API_KEY: cfg.ZAI_API_KEY,
      OPENROUTER_API_KEY: cfg.OPENROUTER_API_KEY,
      CUSTOM_OPENAI_BASE_URL: cfg.CUSTOM_OPENAI_BASE_URL,
      CUSTOM_OPENAI_API_KEY: cfg.CUSTOM_OPENAI_API_KEY,
    },
  });
  log.info(
    'planSubtitles',
    `[subtitle-plan] model=${cfg.LLM_PROVIDER}/${cfg.LLM_MODEL} lines=${req.subtitles.length}`,
    requestId,
  );

  const effectiveSystemPrompt =
    cfg.SUBTITLE_PLAN_SYSTEM_PROMPT ?? DEFAULT_SUBTITLE_PLAN_SYSTEM_PROMPT;

  const prompt = buildPlanPrompt(req);

  log.info('planSubtitles', `[subtitle-plan] prompt built`, requestId, {
    system: effectiveSystemPrompt,
    prompt,
  });

  const t0 = Date.now();
  const result = await model.generateText({
    system: effectiveSystemPrompt,
    prompt,
    tools: {
      register_planned_subtitles: defineTool({
        description: 'Register the corrected subtitle lines',
        inputSchema: PlanSubtitlesResultSchema,
      }),
    },
    toolChoice: { type: 'tool', toolName: 'register_planned_subtitles' },
    maxRetries: cfg.LLM_MAX_RETRIES,
  });

  log.info(
    'planSubtitles',
    `[subtitle-plan] toolCalls=${result.toolCalls.length} finishReason=${result.finishReason} (${Date.now() - t0}ms)`,
    requestId,
  );

  const toolCall = result.toolCalls.find((tc) => tc.toolName === 'register_planned_subtitles');
  if (!toolCall) {
    const names = result.toolCalls.map((tc) => tc.toolName).join(', ') || 'none';
    log.error(
      'planSubtitles',
      `[subtitle-plan] no register_planned_subtitles call — toolCalls=[${names}] finishReason=${result.finishReason}`,
      requestId,
    );
    throw new Error('No subtitles registered: model did not call register_planned_subtitles');
  }

  const planned = PlanSubtitlesResultSchema.parse(toolCall.input);

  let redistributedLines = 0;
  const normalizedLines = planned.lines.map((line) => {
    const next = normalizeWordTimings(line);
    if (next !== line) redistributedLines++;
    return next;
  });
  if (redistributedLines > 0) {
    log.info(
      'planSubtitles',
      `[subtitle-plan] redistributed timings on ${redistributedLines}/${planned.lines.length} lines`,
      requestId,
    );
  }
  const normalized: PlanSubtitlesResult = { ...planned, lines: normalizedLines };

  log.info(
    'planSubtitles',
    `[subtitle-plan] ✓ ${normalized.lines.length} lines returned`,
    requestId,
  );

  done({ lines: normalized.lines.length, normalized });
  return normalized;
}

export function normalizeWordTimings(line: PlannedSubtitleLine): PlannedSubtitleLine {
  const n = line.words.length;
  if (n === 0) return line;

  const clamped = line.words.map((w) => {
    const startSec = Math.min(Math.max(w.startSec, line.startSec), line.endSec);
    const endSec = Math.min(Math.max(w.endSec, startSec), line.endSec);
    return { text: w.text, startSec, endSec };
  });

  let needsRedistribute = false;
  for (let i = 0; i < n; i++) {
    if (clamped[i].endSec <= clamped[i].startSec) {
      needsRedistribute = true;
      break;
    }
    if (i > 0 && clamped[i].startSec < clamped[i - 1].endSec) {
      needsRedistribute = true;
      break;
    }
  }

  if (!needsRedistribute) {
    const unchanged = clamped.every(
      (w, i) => w.startSec === line.words[i].startSec && w.endSec === line.words[i].endSec,
    );
    return unchanged ? line : { ...line, words: clamped };
  }

  const span = Math.max(line.endSec - line.startSec, 0);
  const step = span / n;
  const words = clamped.map((w, i) => ({
    text: w.text,
    startSec: line.startSec + i * step,
    endSec: line.startSec + (i + 1) * step,
  }));
  return { ...line, words };
}

function buildPlanPrompt(req: PlanSubtitlesRequest): string {
  const lines = req.subtitles.map((s) => ({
    startSec: s.startSec,
    endSec: s.endSec,
    text: s.text,
    words: s.words,
  }));

  return `Clip duration: ${req.durationSec.toFixed(2)}s

Current subtitle lines (${lines.length} total):
${JSON.stringify(lines)}

Return corrected subtitles via register_planned_subtitles.`;
}
