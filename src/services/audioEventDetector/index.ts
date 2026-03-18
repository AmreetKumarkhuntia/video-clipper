/**
 * @deprecated
 *
 * This module is a backward-compatibility shim.
 *
 * All audio detection logic has moved to:
 *   - src/services/audioAnalyzers/   (GeminiAudioAnalyzer, WhisperAudioAnalyzer, YAMNetAudioAnalyzer)
 *   - src/services/eventDetector/    (EventDetector — ordered fallback chain)
 *
 * `normalizeGeminiTime` is re-exported here so existing tests keep passing
 * without needing an import path change.
 */
export { normalizeGeminiTime } from '../audioAnalyzers/gemini.js';
