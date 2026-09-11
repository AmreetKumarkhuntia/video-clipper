import { z } from 'zod';
import { LoginErrorCodeSchema } from './auth.js';

/** The CLI binds an ephemeral IPv4 loopback port; no URL normalization is allowed. */
export const CliLoopbackRedirectUriSchema = z.string().refine(
  (value: string): boolean => {
    const match = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/callback$/.exec(value);
    return match !== null && Number(match[1]) <= 65_535;
  },
  { message: 'Expected http://127.0.0.1:<port>/callback with an explicit valid port.' },
);

export const CliStateSchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);
export const CliCodeChallengeSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const CliCodeVerifierSchema = z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/);
export const CliExchangeCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);

export const CliCallbackSchema = z.union([
  z.object({ state: CliStateSchema, code: CliExchangeCodeSchema }).strict(),
  z.object({ state: CliStateSchema, error: LoginErrorCodeSchema }).strict(),
]);
export type CliCallback = z.infer<typeof CliCallbackSchema>;

export interface CliPendingLogin {
  id: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  expiresAt: number;
  phase: 'pending' | 'authorizing' | 'processing';
  googleState?: string;
}

export interface CliExchangeGrant {
  customerId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
}

export interface CliCallbackListener {
  redirectUri: string;
  result: Promise<CliCallback>;
  close: () => Promise<void>;
}

export interface CliCallbackListenerOptions {
  state: string;
  timeoutMs: number;
  signal?: AbortSignal;
}
