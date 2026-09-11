import { describe, expect, it } from 'vitest';
import { CliLoginExchangeResponseSchema, CliLoginStartResponseSchema } from '@lib/types/api.js';

const AUTHORIZATION_URL = `https://clips.example.com/api/auth/cli/authorize?request=${'a'.repeat(43)}`;
const CUSTOMER = {
  id: 'customer-1',
  email: 'creator@example.com',
  role: 'customer' as const,
  permissions: [],
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
};
const SESSION = {
  customer: CUSTOMER,
  token: 'session-token',
  expiresAt: Date.now() + 86_400_000,
};

describe('CLI login response schemas', () => {
  it('accepts canonical authorization and session responses', () => {
    expect(
      CliLoginStartResponseSchema.safeParse({
        authorizationUrl: AUTHORIZATION_URL,
        expiresAt: Date.now() + 60_000,
      }).success,
    ).toBe(true);
    expect(CliLoginExchangeResponseSchema.safeParse(SESSION).success).toBe(true);
  });

  it.each([
    'not-a-url',
    'sensitive-authorization-sentinel',
    ` ${AUTHORIZATION_URL}`,
    `${AUTHORIZATION_URL}\n`,
    `${AUTHORIZATION_URL}"`,
    `${AUTHORIZATION_URL}\u0000`,
    'file:///tmp/unsafe',
    `https://user@clips.example.com/api/auth/cli/authorize?request=${'a'.repeat(43)}`,
    `https://clips.example.com/other?request=${'a'.repeat(43)}`,
    `${AUTHORIZATION_URL}&command=extra`,
    'https://clips.example.com/api/auth/cli/authorize?request=$(command)',
    `https://$(command).example.com/api/auth/cli/authorize?request=${'a'.repeat(43)}`,
  ])('rejects unsafe authorization URL %s', (authorizationUrl) => {
    expect(
      CliLoginStartResponseSchema.safeParse({ authorizationUrl, expiresAt: Date.now() }).success,
    ).toBe(false);
  });

  it.each([
    null,
    [],
    { ...SESSION, customer: null },
    { ...SESSION, customer: { ...CUSTOMER, role: 'unknown' } },
    { ...SESSION, customer: { ...CUSTOMER, createdAt: 'invalid' } },
    { ...SESSION, token: '' },
    { ...SESSION, expiresAt: -1 },
  ])('rejects invalid session response %#', (value) => {
    expect(CliLoginExchangeResponseSchema.safeParse(value).success).toBe(false);
  });
});
