import { describe, expect, it } from 'vitest';
import { createAnalyzerChain, parseProviderChain } from '@lib/services/audio/analyzer/index.js';
import type { AnalyzerChainConfig } from '@lib/services/audio/analyzer/index.js';

const CONFIG: AnalyzerChainConfig = {
  confidenceThreshold: 0.5,
  whisperModel: 'base',
  gemini: {
    apiKey: 'test-key',
    model: 'gemini-pro',
  },
};

describe('parseProviderChain', () => {
  it.each([
    ['gemini', ['gemini']],
    ['gemini,whisper,yamnet', ['gemini', 'whisper', 'yamnet']],
    [' gemini , whisper ', ['gemini', 'whisper']],
    ['both', ['gemini', 'whisper']],
  ])('parses %j as an ordered provider chain', (input, expected) => {
    expect(parseProviderChain(input)).toEqual(expected);
  });

  it.each([
    ['', 'AUDIO_PROVIDER is empty'],
    ['openai', 'Unknown audio provider "openai"'],
    ['gemini,unknown', 'Unknown audio provider "unknown"'],
  ])('rejects invalid provider chain %j', (input, message) => {
    expect(() => parseProviderChain(input)).toThrow(message);
  });
});

describe('createAnalyzerChain', () => {
  it.each([
    ['gemini', ['GeminiAudioAnalyzer']],
    ['whisper', ['WhisperAudioAnalyzer']],
    ['yamnet', ['YAMNetAudioAnalyzer']],
    ['gemini,whisper', ['GeminiAudioAnalyzer', 'WhisperAudioAnalyzer']],
    ['both', ['GeminiAudioAnalyzer', 'WhisperAudioAnalyzer']],
  ])('creates %j in the declared order', (providers, expectedConstructors) => {
    const chain = createAnalyzerChain(providers, CONFIG);

    expect(chain.map((analyzer) => analyzer.constructor.name)).toEqual(expectedConstructors);
  });
});
