import { Hono } from 'hono';
import { log } from '@lib/utils/logger.js';
import {
  completeGoogleLogin,
  signOut,
  startGoogleLogin,
} from '@lib/orchestration/authOrchestrator.js';
import { toGoogleOAuthConfig, sessionTtlMs } from '../services/appConfig.js';
import {
  clearHandshakeCookies,
  clearSessionCookie,
  readHandshakeCookies,
  readSessionToken,
  sanitizeReturnTo,
  setHandshakeCookies,
  setSessionCookie,
} from '../http/sessionCookies.js';
import { requireCustomer } from '../middleware/session.js';
import { errorMessage } from '../http/responses.js';
import type { ApiEnv } from '../context.js';

/**
 * Sign-in, sign-out, and who is signed in.
 *
 * The two OAuth routes redirect rather than answer with JSON, because the
 * browser walks this flow itself: a top-level GET to Google and a top-level GET
 * back. Everything that can go wrong lands on `/login` with a readable message,
 * since the customer is looking at a page, not a response body.
 */
export const authRoutes = new Hono<ApiEnv>();

function loginWithError(message: string): string {
  return `/login?error=${encodeURIComponent(message)}`;
}

authRoutes.get('/google/start', (c) => {
  const returnTo = sanitizeReturnTo(c.req.query('returnTo'));

  try {
    const { authUrl, handshake } = startGoogleLogin(toGoogleOAuthConfig(c.get('config')), returnTo);
    setHandshakeCookies(c, handshake);
    return c.redirect(authUrl, 302);
  } catch (error) {
    // Missing credentials is an operator setup problem, not a crash. Say so on
    // the login page rather than serving a 500 to the first person who signs in.
    log.warn('api.auth', 'sign-in start failed', c.get('requestId'), {
      reason: errorMessage(error),
    });
    return c.redirect(loginWithError(errorMessage(error)), 302);
  }
});

authRoutes.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const oauthError = c.req.query('error');
  const handshake = readHandshakeCookies(c);

  // Single-use: cleared before branching, so a replayed callback cannot reuse them.
  clearHandshakeCookies(c);

  if (oauthError) {
    return c.redirect(loginWithError(`Google sign-in failed: ${oauthError}`), 302);
  }
  if (!code || !state || !handshake.state || !handshake.codeVerifier || state !== handshake.state) {
    return c.redirect(loginWithError('Sign-in could not be verified. Please try again.'), 302);
  }

  try {
    const result = await completeGoogleLogin(
      code,
      { state, codeVerifier: handshake.codeVerifier, returnTo: handshake.returnTo },
      toGoogleOAuthConfig(c.get('config')),
      { sessionTtlMs: sessionTtlMs(c.get('config')), requestId: c.get('requestId') },
    );
    setSessionCookie(c, result.token, result.expiresAt);
    log.info('api.auth', 'signed in', c.get('requestId'), { customerId: result.customer.id });
    return c.redirect(handshake.returnTo, 302);
  } catch (error) {
    // Every rejection here is worded for the customer by the orchestrator — no
    // channel on the account, a channel already claimed — so it is shown as-is.
    return c.redirect(loginWithError(errorMessage(error)), 302);
  }
});

authRoutes.post('/signout', (c) => {
  signOut(readSessionToken(c));
  clearSessionCookie(c);
  return c.json({ success: true });
});

/**
 * The signed-in customer. Mounted at `/api/me` rather than under `/api/auth`,
 * because it answers "who is this", which the page guard and the topbar both
 * ask on every load.
 */
export const meRoutes = new Hono<ApiEnv>();

meRoutes.get('/', (c) => c.json({ customer: requireCustomer(c) }));
