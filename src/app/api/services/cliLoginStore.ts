import { timingSafeEqual } from 'node:crypto';
import { createSessionToken, hashSessionToken } from '@lib/utils/sessionToken.js';
import { createCodeChallenge } from '@lib/utils/googleOAuth.js';
import { CLI } from '@lib/utils/constants.js';
import type { CliPendingLogin, CliExchangeGrant } from '@lib/types/cliAuth.js';
import type { CliLoginStartRequest, CliLoginExchangeRequest } from '@lib/types/api.js';

/** Transient state belongs to one backend instance; restarting cancels unfinished sign-ins. */
export class CliLoginStore {
  private readonly pending = new Map<string, CliPendingLogin>();
  private readonly grants = new Map<string, CliExchangeGrant>();

  prune(now: number = Date.now()): void {
    for (const [id, request] of this.pending) {
      if (request.expiresAt <= now) this.pending.delete(id);
    }
    for (const [hash, grant] of this.grants) {
      if (grant.expiresAt <= now) this.grants.delete(hash);
    }
  }

  size(): number {
    this.prune();
    return this.pending.size + this.grants.size;
  }

  retryAfterSeconds(): number {
    this.prune();
    let earliest = Date.now() + CLI.AUTH.LOGIN_TTL_MS;
    for (const entry of [...this.pending.values(), ...this.grants.values()]) {
      earliest = Math.min(earliest, entry.expiresAt);
    }
    return Math.max(1, Math.ceil((earliest - Date.now()) / 1000));
  }

  start(input: CliLoginStartRequest): CliPendingLogin {
    const request: CliPendingLogin = {
      ...input,
      id: createSessionToken(),
      expiresAt: Date.now() + CLI.AUTH.LOGIN_TTL_MS,
      phase: 'pending',
    };
    this.pending.set(request.id, request);
    return request;
  }

  authorize(id: string, googleState: string): boolean {
    this.prune();
    const request = this.pending.get(id);
    if (!request || request.phase !== 'pending') return false;
    request.googleState = googleState;
    request.phase = 'authorizing';
    return true;
  }

  /** Claim synchronously before awaiting Google, so concurrent callbacks cannot reuse it. */
  claim(id: string, googleState: string): CliPendingLogin | null {
    this.prune();
    const request = this.pending.get(id);
    if (!request || request.phase !== 'authorizing' || request.googleState !== googleState) {
      return null;
    }
    request.phase = 'processing';
    return request;
  }

  discard(request: CliPendingLogin): void {
    if (this.pending.get(request.id) === request) this.pending.delete(request.id);
  }

  /** Return a one-use code; the browser never receives a CLI session token. */
  complete(request: CliPendingLogin, customerId: string): string | null {
    this.prune();
    if (this.pending.get(request.id) !== request || request.phase !== 'processing') return null;
    this.pending.delete(request.id);
    const code = createSessionToken();
    this.grants.set(hashSessionToken(code), {
      customerId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      expiresAt: Date.now() + CLI.AUTH.EXCHANGE_TTL_MS,
    });
    return code;
  }

  redeem(input: CliLoginExchangeRequest): CliExchangeGrant | null {
    this.prune();
    const hash = hashSessionToken(input.code);
    const grant = this.grants.get(hash);
    if (!grant || grant.redirectUri !== input.redirectUri) return null;
    const actual = Buffer.from(createCodeChallenge(input.codeVerifier));
    const expected = Buffer.from(grant.codeChallenge);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    this.grants.delete(hash);
    return grant;
  }
}
