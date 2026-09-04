import { apiError, errorMessageFrom, isNotFound } from './errors.js';
import type { ApiErrorBody } from '@lib/types/api.js';

/**
 * The CLI's view of the backend.
 *
 * The CLI no longer opens the database or runs orchestration in-process. State
 * lives behind the API, which is what ends two processes writing the same SQLite
 * file. Local media work — yt-dlp and ffmpeg against files on this machine —
 * stays in the CLI, because it needs the user's disk, not the server's.
 */
const DEFAULT_BASE_URL = 'http://localhost:5051';

export function apiBaseUrl(): string {
  return process.env.VIDEO_CLIPPER_API_URL ?? DEFAULT_BASE_URL;
}

/**
 * Set per invocation so a CLI log line and the backend log line for the same
 * call share an id. Without it the two sides cannot be correlated at all.
 */
let currentRequestId: string | undefined;

export function setClientRequestId(requestId: string): void {
  currentRequestId = requestId;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const url = new URL(path, apiBaseUrl());
  try {
    return await fetch(url, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(currentRequestId ? { 'x-request-id': currentRequestId } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (cause) {
    // A refused connection is the common case and deserves an instruction, not
    // a stack trace about sockets.
    throw new Error(
      `Cannot reach the video-clipper backend at ${apiBaseUrl()}. ` +
        `Start it with "pnpm api:dev", or set VIDEO_CLIPPER_API_URL.`,
      { cause },
    );
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return readJson<T>(await request(path));
}

export async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  return readJson<T>(
    await request(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
  );
}

/** Opens a server-sent event stream and yields each event as it arrives. */
export async function* apiStream(
  path: string,
  method: string,
  body: unknown,
): AsyncGenerator<{ event: string; data: unknown }> {
  const res = await request(path, {
    method,
    headers: { accept: 'text/event-stream' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw await apiError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line; a partial tail stays buffered.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const parsed = parseFrame(frame);
      if (parsed) yield parsed;
    }
  }
}

function parseFrame(frame: string): { event: string; data: unknown } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    return { event, data: dataLines.join('\n') };
  }
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw await apiError(res);
  return (await res.json()) as T;
}

export { isNotFound };
export type { ApiErrorBody };
