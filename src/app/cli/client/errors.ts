import type { ApiErrorBody } from '@lib/types/api.js';

/**
 * A failed request, carrying the status.
 *
 * Callers that need to tell "this thing does not exist" from "the server is
 * wrong" must not match on message text — the wording is the backend's to
 * change, and a misdirected base URL returning its own 404 would match too.
 */
export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export async function errorMessageFrom(res: Response): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  const message = (body as ApiErrorBody | null)?.error?.message;
  const detail = (body as ApiErrorBody | null)?.error?.detail;
  if (!message) return `Request failed with ${res.status} ${res.statusText}`;
  return detail ? `${message} (${detail})` : message;
}

export async function apiError(res: Response): Promise<ApiRequestError> {
  const message = await errorMessageFrom(res);
  // A 401 from this CLI always has the same fix, so say it here rather than in
  // every command.
  const hint = res.status === 401 ? ' Run "video-clipper login" to sign in.' : '';
  return new ApiRequestError(`${message}${hint}`, res.status);
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404;
}
