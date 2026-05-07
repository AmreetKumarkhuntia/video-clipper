import 'dotenv/config';
import {
  ConfigSchema,
  type Config,
  CONFIG_FIELD_META,
  type SetConfigResult,
} from '@lib/types/config.js';
import { loadUserConfig, saveUserConfig } from '@lib/config/fileStore.js';

function loadConfig(): Config {
  const envSource: Record<string, unknown> = { ...process.env };
  const userConfig = loadUserConfig();

  const merged: Record<string, unknown> = { ...envSource };
  if (userConfig) {
    for (const [key, value] of Object.entries(userConfig)) {
      if (value !== undefined && value !== '') {
        merged[key] = value;
      }
    }
  }

  const result = ConfigSchema.safeParse(merged);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`[error] Invalid configuration:\n${issues}`);
    process.exit(1);
  }

  return result.data;
}

let _config: Config = loadConfig();

export function getConfig(): Config {
  return _config;
}

export const config: Config = new Proxy({} as Config, {
  get(_target, prop: string) {
    return (_config as Record<string, unknown>)[prop];
  },
});

export function setConfigValues(updates: Record<string, unknown>): SetConfigResult {
  const warnings: string[] = [];

  const currentFile = loadUserConfig() ?? {};
  const merged = { ...currentFile };

  for (const [key, value] of Object.entries(updates)) {
    if (value === '' || value === null || value === undefined) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }

  const envSource: Record<string, unknown> = { ...process.env };
  const fullMerged = { ...envSource, ...merged };

  const result = ConfigSchema.safeParse(fullMerged);
  if (!result.success) {
    throw result.error;
  }

  _config = result.data;
  saveUserConfig(merged);

  return { success: true, warnings };
}

export function getMaskedConfig(): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(_config as Record<string, unknown>)) {
    const meta = CONFIG_FIELD_META[key];
    if (meta?.secret) {
      const str = typeof value === 'string' ? value : '';
      if (str.length > 8) {
        values[key] = {
          hasValue: true,
          masked: `${str.slice(0, 4)}...${'*'.repeat(4)}`,
        };
      } else if (str.length > 0) {
        values[key] = { hasValue: true, masked: '*'.repeat(str.length) };
      } else {
        values[key] = { hasValue: false, masked: '' };
      }
    } else {
      values[key] = value;
    }
  }
  return values;
}
