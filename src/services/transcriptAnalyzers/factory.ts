import { log } from '../../utils/logger.js';
import { TranscriptAnalyzer } from './base.js';
import { YtDlpTranscriptAnalyzer } from './ytdlp.js';
import { WhisperTranscriptAnalyzer } from './whisper.js';
import { GeminiTranscriptAnalyzer } from './gemini.js';
import type { TranscriptProviderName } from '../../types/index.js';

const KNOWN_PROVIDERS = new Set<TranscriptProviderName>(['ytdlp', 'whisper', 'gemini']);

/**
 * Parses the TRANSCRIPT_PROVIDER config string into an ordered list of provider names.
 *
 * Accepts a comma-separated list: "ytdlp,whisper" → ['ytdlp', 'whisper']
 * Single values still work:        "ytdlp"         → ['ytdlp']
 */
export function parseTranscriptProviderChain(providerString: string): TranscriptProviderName[] {
  const names = providerString
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (names.length === 0) {
    throw new Error(
      `TRANSCRIPT_PROVIDER is empty. Provide at least one of: ytdlp, whisper, gemini`,
    );
  }

  for (const name of names) {
    if (!KNOWN_PROVIDERS.has(name as TranscriptProviderName)) {
      throw new Error(
        `Unknown transcript provider "${name}". Valid options: ytdlp, whisper, gemini (comma-separated for chain)`,
      );
    }
  }

  return names as TranscriptProviderName[];
}

/**
 * Builds an ordered array of TranscriptAnalyzer instances from a provider chain string.
 *
 * The TranscriptDetector will walk this array in order — if the first analyzer
 * fails, it falls back to the next, and so on.
 *
 * @example
 *   // TRANSCRIPT_PROVIDER=ytdlp,whisper  →  [YtDlpTranscriptAnalyzer, WhisperTranscriptAnalyzer]
 *   const chain = createTranscriptChain(config.TRANSCRIPT_PROVIDER);
 */
export function createTranscriptChain(providerString: string): TranscriptAnalyzer[] {
  const names = parseTranscriptProviderChain(providerString);

  return names.map((name) => {
    switch (name) {
      case 'ytdlp':
        return new YtDlpTranscriptAnalyzer();
      case 'whisper':
        return new WhisperTranscriptAnalyzer();
      case 'gemini':
        log.warn(
          '[transcript] GeminiTranscriptAnalyzer is not yet implemented — ' +
            'it will throw if reached in the chain.',
        );
        return new GeminiTranscriptAnalyzer();
    }
  });
}
