import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { chromium } from '@playwright/test';
import { serve } from '@hono/node-server';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createApp } from '../src/app/api/app.js';
import { setConfigValues } from '../src/lib/config/index.js';
import { initDb } from '../src/lib/services/db/index.js';
import { createCodeChallenge } from '../src/lib/utils/googleOAuth.js';
import { startLoginCallback } from '../src/app/cli/client/loginCallback.js';
import {
  CliLoginExchangeResponseSchema,
  CliLoginStartResponseSchema,
} from '../src/lib/types/api.js';

const googleFixture = vi.hoisted(() => ({ origin: '', denied: false }));

// Only the external Google calls are mocked: real browser redirects, cookies,
// API routes, database, PKCE exchange and local callback listener run together.
vi.mock('../src/lib/utils/googleOAuth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/utils/googleOAuth.js')>();
  return {
    ...actual,
    buildGoogleAuthUrl: (...args: Parameters<typeof actual.buildGoogleAuthUrl>): string => {
      const url = new URL(actual.buildGoogleAuthUrl(...args));
      const fixture = new URL(googleFixture.origin);
      url.protocol = fixture.protocol;
      url.host = fixture.host;
      return url.toString();
    },
    exchangeGoogleCode: vi.fn(async () => ({ access_token: 'browser-test-provider-token' })),
    fetchGoogleUserInfo: vi.fn(async () => ({
      sub: 'browser-test-owner',
      email: 'browser@example.com',
      email_verified: true,
    })),
    fetchOwnedYouTubeChannel: vi.fn(async () => ({
      channelId: 'UC_browser',
      title: 'Browser Test',
    })),
  };
});

/** Opt-in so normal unit tests do not require an installed browser. */
describe.runIf(process.env.RUN_AUTH_BROWSER_TEST === '1')('browser CLI callback smoke', () => {
  let backend: ReturnType<typeof serve>;
  let googleServer: ReturnType<typeof serve>;
  let origin: string;
  let directory: string;

  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-auth-browser-'));
    const database = initDb(path.join(directory, 'library.sqlite'));
    migrate(database, { migrationsFolder: path.resolve('drizzle') });
    fs.mkdirSync('temp', { recursive: true });
    origin = await new Promise<string>((resolve, reject) => {
      backend = serve({ fetch: createApp().fetch, hostname: '127.0.0.1', port: 0 }, (info) => {
        resolve(`http://127.0.0.1:${info.port}`);
      });
      backend.once('error', reject);
    });
    googleFixture.origin = await new Promise<string>((resolve, reject) => {
      googleServer = serve(
        {
          hostname: '127.0.0.1',
          port: 0,
          fetch(request): Response {
            const googleUrl = new URL(request.url);
            const callback = new URL(googleUrl.searchParams.get('redirect_uri')!);
            callback.searchParams.set('state', googleUrl.searchParams.get('state')!);
            callback.searchParams.set(
              googleFixture.denied ? 'error' : 'code',
              googleFixture.denied ? 'access_denied' : 'test-google-code',
            );
            return new Response(
              `<html><body><h1>Test Google consent</h1><a href="${callback.toString().replaceAll('&', '&amp;')}">${googleFixture.denied ? 'Cancel' : 'Continue as test creator'}</a></body></html>`,
              {
                headers: { 'content-type': 'text/html' },
              },
            );
          },
        },
        (info) => resolve(`http://127.0.0.1:${info.port}`),
      );
      googleServer.once('error', reject);
    });
    setConfigValues({
      GOOGLE_OAUTH_CLIENT_ID: 'browser-test-client',
      GOOGLE_OAUTH_CLIENT_SECRET: 'browser-test-secret',
      GOOGLE_OAUTH_REDIRECT_URI: `${origin}/api/auth/google/callback`,
    });
  });

  afterAll(async () => {
    if (backend) await new Promise<void>((resolve) => backend.close(() => resolve()));
    if (googleServer) await new Promise<void>((resolve) => googleServer.close(() => resolve()));
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });

  for (const denied of [false, true]) {
    it(
      denied
        ? 'returns denied consent to the terminal'
        : 'signs the CLI in without displaying a code',
      async () => {
        const browser = await chromium.launch();
        googleFixture.denied = denied;
        const context = await browser.newContext();
        const page = await context.newPage();
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
          await page.goto(started.authorizationUrl);
          await page
            .getByRole('link', { name: denied ? 'Cancel' : 'Continue as test creator' })
            .click();
          await page.waitForURL(`${listener.redirectUri}**`);
          expect(await page.locator('body').innerText()).toContain('return to your terminal');
          await page.screenshot({
            path: `temp/auth-browser-${denied ? 'denied' : 'success'}.png`,
            fullPage: true,
          });
          const callback = await listener.result;
          expect(callback.state).toBe(state);
          expect(page.url()).not.toContain('browser-test-provider-token');
          if (denied) {
            expect(callback).toEqual({ state, error: 'provider_denied' });
            return;
          }
          expect('code' in callback).toBe(true);
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
          await browser.close();
        }
      },
      45_000,
    );
  }
});
