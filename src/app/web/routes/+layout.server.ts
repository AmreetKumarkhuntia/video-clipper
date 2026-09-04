import { redirect } from '@sveltejs/kit';
import { backendFetch, backendJson } from '@web/lib/server/backend.js';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { ChannelResponse, MeResponse } from '@lib/types/api.js';

/**
 * The page guard.
 *
 * Root layout loads run for page requests only — never for `/api/*`, never for
 * static or immutable assets — which is why the guard lives here rather than in
 * `hooks.server.ts`, where redirecting would catch assets and risk a loop.
 *
 * Who is signed in comes from the backend over HTTP. This app resolves no
 * session and opens no database; the cookie is forwarded and the answer is
 * whatever `/api/me` says.
 */
const PUBLIC_PATHS = ['/login'];

export async function load({ cookies, url }: ServerLoadEvent) {
  const isPublic = PUBLIC_PATHS.some(
    (path) => url.pathname === path || url.pathname.startsWith(`${path}/`),
  );

  const customer = await currentCustomer(cookies);

  if (!customer && !isPublic) {
    const returnTo = `${url.pathname}${url.search}`;
    throw redirect(302, `/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  // Signing in again from the login page should not strand the customer there.
  if (customer && url.pathname === '/login') {
    throw redirect(302, '/');
  }

  return { customer, channelTitle: customer ? await linkedChannelTitle(cookies) : null };
}

/**
 * A 401 is the ordinary signed-out answer, so it resolves to null rather than
 * throwing. Anything else — the backend down, a 500 — throws, because rendering
 * the login page over a backend outage would tell the customer they are signed
 * out when nobody knows whether they are.
 */
async function currentCustomer(cookies: ServerLoadEvent['cookies']) {
  const res = await backendFetch('/api/me', cookies);
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`The backend could not be reached (${res.status}).`);

  const body = (await res.json()) as MeResponse;
  return body.customer;
}

/** Decoration for the topbar chip. A failure here must not block the page. */
async function linkedChannelTitle(cookies: ServerLoadEvent['cookies']): Promise<string | null> {
  try {
    return (await backendJson<ChannelResponse>('/api/channel', cookies)).title || null;
  } catch {
    return null;
  }
}
