import type { Config } from '../types/config.js';

const SENSITIVE_KEYS = new Set([
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'XAI_API_KEY',
  'MISTRAL_API_KEY',
  'GROQ_API_KEY',
  'ZAI_API_KEY',
]);

/**
 * Formats the resolved config as a single-line key=value string,
 * omitting all API key fields and any undefined optional values.
 */
export function formatConfig(cfg: Config): string {
  return (Object.entries(cfg) as [string, unknown][])
    .filter(([k]) => !SENSITIVE_KEYS.has(k))
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(' ');
}

/**
 * Converts a duration in seconds to HH:MM:SS string.
 * e.g. 3723 → "01:02:03"
 */
export function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}
