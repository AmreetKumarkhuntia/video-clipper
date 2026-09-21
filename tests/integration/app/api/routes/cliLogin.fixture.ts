import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from 'vitest';
import { setConfigValues } from '@lib/config/index.js';
import { createCodeChallenge, exchangeGoogleCode } from '@lib/utils/googleOAuth.js';
import { CliLoginExchangeResponseSchema, CliLoginStartResponseSchema } from '@lib/types/api.js';
import type {
  CliLoginExchangeRequest,
  CliLoginStartRequest,
  CliLoginStartResponse,
} from '@lib/types/api.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../support/postgres.js';

vi.hoisted(() => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-cli-client';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-cli-secret';
  process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:5002/api/auth/google/callback';
  delete process.env.INITIAL_ADMIN_EMAIL;
});

vi.mock('@lib/utils/googleOAuth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@lib/utils/googleOAuth.js')>();
  return {
    ...actual,
    exchangeGoogleCode: vi.fn(),
    fetchGoogleUserInfo: vi.fn(async () => ({
      sub: 'cli-owner-sub',
      email: 'owner@example.com',
      email_verified: true,
    })),
    fetchOwnedYouTubeChannel: vi.fn(async () => ({
      channelId: 'UC_cli_owner',
      title: 'Owner channel',
    })),
  };
});

const { createApp } = await import('@app/api/app.js');
export type TestApiApp = ReturnType<typeof createApp>;

export const VERIFIER = 'v'.repeat(43);
export const INPUT: CliLoginStartRequest = {
  redirectUri: 'http://127.0.0.1:43123/callback',
  state: 's'.repeat(43),
  codeChallenge: createCodeChallenge(VERIFIER),
  codeChallengeMethod: 'S256',
};
export const GOOGLE_TOKENS = {
  access_token: 'google-access-secret',
  refresh_token: 'google-refresh-secret',
};

let currentApp = createApp();
let database: PostgresTestDatabase;

export function app(): TestApiApp {
  return currentApp;
}

export function exchangeGoogleCodeMock(): typeof exchangeGoogleCode {
  return exchangeGoogleCode;
}

export function restartedApp(): TestApiApp {
  return createApp();
}

export function json(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}

export function cookiesOf(response: Response): Record<string, string> {
  return Object.fromEntries(
    response.headers.getSetCookie().map((header) => {
      const pair = header.split(';')[0]!;
      const separator = pair.indexOf('=');
      return [pair.slice(0, separator), pair.slice(separator + 1)];
    }),
  );
}

export function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

export function locationOf(response: Response): URL {
  expect(response.status).toBe(302);
  return new URL(response.headers.get('location')!, 'http://localhost:5002');
}

export async function start(
  input: CliLoginStartRequest = INPUT,
  headers: Record<string, string> = {},
): Promise<CliLoginStartResponse> {
  const response = await currentApp.request('/api/auth/cli/start', json(input, headers));
  expect(response.status).toBe(200);
  return CliLoginStartResponseSchema.parse(await response.json());
}

export async function begin(input: CliLoginStartRequest = INPUT): Promise<Response> {
  const started = await start(input);
  const response = await currentApp.request(started.authorizationUrl);
  expect(response.status).toBe(302);
  return response;
}

export async function callback(
  authorization: Response,
  query: Record<string, string> = {},
  cookies: Record<string, string> = cookiesOf(authorization),
  target: TestApiApp = currentApp,
): Promise<Response> {
  const params = new URLSearchParams({
    code: 'google-code',
    state: locationOf(authorization).searchParams.get('state')!,
    ...query,
  });
  return target.request(`/api/auth/google/callback?${params}`, {
    headers: { cookie: cookieHeader(cookies) },
  });
}

export async function grant(): Promise<Response> {
  const response = await callback(await begin());
  expect(locationOf(response).searchParams.has('code')).toBe(true);
  return response;
}

export async function exchange(
  response: Response,
  overrides: Partial<CliLoginExchangeRequest> = {},
  target: TestApiApp = currentApp,
): Promise<Response> {
  return target.request(
    '/api/auth/cli/exchange',
    json({
      code: locationOf(response).searchParams.get('code'),
      codeVerifier: VERIFIER,
      redirectUri: INPUT.redirectUri,
      ...overrides,
    }),
  );
}

export async function me(token: string, target: TestApiApp = currentApp): Promise<Response> {
  return target.request('/api/me', { headers: { authorization: `Bearer ${token}` } });
}

export async function sessionCount(): Promise<number> {
  const result = await database.query<{ count: string }>('select count(*) from sessions');
  return Number(result.rows[0]?.count ?? 0);
}

export async function deleteCustomers(): Promise<void> {
  await database.query('delete from customers');
}

export async function exchangeSession(response: Response): Promise<{
  customer: { id: string };
  token: string;
  expiresAt: number;
}> {
  return CliLoginExchangeResponseSchema.parse(await (await exchange(response)).json());
}

beforeAll(async () => {
  database = await createPostgresTestDatabase('cli_login_routes');
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(exchangeGoogleCode).mockResolvedValue(GOOGLE_TOKENS);
  await database.reset();
  setConfigValues({
    GOOGLE_OAUTH_CLIENT_ID: 'test-cli-client',
    GOOGLE_OAUTH_CLIENT_SECRET: 'test-cli-secret',
    GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:5002/api/auth/google/callback',
    CLI_LOGIN_RATE_LIMIT_REQUESTS: 100,
    CLI_LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,
    CLI_LOGIN_MAX_OUTSTANDING: 100,
    TRUSTED_PROXY_HOPS: 1,
  });
  currentApp = createApp();
});

afterEach(() => vi.restoreAllMocks());
afterAll(async () => database.close());
