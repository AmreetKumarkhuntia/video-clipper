import { nanoid } from 'nanoid';

const LEVELS = {
  info: '[info]',
  warn: '[warn]',
  error: '[error]',
} as const;

function formatMeta(meta: Record<string, unknown>): string {
  const entries = Object.entries(meta);
  if (entries.length === 0) return '';
  return ' ' + entries.map(([k, v]) => `${k}=${String(v)}`).join(' ');
}

export function generateRequestId(): string {
  return nanoid(24);
}

export const log = {
  info: (msg: string): void => {
    console.log(`${LEVELS.info} ${msg}`);
  },
  warn: (msg: string): void => {
    console.warn(`${LEVELS.warn} ${msg}`);
  },
  error: (msg: string): void => {
    console.error(`${LEVELS.error} ${msg}`);
  },
  progress: (data: Buffer | string): void => {
    const text = String(data);
    const lines = text.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*%)/);
      if (progressMatch) {
        process.stdout.write(`\r${progressMatch[0]}`);
      }
    }
  },
  fnCalled: (
    name: string,
    meta?: Record<string, unknown>,
  ): ((result?: Record<string, unknown>) => void) => {
    const start = Date.now();
    console.log(`[fn →] ${name}${meta ? ` |${formatMeta(meta)}` : ''}`);
    return (result?: Record<string, unknown>): void => {
      const ms = Date.now() - start;
      console.log(
        `[fn ←] ${name} | ${result && Object.keys(result).length ? `${formatMeta(result).trim()} ` : ''}(${ms}ms)`,
      );
    };
  },
  request: (
    method: string,
    path: string,
    requestId: string,
    meta?: Record<string, unknown>,
  ): ((status: number) => void) => {
    const start = Date.now();
    console.log(`${requestId} [api] [call] | ${method} ${path}${meta ? formatMeta(meta) : ''}`);
    return (status: number): void => {
      const ms = Date.now() - start;
      console.log(`${requestId} [api] [res]  | ${method} ${path} ${status} (${ms}ms)`);
    };
  },
};
