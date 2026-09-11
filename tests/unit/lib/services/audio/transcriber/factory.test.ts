import { describe, expect, it } from 'vitest';
import {
  createTranscriptChain,
  parseTranscriptProviderChain,
} from '@lib/services/audio/transcriber/index.js';
import type { TranscriptChainConfig } from '@lib/services/audio/transcriber/index.js';

const CONFIG: TranscriptChainConfig = {
  whisperModel: 'base',
};

describe('parseTranscriptProviderChain', () => {
  it.each([
    ['ytdlp', ['ytdlp']],
    ['ytdlp,whisper', ['ytdlp', 'whisper']],
    [' ytdlp , whisper ', ['ytdlp', 'whisper']],
  ])('parses %j as an ordered provider chain', (input, expected) => {
    expect(parseTranscriptProviderChain(input)).toEqual(expected);
  });

  it.each([
    ['', 'TRANSCRIPT_PROVIDER is empty'],
    ['openai', 'Unknown transcript provider "openai"'],
    ['ytdlp,unknown', 'Unknown transcript provider "unknown"'],
  ])('rejects invalid provider chain %j', (input, message) => {
    expect(() => parseTranscriptProviderChain(input)).toThrow(message);
  });
});

describe('createTranscriptChain', () => {
  it.each([
    ['ytdlp', ['YtDlpTranscriptAnalyzer']],
    ['whisper', ['WhisperTranscriptAnalyzer']],
    ['gemini', ['GeminiTranscriptAnalyzer']],
    ['ytdlp,whisper', ['YtDlpTranscriptAnalyzer', 'WhisperTranscriptAnalyzer']],
  ])('creates %j in the declared order', (providers, expectedConstructors) => {
    const chain = createTranscriptChain(providers, CONFIG);

    expect(chain.map((analyzer) => analyzer.constructor.name)).toEqual(expectedConstructors);
  });
});
