import { describe, it, expect } from 'vitest';
import { groupConfig } from '../src/lib/config/groups.js';
import { ConfigSchema, CONFIG_GROUP_PREFIXES } from '../src/lib/types/config.js';
import type { Config } from '../src/lib/types/config.js';

/**
 * The grouped view is derived, not declared. These lock that in: whatever the
 * schema holds, the groups hold the same values under shortened names, and no
 * key is dropped or duplicated on the way.
 */

// The schema requires a key for the default provider; everything else defaults.
const cfg: Config = ConfigSchema.parse({ OPENAI_API_KEY: 'test-key' });

/** Longest prefix wins, so YT_DLP_* must not be claimed by a shorter YT_* group. */
function expectedPrefix(key: string): string | null {
  const matches = CONFIG_GROUP_PREFIXES.filter((p) => key.startsWith(`${p}_`));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

describe('grouped config', () => {
  it('puts every prefixed key in its group under the shortened name', () => {
    const grouped = groupConfig(cfg) as unknown as Record<string, Record<string, unknown>>;

    for (const [key, value] of Object.entries(cfg)) {
      const prefix = expectedPrefix(key);
      if (!prefix) continue;
      const short = key.slice(prefix.length + 1);
      expect(grouped[prefix], `${key} should land in ${prefix}`).toHaveProperty(short);
      expect(grouped[prefix]![short]).toEqual(value);
    }
  });

  it('loses nothing: every grouped entry maps back to a real config key', () => {
    const grouped = groupConfig(cfg) as unknown as Record<string, Record<string, unknown>>;

    for (const [prefix, fields] of Object.entries(grouped)) {
      for (const short of Object.keys(fields)) {
        expect(cfg, `${prefix}.${short} should exist as ${prefix}_${short}`).toHaveProperty(
          `${prefix}_${short}`,
        );
      }
    }
  });

  it('gives YT_DLP keys to YT_DLP, not to a shorter prefix', () => {
    const grouped = groupConfig(cfg);

    expect(grouped.YT_DLP).toHaveProperty('QUIET');
    expect(grouped.YT_DLP).toHaveProperty('RETRY_COUNT');
    expect(grouped.YT_DEFAULT).toHaveProperty('PRIVACY');
    expect(grouped.YT_DLP).not.toHaveProperty('DLP_QUIET');
  });

  it('collects the whole Google credential set in one place', () => {
    const { GOOGLE } = groupConfig({
      ...cfg,
      GOOGLE_OAUTH_CLIENT_ID: 'id',
      GOOGLE_OAUTH_CLIENT_SECRET: 'secret',
      GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:5002/api/auth/google/callback',
      GOOGLE_GENERATIVE_AI_API_KEY: 'gemini-key',
    });

    expect(GOOGLE.OAUTH_CLIENT_ID).toBe('id');
    expect(GOOGLE.OAUTH_CLIENT_SECRET).toBe('secret');
    // The Gemini key is a Google credential too, so it belongs to the same group.
    expect(GOOGLE.GENERATIVE_AI_API_KEY).toBe('gemini-key');
  });

  it('carries only the keys that are set, as the flat config does', () => {
    // An unset optional key is absent from the parse, so it is absent from its
    // group too — the grouped view never invents a key the config does not have.
    expect(groupConfig(cfg).GOOGLE).not.toHaveProperty('OAUTH_CLIENT_ID');
  });

  it('leaves ungrouped keys off the groups entirely', () => {
    const grouped = groupConfig(cfg) as unknown as Record<string, Record<string, unknown>>;
    const everyShortName = Object.values(grouped).flatMap((fields) => Object.keys(fields));

    // SCORE_THRESHOLD and OUTPUT_DIR match no prefix and stay on flat Config.
    expect(everyShortName).not.toContain('SCORE_THRESHOLD');
    expect(everyShortName).not.toContain('OUTPUT_DIR');
  });
});
