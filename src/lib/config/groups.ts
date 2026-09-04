import { CONFIG_GROUP_PREFIXES } from '@lib/types/config.js';
import type { Config, ConfigGroupPrefix, GroupedConfig } from '@lib/types/config.js';

/**
 * Turns the flat config into the grouped view.
 *
 * One pass over the parsed config, so there is no per-group list of field names
 * to maintain — the schema is the only place a key is declared.
 */

/**
 * Longest prefix wins: `YT_DLP_QUIET` matches both `YT_DLP` and nothing else
 * today, but the rule is what keeps a future short prefix from swallowing a
 * longer one's keys.
 */
function groupFor(key: string): ConfigGroupPrefix | null {
  let winner: ConfigGroupPrefix | null = null;
  for (const prefix of CONFIG_GROUP_PREFIXES) {
    if (key.startsWith(`${prefix}_`) && (!winner || prefix.length > winner.length)) {
      winner = prefix;
    }
  }
  return winner;
}

export function groupConfig(cfg: Config): GroupedConfig {
  const grouped: Record<string, Record<string, unknown>> = {};
  for (const prefix of CONFIG_GROUP_PREFIXES) grouped[prefix] = {};

  for (const [key, value] of Object.entries(cfg)) {
    const prefix = groupFor(key);
    if (prefix) grouped[prefix]![key.slice(prefix.length + 1)] = value;
  }

  return grouped as GroupedConfig;
}
