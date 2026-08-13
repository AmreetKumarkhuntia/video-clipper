import fs from 'node:fs';
import path from 'node:path';
import { getUserConfigDir } from '@lib/utils/paths.js';

const CONFIG_FILE_NAME = 'config.json';

export function getConfigDir(): string {
  return getUserConfigDir();
}

export function getConfigFilePath(): string {
  return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

export function loadUserConfig(): Record<string, unknown> | null {
  const filePath = getConfigFilePath();
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function saveUserConfig(values: Record<string, unknown>): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = getConfigFilePath();
  const tmpPath = filePath + '.tmp';

  fs.writeFileSync(tmpPath, JSON.stringify(values, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath);
}
