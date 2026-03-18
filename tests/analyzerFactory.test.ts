import { describe, it, expect } from 'vitest';
import { parseProviderChain, createAnalyzerChain } from '../src/services/audioAnalyzers/index.js';
import {
  parseTranscriptProviderChain,
  createTranscriptChain,
} from '../src/services/transcriptAnalyzers/index.js';
import { GeminiAudioAnalyzer } from '../src/services/audioAnalyzers/gemini.js';
import { WhisperAudioAnalyzer } from '../src/services/audioAnalyzers/whisper.js';
import { YAMNetAudioAnalyzer } from '../src/services/audioAnalyzers/yamnet.js';
import { YtDlpTranscriptAnalyzer } from '../src/services/transcriptAnalyzers/ytdlp.js';
import { WhisperTranscriptAnalyzer } from '../src/services/transcriptAnalyzers/whisper.js';
import { GeminiTranscriptAnalyzer } from '../src/services/transcriptAnalyzers/gemini.js';

// ---------------------------------------------------------------------------
// Audio analyzer factory
// ---------------------------------------------------------------------------

describe('parseProviderChain (audio)', () => {
  it('parses a single provider', () => {
    expect(parseProviderChain('gemini')).toEqual(['gemini']);
  });

  it('parses a comma-separated chain', () => {
    expect(parseProviderChain('gemini,whisper')).toEqual(['gemini', 'whisper']);
  });

  it('parses all three providers', () => {
    expect(parseProviderChain('gemini,whisper,yamnet')).toEqual(['gemini', 'whisper', 'yamnet']);
  });

  it('trims whitespace around provider names', () => {
    expect(parseProviderChain(' gemini , whisper ')).toEqual(['gemini', 'whisper']);
  });

  it('maps legacy "both" to ["gemini", "whisper"]', () => {
    expect(parseProviderChain('both')).toEqual(['gemini', 'whisper']);
  });

  it('throws on an unknown provider name', () => {
    expect(() => parseProviderChain('openai')).toThrow('Unknown audio provider "openai"');
  });

  it('throws when the string is empty', () => {
    expect(() => parseProviderChain('')).toThrow('AUDIO_PROVIDER is empty');
  });

  it('throws when a chain contains one unknown name', () => {
    expect(() => parseProviderChain('gemini,unknown')).toThrow('Unknown audio provider "unknown"');
  });
});

describe('createAnalyzerChain (audio)', () => {
  it('returns a GeminiAudioAnalyzer for "gemini"', () => {
    const chain = createAnalyzerChain('gemini');
    expect(chain).toHaveLength(1);
    expect(chain[0]).toBeInstanceOf(GeminiAudioAnalyzer);
  });

  it('returns a WhisperAudioAnalyzer for "whisper"', () => {
    const chain = createAnalyzerChain('whisper');
    expect(chain[0]).toBeInstanceOf(WhisperAudioAnalyzer);
  });

  it('returns a YAMNetAudioAnalyzer for "yamnet"', () => {
    const chain = createAnalyzerChain('yamnet');
    expect(chain[0]).toBeInstanceOf(YAMNetAudioAnalyzer);
  });

  it('returns analyzers in the declared order for a two-item chain', () => {
    const chain = createAnalyzerChain('gemini,whisper');
    expect(chain).toHaveLength(2);
    expect(chain[0]).toBeInstanceOf(GeminiAudioAnalyzer);
    expect(chain[1]).toBeInstanceOf(WhisperAudioAnalyzer);
  });

  it('maps legacy "both" to [Gemini, Whisper]', () => {
    const chain = createAnalyzerChain('both');
    expect(chain).toHaveLength(2);
    expect(chain[0]).toBeInstanceOf(GeminiAudioAnalyzer);
    expect(chain[1]).toBeInstanceOf(WhisperAudioAnalyzer);
  });
});

// ---------------------------------------------------------------------------
// Transcript analyzer factory
// ---------------------------------------------------------------------------

describe('parseTranscriptProviderChain', () => {
  it('parses a single provider', () => {
    expect(parseTranscriptProviderChain('ytdlp')).toEqual(['ytdlp']);
  });

  it('parses a comma-separated chain', () => {
    expect(parseTranscriptProviderChain('ytdlp,whisper')).toEqual(['ytdlp', 'whisper']);
  });

  it('trims whitespace around provider names', () => {
    expect(parseTranscriptProviderChain(' ytdlp , whisper ')).toEqual(['ytdlp', 'whisper']);
  });

  it('throws on an unknown provider name', () => {
    expect(() => parseTranscriptProviderChain('openai')).toThrow(
      'Unknown transcript provider "openai"',
    );
  });

  it('throws when the string is empty', () => {
    expect(() => parseTranscriptProviderChain('')).toThrow('TRANSCRIPT_PROVIDER is empty');
  });

  it('throws when a chain contains one unknown name', () => {
    expect(() => parseTranscriptProviderChain('ytdlp,unknown')).toThrow(
      'Unknown transcript provider "unknown"',
    );
  });
});

describe('createTranscriptChain', () => {
  it('returns a YtDlpTranscriptAnalyzer for "ytdlp"', () => {
    const chain = createTranscriptChain('ytdlp');
    expect(chain).toHaveLength(1);
    expect(chain[0]).toBeInstanceOf(YtDlpTranscriptAnalyzer);
  });

  it('returns a WhisperTranscriptAnalyzer for "whisper"', () => {
    const chain = createTranscriptChain('whisper');
    expect(chain[0]).toBeInstanceOf(WhisperTranscriptAnalyzer);
  });

  it('returns a GeminiTranscriptAnalyzer for "gemini"', () => {
    const chain = createTranscriptChain('gemini');
    expect(chain[0]).toBeInstanceOf(GeminiTranscriptAnalyzer);
  });

  it('returns analyzers in the declared order for a two-item chain', () => {
    const chain = createTranscriptChain('ytdlp,whisper');
    expect(chain).toHaveLength(2);
    expect(chain[0]).toBeInstanceOf(YtDlpTranscriptAnalyzer);
    expect(chain[1]).toBeInstanceOf(WhisperTranscriptAnalyzer);
  });

  it('GeminiTranscriptAnalyzer throws when detect() is called (stub)', async () => {
    const chain = createTranscriptChain('gemini');
    await expect(chain[0].detect('abc', null)).rejects.toThrow('not yet implemented');
  });
});
