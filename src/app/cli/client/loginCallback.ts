import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CliCallbackSchema, CliStateSchema } from '@lib/types/cliAuth.js';
import type {
  CliCallback,
  CliCallbackListener,
  CliCallbackListenerOptions,
} from '@lib/types/cliAuth.js';

function reply(response: ServerResponse, status: number, message: string): void {
  response.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    connection: 'close',
  });
  response.end(message);
}

/** Binds only IPv4 loopback, and leaves the listener usable after invalid callbacks. */
export async function startLoginCallback(
  options: CliCallbackListenerOptions,
): Promise<CliCallbackListener> {
  if (!CliStateSchema.safeParse(options.state).success) {
    throw new Error('Cannot start sign-in: invalid callback state.');
  }
  if (options.signal?.aborted) throw new Error('Sign-in cancelled.');

  let resolveResult!: (callback: CliCallback) => void;
  let rejectResult!: (error: Error) => void;
  const result = new Promise<CliCallback>((resolve, reject): void => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  // The browser callback may time out while the caller is still awaiting /start.
  // Observe the rejection now; awaiting `result` still receives the same failure.
  void result.catch((): void => {});

  let redirectUri = '';
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closing: Promise<void> | undefined;
  const server = createServer((request: IncomingMessage, response: ServerResponse): void => {
    if (finished) {
      reply(response, 410, 'This sign-in callback is no longer active.');
      return;
    }
    if (request.method !== 'GET') {
      reply(response, 405, 'Sign-in callbacks require GET.');
      return;
    }
    const expected = new URL(redirectUri);
    let callbackUrl: URL;
    try {
      callbackUrl = new URL(request.url ?? '', expected);
    } catch {
      reply(response, 400, 'Invalid sign-in callback.');
      return;
    }
    if (
      request.headers.host !== expected.host ||
      callbackUrl.origin !== expected.origin ||
      callbackUrl.pathname !== expected.pathname ||
      !request.url?.startsWith('/callback?')
    ) {
      reply(response, 404, 'No sign-in callback at this address.');
      return;
    }

    const entries = [...callbackUrl.searchParams.entries()];
    if (new Set(entries.map(([key]: [string, string]): string => key)).size !== entries.length) {
      reply(response, 400, 'Invalid sign-in callback.');
      return;
    }
    const parsed = CliCallbackSchema.safeParse(Object.fromEntries(entries));
    const received = parsed.success ? Buffer.from(parsed.data.state) : Buffer.alloc(0);
    const expectedState = Buffer.from(options.state);
    if (
      !parsed.success ||
      received.length !== expectedState.length ||
      !timingSafeEqual(received, expectedState)
    ) {
      reply(response, 400, 'Invalid sign-in callback.');
      return;
    }

    finished = true;
    reply(
      response,
      200,
      'Sign-in response received. You can close this window and return to your terminal.',
    );
    resolveResult(parsed.data);
    void closeServer();
  });

  function removeHandlers(): void {
    if (timer !== undefined) clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }

  function closeServer(force = false): Promise<void> {
    removeHandlers();
    if (!closing) {
      closing = new Promise((resolve): void => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close((): void => resolve());
        // Node 18 does not automatically close idle keep-alive connections.
        server.closeIdleConnections();
      });
    }
    if (force) server.closeAllConnections();
    return closing;
  }

  function fail(message: string): void {
    if (finished) return;
    finished = true;
    rejectResult(new Error(message));
    void closeServer(true);
  }

  function cancel(): void {
    fail('Sign-in cancelled.');
  }

  try {
    await new Promise<void>((resolve, reject): void => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', (): void => {
        server.removeListener('error', reject);
        resolve();
      });
    });
  } catch {
    fail('Cannot listen for sign-in on 127.0.0.1.');
    throw new Error('Cannot listen for sign-in on 127.0.0.1.');
  }
  server.on('error', (): void => fail('The local sign-in callback listener failed.'));
  const address = server.address();
  if (!address || typeof address === 'string') {
    fail('Cannot determine the local sign-in callback address.');
    throw new Error('Cannot determine the local sign-in callback address.');
  }
  redirectUri = `http://127.0.0.1:${address.port}/callback`;
  timer = setTimeout((): void => fail('Sign-in timed out. Run login again.'), options.timeoutMs);
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();

  return {
    redirectUri,
    result,
    close: async (): Promise<void> => {
      cancel();
      await closeServer(true);
    },
  };
}
