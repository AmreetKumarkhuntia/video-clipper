import { randomUUID } from 'crypto';
import type { TranscriptLine } from '@lib/types/transcript.js';
import type { QaMessage, QaAnswer, QaCitation, QaStreamCallbacks } from '@lib/types/qa.js';
import type { Model } from '@lib/services/modelFactory/index.js';

export function buildTranscriptContext(lines: TranscriptLine[]): string {
  return lines.map((l) => `[${l.start.toFixed(1)}s] ${l.text}`).join('\n');
}

// Matches [mm:ss] and [h:mm:ss] patterns.
const CITATION_RE = /\[(\d+:\d{2}(?::\d{2})?)\]/g;

export function parseCitations(text: string): QaCitation[] {
  const seen = new Set<string>();
  const citations: QaCitation[] = [];

  for (const match of text.matchAll(CITATION_RE)) {
    const label = match[0]; // e.g. "[1:23]"
    if (seen.has(label)) continue;
    seen.add(label);

    const parts = match[1].split(':').map(Number);
    let timeSec: number;
    if (parts.length === 2) {
      timeSec = parts[0] * 60 + parts[1];
    } else {
      timeSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    citations.push({ label, timeSec });
  }

  return citations;
}

export interface AnswerQuestionOpts {
  bundle: { lines: TranscriptLine[] };
  question: string;
  history: QaMessage[];
  title?: string;
  channelTitle?: string;
  description?: string;
  model: Model;
  systemPrompt: string;
  callbacks?: QaStreamCallbacks;
  signal?: AbortSignal;
  requestId?: string;
}

export async function answerQuestion(opts: AnswerQuestionOpts): Promise<QaAnswer> {
  const {
    bundle,
    question,
    history,
    title,
    channelTitle,
    description,
    model,
    systemPrompt,
    callbacks,
    signal,
  } = opts;

  // Build system prompt: title/channel/description prefix + QA instructions + transcript
  const contextLines: string[] = [];
  if (title) contextLines.push(`Video title: ${title}`);
  if (channelTitle) contextLines.push(`Channel: ${channelTitle}`);
  if (description) {
    const trimmed = description.trim().slice(0, 500);
    contextLines.push(
      `Video description (supporting context — transcript is primary):\n${trimmed}`,
    );
  }

  const transcriptContext = buildTranscriptContext(bundle.lines);
  const system = [
    ...contextLines,
    contextLines.length > 0 ? '' : null,
    systemPrompt,
    '',
    'Transcript (with timestamps):',
    transcriptContext,
  ]
    .filter((l) => l !== null)
    .join('\n');

  // Map history to AI SDK message format
  const messages = [
    ...history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: question },
  ];

  callbacks?.onStarted?.();

  const result = model.streamText({ system, messages, abortSignal: signal });

  let fullText = '';
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      fullText += part.text;
      callbacks?.onProgress?.(part.text);
    }
  }

  const citations = parseCitations(fullText);
  const answer: QaAnswer = {
    messageId: randomUUID(),
    content: fullText,
    citations,
  };

  callbacks?.onComplete?.(answer);
  return answer;
}
