import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { log } from '@lib/utils/logger.js';
import { CLI } from '@lib/utils/constants.js';
import { mintSession, oauthProvider, signOut } from '@lib/orchestration/auth/index.js';
import { findCustomerById } from '@lib/services/db/index.js';
import { toGoogleOAuthConfig, sessionTtlMs, webOrigin } from '../services/appConfig.js';
import {
  clearCliRequestCookie,
  clearHandshakeCookies,
  clearSessionCookie,
  readCliRequestCookie,
  readHandshakeCookies,
  readSessionToken,
  sanitizeReturnTo,
  setCliRequestCookie,
  setHandshakeCookies,
  setSessionCookie,
} from '../http/sessionCookies.js';
import { requireCustomer } from '../middleware/session.js';
import { HttpError, jsonError, parseJsonBody } from '../http/responses.js';
import { SignInError } from '@lib/utils/signInError.js';
import { isGoogleOAuthConfigured } from '@lib/utils/googleOAuth.js';
import { CliLoginExchangeSchema, CliLoginStartSchema } from '@lib/types/api.js';
import type { LoginErrorCode } from '@lib/types/auth.js';
import type { CliPendingLogin } from '@lib/types/cliAuth.js';
import type { ApiEnv } from '../context.js';
import { resolveClientAddress } from '../services/clientAddress.js';
import type { CliLoginStore } from '../services/cliLoginStore.js';

function loginWithError(code: LoginErrorCode, detail?: string): string {
  const query = new URLSearchParams({ error: code });
  if (detail) query.set('detail', detail);
  return `/login?${query.toString()}`;
}

/** Never include raw provider errors, which can contain credentials or tokens. */
function loginRedirectFor(error: unknown, requestId: string | undefined, where: string): string {
  if (error instanceof SignInError) return loginWithError(error.code, error.detail);
  log.warn('api.auth', `${where} failed`, requestId);
  return loginWithError('sign_in_failed');
}

function cliRedirect(request: CliPendingLogin, parameter: 'code' | 'error', value: string): string {
  const url = new URL(request.redirectUri);
  url.searchParams.set(parameter, value);
  url.searchParams.set('state', request.state);
  return url.toString();
}

/** The Google and CLI route factories share exactly one transient store per app. */
export function createAuthRoutes(store: CliLoginStore): Hono<ApiEnv> {
  const routes = new Hono<ApiEnv>();
  routes.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    await next();
  });

  routes.get('/google/start', (c) => {
    clearCliRequestCookie(c);
    const returnTo = sanitizeReturnTo(c.req.query('returnTo'));
    try {
      const { authUrl, handshake } = oauthProvider(
        'google',
        toGoogleOAuthConfig(c.get('config')),
      ).startLogin(returnTo);
      setHandshakeCookies(c, handshake);
      return c.redirect(authUrl, 302);
    } catch (error) {
      return c.redirect(loginRedirectFor(error, c.get('requestId'), 'sign-in start'), 302);
    }
  });

  routes.get('/google/callback', async (c) => {
    const query = new URL(c.req.url).searchParams;
    const code = query.get('code');
    const state = query.get('state');
    const oauthError = query.get('error');
    const handshake = readHandshakeCookies(c);
    const cliRequestId = readCliRequestCookie(c);
    clearHandshakeCookies(c);
    clearCliRequestCookie(c);

    const validState =
      state &&
      handshake.state &&
      handshake.codeVerifier &&
      state === handshake.state &&
      query.getAll('state').length === 1 &&
      query.getAll('code').length <= 1 &&
      query.getAll('error').length <= 1;
    // Preserve the browser denial page; CLI redirects require a validated handshake.
    if (oauthError && !cliRequestId) {
      return c.redirect(loginWithError('provider_denied', oauthError), 302);
    }
    if (!validState) return c.redirect(loginWithError('state_mismatch'), 302);
    const pending = cliRequestId ? store.claim(cliRequestId, state) : null;
    if (cliRequestId && !pending) return c.redirect(loginWithError('state_mismatch'), 302);

    if (oauthError || !code) {
      if (pending) store.discard(pending);
      const error = oauthError ? 'provider_denied' : 'state_mismatch';
      return c.redirect(
        pending ? cliRedirect(pending, 'error', error) : loginWithError(error),
        302,
      );
    }

    try {
      const result = await oauthProvider(
        'google',
        toGoogleOAuthConfig(c.get('config')),
      ).completeLogin(
        code,
        { state, codeVerifier: handshake.codeVerifier!, returnTo: handshake.returnTo },
        {
          sessionTtlMs: sessionTtlMs(c.get('config')),
          initialAdminEmail: c.get('config').INITIAL_ADMIN_EMAIL,
          ...(readSessionToken(c) ? { replacesToken: readSessionToken(c) } : {}),
          requestId: c.get('requestId'),
        },
      );
      setSessionCookie(c, result.token, result.expiresAt);
      log.info('api.auth', 'signed in', c.get('requestId'), { customerId: result.customer.id });
      if (pending) {
        const exchangeCode = store.complete(pending, result.customer.id);
        return c.redirect(
          exchangeCode
            ? cliRedirect(pending, 'code', exchangeCode)
            : cliRedirect(pending, 'error', 'sign_in_failed'),
          302,
        );
      }
      return c.redirect(handshake.returnTo, 302);
    } catch (error) {
      if (pending) {
        store.discard(pending);
        log.warn('api.auth', 'CLI Google sign-in failed', c.get('requestId'));
        return c.redirect(
          cliRedirect(
            pending,
            'error',
            error instanceof SignInError ? error.code : 'sign_in_failed',
          ),
          302,
        );
      }
      return c.redirect(loginRedirectFor(error, c.get('requestId'), 'sign-in'), 302);
    }
  });

  routes.post('/signout', (c) => {
    signOut(readSessionToken(c));
    clearSessionCookie(c);
    return c.json({ success: true });
  });
  return routes;
}

