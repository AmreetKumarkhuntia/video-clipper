import { SESSION_COOKIE_NAME } from '@lib/types/api.js';

/**
 * Server-side calls from page loads to the backend.
 *
 * Browser calls stay on relative `/api/...` URLs and reach the backend through
 * the dev proxy, so cookies travel automatically. A page load runs on the server
 * where no proxy sits in front of it, so it needs the backend's real address and
 * has to forward the session cookie itself.
 */
const BACKEND_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:5051';

/** Forwards only the session cookie — a page load has no business replaying the rest. */
export async function backendFetch(
  path: string,
  cookies: { get(name: string): string | undefined },
  init?: RequestInit,
): Promise<Response> {
  const session = cookies.get(SESSION_COOKIE_NAME);
  const headers = new Headers(init?.headers);
  if (session) headers.set('cookie', `${SESSION_COOKIE_NAME}=${session}`);

  return fetch(new URL(path, BACKEND_URL), { ...init, headers });
}

/**
 * Reads JSON from the backend, or throws with the backend's own message so the
 * page shows what actually went wrong rather than a generic failure.
 */
export async function backendJson<T>(
  path: string,
  cookies: { get(name: string): string | undefined },
  init?: RequestInit,
): Promise<T> {
  const res = await backendFetch(path, cookies, init);
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? ((body as { error?: { message?: string } }).error?.message ?? res.statusText)
        : res.statusText;
    throw new Error(message);
  }

  return body as T;
}
