import { nanoid } from 'nanoid';

// Read directly from process.env — avoids circular import with config module.
const COLOR_ENABLED = process.env['LOG_COLOR'] !== 'false';

const C = {
  reset: COLOR_ENABLED ? '\x1b[0m' : '',
  dim: COLOR_ENABLED ? '\x1b[2m' : '',
  cyan: COLOR_ENABLED ? '\x1b[36m' : '',
  blue: COLOR_ENABLED ? '\x1b[34m' : '',
  green: COLOR_ENABLED ? '\x1b[32m' : '',
  yellow: COLOR_ENABLED ? '\x1b[33m' : '',
  red: COLOR_ENABLED ? '\x1b[31m' : '',
  magenta: COLOR_ENABLED ? '\x1b[35m' : '',
};

function getTimestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `[${h}:${m}:${s}.${ms}]`;
}

function buildLine(
  fn: string,
  levelColor: string,
  levelLabel: string,
  msg: string,
  requestId?: string,
  meta?: Record<string, unknown>,
): string {
  const ts = `${C.dim}${getTimestamp()}${C.reset}`;
  const rid = `${C.cyan}${requestId ?? '-'}${C.reset}`;
  const fnPart = `${C.blue}${fn}${C.reset}`;
  const label = `${levelColor}${levelLabel}${C.reset}`;
  const metaPart =
    meta && Object.keys(meta).length > 0 ? ` ${C.dim}${JSON.stringify(meta)}${C.reset}` : '';
  return `${ts} | ${rid} | ${fnPart} | ${label} ${msg}${metaPart}`;
}

export function generateRequestId(): string {
  return nanoid(24);
}

export const log = {
  info: (fn: string, msg: string, requestId?: string, meta?: Record<string, unknown>): void => {
    console.log(buildLine(fn, C.green, 'info', msg, requestId, meta));
  },

  warn: (fn: string, msg: string, requestId?: string, meta?: Record<string, unknown>): void => {
    console.warn(buildLine(fn, C.yellow, 'warn', msg, requestId, meta));
  },

  error: (fn: string, msg: string, requestId?: string, meta?: Record<string, unknown>): void => {
    console.error(buildLine(fn, C.red, 'error', msg, requestId, meta));
  },

  /**
   * Logs a yt-dlp / ffmpeg progress stream chunk.
   * Splits on \r and \n so yt-dlp in-place progress lines become separate log lines.
   */
  progress: (fn: string, data: Buffer | string, requestId?: string): void => {
    const text = String(data);
    const lines = text.split(/[\r\n]+/).filter((l) => l.trim());
    for (const l of lines) {
      console.log(buildLine(fn, C.dim, 'prog', l, requestId));
    }
  },

  /**
   * Logs function entry (fn→) and returns a done-callback that logs exit (fn←)
   * with elapsed time merged into the result object.
   *
   * Signature change from old logger: requestId is now the 2nd argument (not 3rd).
   */
  fnCalled: (
    fn: string,
    requestId?: string,
    meta?: Record<string, unknown>,
  ): ((result?: Record<string, unknown>) => void) => {
    const start = Date.now();
    console.log(buildLine(fn, C.magenta, 'fn\u2192', '', requestId, meta));
    return (result?: Record<string, unknown>): void => {
      const elapsedMs = Date.now() - start;
      const resultWithElapsed = { ...(result ?? {}), elapsedMs };
      console.log(buildLine(fn, C.magenta, 'fn\u2190', '', requestId, resultWithElapsed));
    };
  },

  /**
   * Logs HTTP request entry (req→) and returns a done-callback that logs
   * exit (req←) with status and elapsed time.
   */
  request: (
    method: string,
    path: string,
    requestId?: string,
    meta?: Record<string, unknown>,
  ): ((status: number) => void) => {
    const start = Date.now();
    const fn = `${method} ${path}`;
    console.log(buildLine(fn, C.magenta, 'req\u2192', '', requestId, meta));
    return (status: number): void => {
      const elapsedMs = Date.now() - start;
      console.log(buildLine(fn, C.magenta, 'req\u2190', '', requestId, { status, elapsedMs }));
    };
  },
};
