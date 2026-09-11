import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { serve } from '@hono/node-server';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import {
  CliLoginExchangeResponseSchema,
  CliLoginStartResponseSchema,
} from '../../../src/lib/types/api.js';

let backend: ReturnType<typeof serve> | undefined;
let directory = '';
let origin = '';
let nativeFetch: typeof globalThis.fetch;
let nativeHomedir: typeof os.homedir;
let startLoginCallback: typeof import('../../../src/app/cli/client/loginCallback.js').startLoginCallback;
let createCodeChallenge: typeof import('../../../src/lib/utils/googleOAuth.js').createCodeChallenge;

const environment = new Map(
  [
    'LLM_PROVIDER',
    'OPENAI_API_KEY',
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'GOOGLE_OAUTH_REDIRECT_URI',
  ].map((key) => [key, process.env[key]]),
);

function googleResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function installGoogleApiFixture(): void {
  nativeFetch = globalThis.fetch;
  globalThis.fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);

    if (url.href === 'https://oauth2.googleapis.com/token') {
      return googleResponse({
        access_token: 'browser-test-provider-token',
        refresh_token: 'browser-test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }
    if (url.href === 'https://openidconnect.googleapis.com/v1/userinfo') {
      return googleResponse({
        sub: 'browser-test-owner',
        email: 'browser@example.com',
        email_verified: true,
        name: 'Browser Test Owner',
      });
    }
    if (url.origin === 'https://www.googleapis.com' && url.pathname === '/youtube/v3/channels') {
      return googleResponse({
        items: [
          {
            id: 'UC_browser',
            snippet: { title: 'Browser Test' },
            contentDetails: { relatedPlaylists: { uploads: 'UU_browser' } },
          },
        ],
      });
    }

    return nativeFetch(input, init);
  };
}

async function closeBackend(): Promise<void> {
  if (!backend) return;
  await new Promise<void>((resolve) => backend?.close(() => resolve()));
  backend = undefined;
}

async function showConsentPage(page: Page, authorization: URL, denied: boolean): Promise<void> {
  expect(authorization.origin).toBe('https://accounts.google.com');
  expect(authorization.pathname).toBe('/o/oauth2/v2/auth');

  const callback = new URL(authorization.searchParams.get('redirect_uri') ?? '');
  callback.searchParams.set('state', authorization.searchParams.get('state') ?? '');
  callback.searchParams.set(denied ? 'error' : 'code', denied ? 'access_denied' : 'test-code');
  const linkText = denied ? 'Cancel' : 'Continue as test creator';

  await page.setContent(
    `<html><body><h1>Test Google consent</h1><a href="${callback.toString().replaceAll('&', '&amp;')}">${linkText}</a></body></html>`,
  );
}

async function runCliLogin(page: Page, context: BrowserContext, denied: boolean): Promise<void> {
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const listener = await startLoginCallback({ state, timeoutMs: 30_000 });

  try {
    const response = await fetch(`${origin}/api/auth/cli/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        redirectUri: listener.redirectUri,
        state,
        codeChallenge: createCodeChallenge(verifier),
        codeChallengeMethod: 'S256',
      }),
    });
    expect(response.status).toBe(200);
    const started = CliLoginStartResponseSchema.parse(await response.json());

    const authorizationResponse = await context.request.get(started.authorizationUrl, {
      maxRedirects: 0,
    });
    expect(authorizationResponse.status()).toBe(302);
    const authorization = new URL(authorizationResponse.headers().location ?? '');
    await showConsentPage(page, authorization, denied);
    await page.getByRole('link', { name: denied ? 'Cancel' : 'Continue as test creator' }).click();
    await page.waitForURL(`${listener.redirectUri}**`);
    await expect(page.locator('body')).toContainText('return to your terminal');

    const callback = await listener.result;
    expect(callback.state).toBe(state);
    expect(page.url()).not.toContain('browser-test-provider-token');

    if (denied) {
      expect(callback).toEqual({ state, error: 'provider_denied' });
      return;
    }

    expect(callback).toHaveProperty('code');
    if (!('code' in callback)) throw new Error('Expected a successful browser callback.');

    const exchanged = await fetch(`${origin}/api/auth/cli/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: callback.code,
        codeVerifier: verifier,
        redirectUri: listener.redirectUri,
      }),
    });
    expect(exchanged.status).toBe(200);
    const session = CliLoginExchangeResponseSchema.parse(await exchanged.json());
    expect(page.url()).not.toContain(session.token);

    const bearer = { authorization: `Bearer ${session.token}` };
    expect((await fetch(`${origin}/api/me`, { headers: bearer })).status).toBe(200);
    expect((await context.request.get(`${origin}/api/me`)).status()).toBe(200);

    await fetch(`${origin}/api/auth/signout`, { method: 'POST', headers: bearer });
    expect((await fetch(`${origin}/api/me`, { headers: bearer })).status).toBe(401);
    expect((await context.request.get(`${origin}/api/me`)).status()).toBe(200);
  } finally {
    await listener.close();
  }
}

test.describe.serial('browser CLI callback', () => {
  test.beforeAll(async (): Promise<void> => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-auth-browser-'));
    nativeHomedir = os.homedir;
    Object.defineProperty(os, 'homedir', { configurable: true, value: (): string => directory });

    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'browser-test-openai-key';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'browser-test-client';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'browser-test-secret';
    process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://127.0.0.1/api/auth/google/callback';

    installGoogleApiFixture();

    const [appModule, configModule, dbModule, encryptionModule, callbackModule, oauthModule] =
      await Promise.all([
        import('../../../src/app/api/app.js'),
        import('../../../src/lib/config/index.js'),
        import('../../../src/lib/services/db/index.js'),
        import('../../../src/lib/services/encryption/index.js'),
        import('../../../src/app/cli/client/loginCallback.js'),
        import('../../../src/lib/utils/googleOAuth.js'),
      ]);

    startLoginCallback = callbackModule.startLoginCallback;
    createCodeChallenge = oauthModule.createCodeChallenge;
    encryptionModule.initTokenCipher(randomBytes(32));
    const database = dbModule.initDb(path.join(directory, 'library.sqlite'));
    migrate(database, { migrationsFolder: path.resolve('drizzle') });

    origin = await new Promise<string>((resolve, reject) => {
      backend = serve(
        { fetch: appModule.createApp().fetch, hostname: '127.0.0.1', port: 0 },
        (info) => resolve(`http://127.0.0.1:${info.port}`),
      );
      backend.once('error', reject);
    });
    configModule.setConfigValues({
      GOOGLE_OAUTH_CLIENT_ID: 'browser-test-client',
      GOOGLE_OAUTH_CLIENT_SECRET: 'browser-test-secret',
      GOOGLE_OAUTH_REDIRECT_URI: `${origin}/api/auth/google/callback`,
    });
  });

  test.afterAll(async (): Promise<void> => {
    await closeBackend();
    globalThis.fetch = nativeFetch;
    Object.defineProperty(os, 'homedir', { configurable: true, value: nativeHomedir });
    for (const [key, value] of environment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });

  test('signs the CLI in without displaying a code or token', async ({
    page,
    context,
  }): Promise<void> => {
    await runCliLogin(page, context, false);
  });

  test('returns denied consent to the terminal', async ({ page, context }): Promise<void> => {
    await runCliLogin(page, context, true);
  });
});
