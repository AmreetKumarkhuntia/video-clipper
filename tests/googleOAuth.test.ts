import { describe, it, expect } from 'vitest';
import {
  GOOGLE_SIGN_IN_SCOPES,
  buildGoogleAuthUrl,
  createCodeChallenge,
  createCodeVerifier,
  createOAuthState,
  expiryFromExpiresIn,
  isGoogleOAuthConfigured,
  toBase64Url,
} from '../src/lib/utils/googleOAuth.js';

const OAUTH = {
  clientId: 'client-123',
  clientSecret: 'secret-456',
  redirectUri: 'http://localhost:5002/api/auth/google/callback',
};

describe('toBase64Url', () => {
  it('produces unpadded url-safe base64', () => {
    const encoded = toBase64Url(Buffer.from([251, 255, 190, 255]));
    expect(encoded).not.toMatch(/[+/=]/);
    expect(encoded).toBe('-_--_w');
  });
});

describe('code verifier and challenge', () => {
  it('mints distinct high-entropy values', () => {
    const a = createCodeVerifier();
    const b = createCodeVerifier();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(createOAuthState()).not.toBe(createOAuthState());
  });

  it('hashes a verifier deterministically and url-safely', () => {
    const challenge = createCodeChallenge('verifier-abc');
    expect(challenge).toBe(createCodeChallenge('verifier-abc'));
    expect(challenge).not.toBe(createCodeChallenge('verifier-xyz'));
    expect(challenge).not.toMatch(/[+/=]/);
  });
});

describe('isGoogleOAuthConfigured', () => {
  it('requires all three credentials to be non-blank', () => {
    expect(isGoogleOAuthConfigured(OAUTH)).toBe(true);
    expect(isGoogleOAuthConfigured({ ...OAUTH, clientSecret: '   ' })).toBe(false);
    expect(isGoogleOAuthConfigured({ clientId: 'a' })).toBe(false);
    expect(isGoogleOAuthConfigured({})).toBe(false);
  });
});

describe('buildGoogleAuthUrl', () => {
  it('requests offline access and consent so a refresh token comes back', () => {
    const url = new URL(buildGoogleAuthUrl(OAUTH, 'state-1', 'verifier-1'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(createCodeChallenge('verifier-1'));
    expect(url.searchParams.get('redirect_uri')).toBe(OAUTH.redirectUri);
  });

  it('asks only for identity and read-only youtube by default', () => {
    const url = new URL(buildGoogleAuthUrl(OAUTH, 's', 'v'));
    const scopes = (url.searchParams.get('scope') ?? '').split(' ');
    expect(scopes).toEqual(GOOGLE_SIGN_IN_SCOPES);
    expect(scopes).toContain('https://www.googleapis.com/auth/youtube.readonly');
    expect(scopes.some((s) => s.includes('youtube.upload'))).toBe(false);
    expect(scopes.some((s) => s.includes('force-ssl'))).toBe(false);
  });

  it('never sends the verifier itself', () => {
    const url = buildGoogleAuthUrl(OAUTH, 'state-1', 'verifier-1');
    expect(url).not.toContain('verifier-1');
  });

  it('throws a directive error when credentials are missing', () => {
    expect(() => buildGoogleAuthUrl({}, 's', 'v')).toThrow(/GOOGLE_OAUTH_CLIENT_ID/);
  });
});

describe('expiryFromExpiresIn', () => {
  it('converts a relative lifetime to an absolute epoch, and passes through undefined', () => {
    const before = Date.now();
    const expiry = expiryFromExpiresIn(3600)!;
    expect(expiry).toBeGreaterThanOrEqual(before + 3_600_000);
    expect(expiryFromExpiresIn(undefined)).toBeUndefined();
  });
});
