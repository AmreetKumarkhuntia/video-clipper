import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import open from 'open';
import { loginCommand } from '@app/cli/commands/login.js';
import { apiSend, revokeSession } from '@app/cli/client/index.js';
import { writeCredential } from '@app/cli/client/credentials.js';
import { startLoginCallback } from '@app/cli/client/loginCallback.js';
import { retireStoredSessions } from '@app/cli/client/revocations.js';
import { CliLoginExchangeSchema, CliLoginStartSchema } from '@lib/types/api.js';
import type { CliLoginStartRequest } from '@lib/types/api.js';
import type {
  CliCallback,
  CliCallbackListener,
  CliCallbackListenerOptions,
} from '@lib/types/cliAuth.js';

vi.mock('open', (): Record<string, unknown> => ({ default: vi.fn() }));
vi.mock(
  '@app/cli/client/index.js',
  (): Record<string, unknown> => ({
    apiBaseUrl: (): string => 'https://clips.example.com',
    apiSend: vi.fn(),
    revokeSession: vi.fn(),
  }),
);
vi.mock(
  '@app/cli/client/credentials.js',
  (): Record<string, unknown> => ({ writeCredential: vi.fn() }),
);
vi.mock(
  '@app/cli/client/revocations.js',
  (): Record<string, unknown> => ({ retireStoredSessions: vi.fn() }),
);
vi.mock(
  '@app/cli/client/loginCallback.js',
  (): Record<string, unknown> => ({
    startLoginCallback: vi.fn(),
  }),
);

const authorizationUrl = `https://clips.example.com/api/auth/cli/authorize?request=${'a'.repeat(43)}`;
const code = 'b'.repeat(43);
const token = 'sensitive-new-session-token';
const customer = {
  id: 'customer-1',
  email: 'creator@example.com',
  role: 'customer' as const,
  permissions: [],
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
};
const session = { customer, token, expiresAt: Date.now() + 86_400_000 };
let started: CliLoginStartRequest | undefined;
let resolveCallback: ((result: CliCallback) => void) | undefined;
let rejectCallback: ((error: Error) => void) | undefined;
let closeCallback: ReturnType<typeof vi.fn>;

function currentStart(): CliLoginStartRequest {
  if (!started) throw new Error('Login start was not requested.');
  return started;
}

function makeCallbackListener(options: CliCallbackListenerOptions): CliCallbackListener {
  const result = new Promise<CliCallback>((resolve, reject): void => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });
  void result.catch((): void => {});
  options.signal?.addEventListener(
    'abort',
    (): void => rejectCallback?.(new Error('Sign-in cancelled')),
    { once: true },
  );
  closeCallback = vi.fn(async (): Promise<void> => {});
  return {
    redirectUri: 'http://127.0.0.1:49152/callback',
    result,
    close: closeCallback,
  };
}

async function callback(error?: 'provider_denied'): Promise<void> {
  const start = currentStart();
  resolveCallback?.(error ? { state: start.state, error } : { state: start.state, code });
  await Promise.resolve();
}

beforeEach((): void => {
  vi.clearAllMocks();
  started = undefined;
  resolveCallback = undefined;
  rejectCallback = undefined;
  closeCallback = vi.fn(async (): Promise<void> => {});
  vi.spyOn(console, 'log').mockImplementation((): void => {});
  vi.mocked(retireStoredSessions).mockResolvedValue({ hadSessions: false, failures: 0 });
  vi.mocked(writeCredential).mockImplementation((): void => {});
  vi.mocked(revokeSession).mockResolvedValue(undefined);
  vi.mocked(startLoginCallback).mockImplementation(
    async (options): Promise<CliCallbackListener> => makeCallbackListener(options),
  );
  vi.mocked(apiSend).mockImplementation(async (path, _method, body): Promise<unknown> => {
    if (path === '/api/auth/cli/start') {
      started = CliLoginStartSchema.parse(body);
      return { authorizationUrl, expiresAt: Date.now() + 600_000 };
    }
    if (path === '/api/auth/cli/exchange') {
      CliLoginExchangeSchema.parse(body);
      return session;
    }
    throw new Error('Unexpected API request.');
  });
  vi.mocked(open).mockImplementation(async (): Promise<ChildProcess> => {
    await callback();
    return new ChildProcess();
  });
});

