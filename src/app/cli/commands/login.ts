import { createHash, randomBytes } from 'node:crypto';
import open from 'open';
import { CliLoginExchangeResponseSchema, CliLoginStartResponseSchema } from '@lib/types/api.js';
import type {
  CliLoginExchangeRequest,
  CliLoginExchangeResponse,
  CliLoginStartRequest,
} from '@lib/types/api.js';
import type { CliCallbackListener } from '@lib/types/cliAuth.js';
import { CLI } from '@lib/utils/constants.js';
import { apiBaseUrl, apiSend, revokeSession } from '../client/index.js';
import { writeCredential } from '../client/credentials.js';
import { startLoginCallback } from '../client/loginCallback.js';
import { ApiRequestError } from '../client/errors.js';
import { retireStoredSessions } from '../client/revocations.js';
import type { CommandHandler, LoginArgs } from '@lib/types/command.js';

function parseLoginArgs(argv: string[]): LoginArgs {
  return { help: argv.includes('--help') || argv.includes('-h') };
}

async function revokeExisting(): Promise<void> {
  const result = await retireStoredSessions(apiBaseUrl());
  if (result.failures > 0) {
    throw new Error(
      `The previous sign-in was removed locally, but ${result.failures} server session ` +
        'revocation(s) failed. Run login again when the backend is reachable to retry safely.',
    );
  }
}

/** Upstream errors may echo authentication payloads; never display their raw text. */
async function sendLoginRequest(
  stage: 'start' | 'exchange',
  body: CliLoginStartRequest | CliLoginExchangeRequest,
  signal: AbortSignal,
): Promise<unknown> {
  try {
    return await apiSend<unknown>(`/api/auth/cli/${stage}`, 'POST', body, { signal });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 429) {
      throw new Error('Too many sign-in attempts. Wait before running login again.');
    }
    if (error instanceof ApiRequestError && error.status === 410) {
      throw new Error(
        'This sign-in flow is no longer available. Upgrade the CLI and backend together.',
      );
    }
    throw new Error(
      stage === 'start'
        ? 'Cannot start sign-in. Check that the backend is reachable and run login again.'
        : 'The sign-in exchange failed or expired. Check the backend and run login again.',
    );
  }
}

async function persistSession(result: CliLoginExchangeResponse): Promise<void> {
  try {
    writeCredential(apiBaseUrl(), {
      token: result.token,
      expiresAt: result.expiresAt,
      customerId: result.customer.id,
      ...(result.customer.email ? { email: result.customer.email } : {}),
      role: result.customer.role,
    });
  } catch {
    try {
      await revokeSession(result.token);
    } catch {
      throw new Error(
        'Could not save the new credential or revoke its server session. ' +
          'Check the credential directory permissions and contact the backend administrator to revoke the session.',
      );
    }
    throw new Error(
      'Could not save the new credential. Its server session was revoked. ' +
        'Check the credential directory permissions and run login again.',
    );
  }
}

async function openBrowser(authorizationUrl: string): Promise<void> {
  let shownFallback = false;
  const showFallback = (): void => {
    if (shownFallback) return;
    shownFallback = true;
    console.log(`Open this URL in a browser on this machine:\n  ${authorizationUrl}\n`);
  };
  try {
    const browser = await open(authorizationUrl, { wait: false });
    // Non-waiting open returns before the launcher exits; handle missing or
    // failing launchers as well as errors thrown while resolving the browser.
    browser.once('error', showFallback);
    browser.once('exit', (code: number | null): void => {
      if (code !== null && code !== 0) showFallback();
    });
  } catch {
    showFallback();
  }
}

async function run(argv: string[], _requestId: string): Promise<void> {
  const args = parseLoginArgs(argv);

  if (args.help) {
    console.log(
      `
Usage: video-clipper login

Signs this machine in to the backend at ${apiBaseUrl()} using your system browser.
Choose your Google account and return here; the browser redirects to a temporary
127.0.0.1 callback on this machine. No code needs to be copied or confirmed.
Your session is stored in ~/.config/video-clipper/credentials.json (owner-only).

Set VIDEO_CLIPPER_API_URL to sign in to a different backend. Run
"video-clipper logout" to revoke and forget the session.
`.trim(),
    );
    return;
  }

  await revokeExisting();
  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  const timeout = setTimeout(cancel, CLI.AUTH.LOGIN_TTL_MS);
  let listener: CliCallbackListener | undefined;

  try {
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    listener = await startLoginCallback({
      state,
      timeoutMs: CLI.AUTH.LOGIN_TTL_MS,
      signal: controller.signal,
    });
    const startResponse = await sendLoginRequest(
      'start',
      { redirectUri: listener.redirectUri, state, codeChallenge, codeChallengeMethod: 'S256' },
      controller.signal,
    );
    const started = CliLoginStartResponseSchema.safeParse(startResponse);
    if (!started.success) throw new Error('The backend returned an invalid sign-in response.');
    if (started.data.expiresAt <= Date.now()) throw new Error('Sign-in expired. Run login again.');

    console.log('Opening your browser to sign in…');
    await openBrowser(started.data.authorizationUrl);
    console.log('Waiting for browser sign-in… (Ctrl-C to cancel)');
    const callback = await listener.result;
    if ('error' in callback) {
      throw new Error(
        callback.error === 'provider_denied'
          ? 'Google sign-in was cancelled or denied. Run login again when ready.'
          : 'Browser sign-in failed. Check the backend configuration and run login again.',
      );
    }
    const exchangeResponse = await sendLoginRequest(
      'exchange',
      { code: callback.code, codeVerifier, redirectUri: listener.redirectUri },
      controller.signal,
    );
    const exchanged = CliLoginExchangeResponseSchema.safeParse(exchangeResponse);
    if (!exchanged.success) throw new Error('The backend returned an invalid sign-in session.');
    await persistSession(exchanged.data);
    const who =
      exchanged.data.customer.email ?? exchanged.data.customer.name ?? exchanged.data.customer.id;
    console.log(`\nSigned in as ${who} (${exchanged.data.customer.role}) at ${apiBaseUrl()}.`);
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error('Sign-in cancelled or timed out. Run login again.');
    throw error;
  } finally {
    clearTimeout(timeout);
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
    await listener?.close();
  }
}

export const loginCommand: CommandHandler = {
  name: 'login',
  description: 'Sign this machine in to the backend',
  usage: 'video-clipper login',
  run,
};
