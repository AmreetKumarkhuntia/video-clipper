import { log } from '../../utils/logger.js';
import { AudioAnalyzer } from './base.js';
import { GeminiAudioAnalyzer } from './gemini.js';
import { WhisperAudioAnalyzer } from './whisper.js';
import { YAMNetAudioAnalyzer } from './yamnet.js';
import type { AudioProviderName } from '../../types/index.js';

const KNOWN_PROVIDERS = new Set<AudioProviderName>(['gemini', 'whisper', 'yamnet']);

/**
 * Parses the AUDIO_PROVIDER config string into an ordered list of provider names.
 *
 * Accepts a comma-separated list: "gemini,whisper" → ['gemini', 'whisper']
 * Single values still work:        "yamnet"         → ['yamnet']
 *
 * Backward-compat: "both" is mapped to ['gemini', 'whisper'] with a deprecation warning.
 */
export function parseProviderChain(providerString: string): AudioProviderName[] {
  if (providerString.trim() === 'both') {
    log.warn(
      '[audio] AUDIO_PROVIDER=both is deprecated. Use AUDIO_PROVIDER=gemini,whisper instead.',
    );
    return ['gemini', 'whisper'];
  }

  const names = providerString
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (names.length === 0) {
    throw new Error(`AUDIO_PROVIDER is empty. Provide at least one of: gemini, whisper, yamnet`);
  }

  for (const name of names) {
    if (!KNOWN_PROVIDERS.has(name as AudioProviderName)) {
      throw new Error(
        `Unknown audio provider "${name}". Valid options: gemini, whisper, yamnet (comma-separated for chain)`,
      );
    }
  }

  return names as AudioProviderName[];
}

/**
 * Builds an ordered array of AudioAnalyzer instances from a provider chain string.
 *
 * The EventDetector will walk this array in order — if the first analyzer fails,
 * it falls back to the next, and so on.
 *
 * @example
 *   // AUDIO_PROVIDER=gemini,whisper  →  [GeminiAudioAnalyzer, WhisperAudioAnalyzer]
 *   const chain = createAnalyzerChain(config.AUDIO_PROVIDER);
 */
export function createAnalyzerChain(providerString: string): AudioAnalyzer[] {
  const names = parseProviderChain(providerString);

  return names.map((name) => {
    switch (name) {
      case 'gemini':
        return new GeminiAudioAnalyzer();
      case 'whisper':
        return new WhisperAudioAnalyzer();
      case 'yamnet':
        return new YAMNetAudioAnalyzer();
    }
  });
}