export const meRoutes = new Hono<ApiEnv>();
meRoutes.get('/', (c) => c.json({ customer: requireCustomer(c) }));

function tooManyRequests(retryAfterSeconds: number): HttpError {
  const response = jsonError(
    429,
    'Too many CLI sign-in requests.',
    'Try again after the indicated delay.',
  );
  response.headers.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterSeconds))));
  return new HttpError(response);
}

export function createCliAuthRoutes(store: CliLoginStore): Hono<ApiEnv> {
  const routes = new Hono<ApiEnv>();
  const attemptsByClient = new Map<string, number[]>();
  routes.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    await next();
  });

  // Bound state allocation and guesses; budgets are separate per endpoint.
  routes.use('*', async (c, next) => {
    if (
      !['/start', '/authorize', '/exchange'].some((path) => c.req.path === `/api/auth/cli${path}`)
    ) {
      await next();
      return;
    }
    const now = Date.now();
    const cfg = c.get('config');
    const windowMs = cfg.CLI_LOGIN_RATE_LIMIT_WINDOW_SECONDS * 1000;
    const client = resolveClientAddress(
      c.req.raw,
      cfg.TRUSTED_PROXY_HOPS,
      c.env?.incoming?.socket.remoteAddress,
    );
    const key = `${client}:${c.req.path}`;
    for (const [tracked, attempts] of attemptsByClient) {
      const recent = attempts.filter((timestamp) => timestamp > now - windowMs);
      if (recent.length) attemptsByClient.set(tracked, recent);
      else attemptsByClient.delete(tracked);
    }
    store.prune(now);
    if (
      !attemptsByClient.has(key) &&
      attemptsByClient.size >= Math.max(100, cfg.CLI_LOGIN_MAX_OUTSTANDING * 3)
    ) {
      throw tooManyRequests(cfg.CLI_LOGIN_RATE_LIMIT_WINDOW_SECONDS);
    }
    const attempts = attemptsByClient.get(key) ?? [];
    if (attempts.length >= cfg.CLI_LOGIN_RATE_LIMIT_REQUESTS) {
      throw tooManyRequests((attempts[0]! + windowMs - now) / 1000);
    }
    attempts.push(now);
    attemptsByClient.set(key, attempts);
    await next();
  });

  const limitBody = bodyLimit({
    maxSize: CLI.AUTH.MAX_BODY_BYTES,
    onError: (): Response => jsonError(413, 'CLI sign-in request is too large.'),
  });
  routes.use('/start', limitBody);
  routes.use('/exchange', limitBody);

  routes.post('/start', async (c) => {
    const input = await parseJsonBody(c.req.raw, CliLoginStartSchema);
    const cfg = c.get('config');
    if (!isGoogleOAuthConfigured(toGoogleOAuthConfig(cfg))) {
      throw new HttpError(jsonError(503, 'Google sign-in is not configured on the backend.'));
    }
    if (store.size() >= cfg.CLI_LOGIN_MAX_OUTSTANDING)
      throw tooManyRequests(store.retryAfterSeconds());
    const request = store.start(input);
    const url = new URL('/api/auth/cli/authorize', webOrigin(cfg));
    url.searchParams.set('request', request.id);
    return c.json({ authorizationUrl: url.toString(), expiresAt: request.expiresAt });
  });

  routes.get('/authorize', (c) => {
    const ids = new URL(c.req.url).searchParams.getAll('request');
    if (ids.length !== 1) throw new HttpError(jsonError(400, 'Invalid CLI sign-in request.'));
    try {
      const { authUrl, handshake } = oauthProvider(
        'google',
        toGoogleOAuthConfig(c.get('config')),
      ).startLogin('/');
      if (!store.authorize(ids[0]!, handshake.state)) {
        throw new HttpError(
          jsonError(410, 'CLI sign-in expired or already used. Run login again.'),
        );
      }
      setHandshakeCookies(c, handshake);
      setCliRequestCookie(c, ids[0]!);
      return c.redirect(authUrl, 302);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      return c.redirect(loginRedirectFor(error, c.get('requestId'), 'CLI sign-in start'), 302);
    }
  });

  routes.post('/exchange', async (c) => {
    const input = await parseJsonBody(c.req.raw, CliLoginExchangeSchema);
    const grant = store.redeem(input);
    const customer = grant ? findCustomerById(grant.customerId) : null;
    if (!grant || !customer) {
      throw new HttpError(
        jsonError(400, 'CLI sign-in exchange is invalid or expired. Run login again.'),
      );
    }
    const session = mintSession(customer.id, sessionTtlMs(c.get('config')));
    return c.json({ customer, ...session });
  });

  for (const path of ['/approve', '/poll']) {
    routes.post(path, (c) =>
      c.json(
        {
          error: {
            message:
              'Code-based CLI sign-in has been removed. Upgrade the CLI and run login again.',
          },
        },
        410,
      ),
    );
  }
  return routes;
}