afterEach((): void => {
  vi.restoreAllMocks();
});

describe('CLI browser sign-in command', (): void => {
  it('exchanges a browser callback using fresh PKCE and persists the validated session', async (): Promise<void> => {
    await loginCommand.run([], 'request-1');
    expect(retireStoredSessions).toHaveBeenCalledBefore(vi.mocked(apiSend));
    expect(open).toHaveBeenCalledWith(authorizationUrl, { wait: false });
    const exchange = CliLoginExchangeSchema.parse(vi.mocked(apiSend).mock.calls[1]?.[2]);
    expect(exchange.code).toBe(code);
    expect(exchange.redirectUri).toBe(currentStart().redirectUri);
    expect(createHash('sha256').update(exchange.codeVerifier).digest('base64url')).toBe(
      currentStart().codeChallenge,
    );
    expect(exchange.codeVerifier).not.toBe(currentStart().state);
    expect(writeCredential).toHaveBeenCalledWith('https://clips.example.com', {
      token,
      expiresAt: session.expiresAt,
      customerId: customer.id,
      email: customer.email,
      role: customer.role,
    });
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(token);
    expect(closeCallback).toHaveBeenCalledOnce();
  });

  it('generates independent state and PKCE values for each login', async (): Promise<void> => {
    await loginCommand.run([], 'request-1');
    const first = currentStart();
    await loginCommand.run([], 'request-2');
    expect(currentStart().state).not.toBe(first.state);
    expect(currentStart().codeChallenge).not.toBe(first.codeChallenge);
  });

  it('prints a URL and continues waiting when opening the browser throws', async (): Promise<void> => {
    vi.mocked(open).mockRejectedValueOnce(new Error('browser unavailable'));
    const running = loginCommand.run([], 'request-1');
    await vi.waitFor((): void =>
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Open this URL')),
    );
    await callback();
    await running;
    expect(writeCredential).toHaveBeenCalledOnce();
  });

  it('prints a URL for asynchronous browser launcher errors', async (): Promise<void> => {
    const browser = new ChildProcess();
    vi.mocked(open).mockResolvedValueOnce(browser);
    const running = loginCommand.run([], 'request-1');
    await vi.waitFor((): void => expect(browser.listenerCount('error')).toBe(1));
    browser.emit('error', new Error('launcher unavailable'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(authorizationUrl));
    await callback();
    await running;
  });

  it('handles provider denial and closes the listener without writing a session', async (): Promise<void> => {
    vi.mocked(open).mockImplementation(async (): Promise<ChildProcess> => {
      await callback('provider_denied');
      return new ChildProcess();
    });
    await expect(loginCommand.run([], 'request-1')).rejects.toThrow('cancelled or denied');
    expect(writeCredential).not.toHaveBeenCalled();
    expect(apiSend).toHaveBeenCalledOnce();
    expect(closeCallback).toHaveBeenCalledOnce();
  });

  it('aborts on Ctrl-C and removes its signal handlers', async (): Promise<void> => {
    const before = process.listenerCount('SIGINT');
    vi.mocked(open).mockResolvedValueOnce(new ChildProcess());
    const running = loginCommand.run([], 'request-1');
    const rejected = expect(running).rejects.toThrow('Sign-in cancelled');
    await vi.waitFor((): void => expect(open).toHaveBeenCalledOnce());
    process.emit('SIGINT');
    await rejected;
    expect(process.listenerCount('SIGINT')).toBe(before);
    expect(writeCredential).not.toHaveBeenCalled();
    expect(closeCallback).toHaveBeenCalledOnce();
  });

  it.each(['start', 'exchange'] as const)(
    'cancels an in-flight %s request and closes the listener',
    async (stage: 'start' | 'exchange'): Promise<void> => {
      vi.mocked(apiSend).mockImplementation(
        async (path, _method, body, options): Promise<unknown> => {
          if (path === '/api/auth/cli/start') started = CliLoginStartSchema.parse(body);
          if (path === `/api/auth/cli/${stage}`) {
            return new Promise<never>((_resolve, reject): void => {
              options?.signal?.addEventListener('abort', (): void => reject(new Error('aborted')), {
                once: true,
              });
            });
          }
          return { authorizationUrl, expiresAt: Date.now() + 600_000 };
        },
      );
      const running = loginCommand.run([], 'request-1');
      const rejected = expect(running).rejects.toThrow('Sign-in cancelled');
      await vi.waitFor((): void =>
        expect(apiSend).toHaveBeenCalledWith(`/api/auth/cli/${stage}`, 'POST', expect.any(Object), {
          signal: expect.any(AbortSignal),
        }),
      );
      process.emit('SIGINT');
      await rejected;
      expect(writeCredential).not.toHaveBeenCalled();
      expect(closeCallback).toHaveBeenCalledOnce();
    },
  );

  it('does not start another login until pending revocations succeed', async (): Promise<void> => {
    vi.mocked(retireStoredSessions).mockResolvedValue({ hadSessions: true, failures: 1 });
    await expect(loginCommand.run([], 'request-1')).rejects.toThrow(
      'server session revocation(s) failed',
    );
    expect(apiSend).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('revokes a newly created session when credential persistence fails', async (): Promise<void> => {
    vi.mocked(writeCredential).mockImplementation((): never => {
      throw new Error(`write failed: ${token}`);
    });
    await expect(loginCommand.run([], 'request-1')).rejects.toThrow(
      'Its server session was revoked',
    );
    expect(revokeSession).toHaveBeenCalledWith(token);
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(token);
  });

  it('reports failed persistence and revocation without exposing the bearer', async (): Promise<void> => {
    vi.mocked(writeCredential).mockImplementation((): never => {
      throw new Error(`write failed: ${token}`);
    });
    vi.mocked(revokeSession).mockRejectedValue(new Error(`revoke failed: ${token}`));
    await expect(loginCommand.run([], 'request-1')).rejects.toThrow(
      'Could not save the new credential or revoke its server session',
    );
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(token);
  });

  it('rejects invalid exchange responses without printing raw Zod input', async (): Promise<void> => {
    vi.mocked(apiSend).mockResolvedValueOnce({ authorizationUrl, expiresAt: Date.now() + 600_000 });
    // Populate `started` for the real callback when the one-shot mock runs.
    vi.mocked(open).mockImplementation(async (): Promise<ChildProcess> => {
      started = CliLoginStartSchema.parse(vi.mocked(apiSend).mock.calls[0]?.[2]);
      await callback();
      return new ChildProcess();
    });
    vi.mocked(apiSend).mockResolvedValueOnce({ ...session, expiresAt: token });
    await expect(loginCommand.run([], 'request-1')).rejects.toThrow('invalid sign-in session');
    expect(writeCredential).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(token);
  });

  it('shows help without opening a browser or touching existing sessions', async (): Promise<void> => {
    await loginCommand.run(['--help'], 'request-1');
    expect(retireStoredSessions).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No code needs to be copied'));
  });

  it('sanitizes backend errors that echo a token or authentication payload', async (): Promise<void> => {
    vi.mocked(apiSend).mockRejectedValueOnce(new Error(`backend failure: ${token}`));
    await expect(loginCommand.run([], 'request-1')).rejects.toThrow(
      'Cannot start sign-in. Check that the backend is reachable and run login again.',
    );
    expect(open).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(token);
  });
});
