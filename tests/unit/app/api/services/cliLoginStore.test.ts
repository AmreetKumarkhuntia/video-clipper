import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CliLoginStore } from '@app/api/services/cliLoginStore.js';
import type { CliLoginStartRequest } from '@lib/types/api.js';
import { createCodeChallenge } from '@lib/utils/googleOAuth.js';
import { CLI } from '@lib/utils/constants.js';

const VERIFIER = 'v'.repeat(43);
const INPUT: CliLoginStartRequest = {
  redirectUri: 'http://127.0.0.1:49152/callback',
  state: 's'.repeat(43),
  codeChallenge: createCodeChallenge(VERIFIER),
  codeChallengeMethod: 'S256',
};

describe('CliLoginStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves a request through its one-use authorization and exchange lifecycle', () => {
    const store = new CliLoginStore();
    const pending = store.start(INPUT);

    expect(store.size()).toBe(1);
    expect(store.authorize(pending.id, 'google-state')).toBe(true);
    expect(store.authorize(pending.id, 'google-state')).toBe(false);
    expect(store.claim(pending.id, 'wrong-state')).toBeNull();
    expect(store.claim(pending.id, 'google-state')).toBe(pending);
    expect(store.claim(pending.id, 'google-state')).toBeNull();

    const code = store.complete(pending, 'customer-1');
    expect(code).not.toBeNull();
    expect(
      store.redeem({ code: code!, codeVerifier: 'x'.repeat(43), redirectUri: INPUT.redirectUri }),
    ).toBeNull();
    expect(
      store.redeem({ code: code!, codeVerifier: VERIFIER, redirectUri: INPUT.redirectUri }),
    ).toEqual({
      customerId: 'customer-1',
      redirectUri: INPUT.redirectUri,
      codeChallenge: INPUT.codeChallenge,
      expiresAt: Date.now() + CLI.AUTH.EXCHANGE_TTL_MS,
    });
    expect(
      store.redeem({ code: code!, codeVerifier: VERIFIER, redirectUri: INPUT.redirectUri }),
    ).toBeNull();
    expect(store.size()).toBe(0);
  });

  it('does not redeem a grant for a different redirect URI', () => {
    const store = new CliLoginStore();
    const pending = store.start(INPUT);
    store.authorize(pending.id, 'google-state');
    const claimed = store.claim(pending.id, 'google-state');
    const code = store.complete(claimed!, 'customer-1');

    expect(
      store.redeem({
        code: code!,
        codeVerifier: VERIFIER,
        redirectUri: 'http://127.0.0.1:49153/callback',
      }),
    ).toBeNull();
    expect(store.size()).toBe(1);
  });

  it('prunes expired requests and grants', () => {
    const store = new CliLoginStore();
    const pending = store.start(INPUT);
    expect(store.retryAfterSeconds()).toBe(Math.ceil(CLI.AUTH.LOGIN_TTL_MS / 1000));

    vi.advanceTimersByTime(CLI.AUTH.LOGIN_TTL_MS);
    expect(store.authorize(pending.id, 'google-state')).toBe(false);
    expect(store.size()).toBe(0);

    const second = store.start(INPUT);
    store.authorize(second.id, 'google-state');
    const claimed = store.claim(second.id, 'google-state');
    const code = store.complete(claimed!, 'customer-1');
    vi.advanceTimersByTime(CLI.AUTH.EXCHANGE_TTL_MS);

    expect(
      store.redeem({ code: code!, codeVerifier: VERIFIER, redirectUri: INPUT.redirectUri }),
    ).toBeNull();
    expect(store.size()).toBe(0);
  });
});
