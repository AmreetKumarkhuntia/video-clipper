import { generateText, tool } from 'ai';
import { getModel } from '@lib/utils/modelFactory.js';
import { log } from '@lib/utils/logger.js';
import type { Config } from '@lib/types/config.js';
import {
  PlanSubtitlesResultSchema,
  type PlanSubtitlesRequest,
  type PlanSubtitlesResult,
} from '@app/web/types/subtitlePlan.js';

const DEFAULT_SUBTITLE_PLAN_SYSTEM_PROMPT = `You are an expert subtitle editor. You receive a list of subtitle lines from auto-captions, each with startSec, endSec, text, and per-word timings.

Return a corrected version that:
1. Regroups text into readable lines (≤ ~7 words or ~42 chars, no mid-clause splits, no orphan words).
2. Fixes spacing, punctuation, capitalization, and removes artifacts like [Music], >>, --.
3. Corrects obvious misspellings, especially proper nouns. Never invent facts.
4. Adjusts each line's startSec/endSec and per-word timings for readability. Words must be in order and non-overlapping within a line.

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

  const model = getModel(cfg.LLM_PROVIDER, cfg.LLM_MODEL, {
    ZAI_API_KEY: cfg.ZAI_API_KEY,
    OPENROUTER_API_KEY: cfg.OPENROUTER_API_KEY,
    CUSTOM_OPENAI_BASE_URL: cfg.CUSTOM_OPENAI_BASE_URL,
    CUSTOM_OPENAI_API_KEY: cfg.CUSTOM_OPENAI_API_KEY,
  });
  log.info(
    'planSubtitles',
    `[subtitle-plan] model=${cfg.LLM_PROVIDER}/${cfg.LLM_MODEL} lines=${req.subtitles.length}`,
    requestId,
  );

  const effectiveSystemPrompt =
    cfg.SUBTITLE_PLAN_SYSTEM_PROMPT ?? DEFAULT_SUBTITLE_PLAN_SYSTEM_PROMPT;

  const prompt = buildPlanPrompt(req);

  const t0 = Date.now();
  const result = await generateText({
    model,
    system: effectiveSystemPrompt,
    prompt,
    tools: {
      register_planned_subtitles: tool({
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
  log.info('planSubtitles', `[subtitle-plan] ✓ ${planned.lines.length} lines returned`, requestId);

  done({ lines: planned.lines.length });
  return planned;
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
${JSON.stringify(lines, null, 2)}

Return corrected subtitles via register_planned_subtitles.`;
}
