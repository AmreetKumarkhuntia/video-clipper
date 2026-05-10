import { log } from '@lib/utils/logger.js';

/**
 * Retries an async function up to `retries` times on any thrown error.
 *
 * Backoff schedule: delay = baseDelayMs × 2^attempt
 *   attempt 0 fails → wait baseDelayMs   (e.g. 2000ms)
 *   attempt 1 fails → wait baseDelayMs×2 (e.g. 4000ms)
 *   attempt 2 fails → wait baseDelayMs×4 (e.g. 8000ms)
 *   …
 *
 * When retries = 0 the function is called exactly once with no retry.
 * The final error (after all attempts) is re-thrown to the caller.
 *
 * @param fn         - Async function to execute
 * @param retries    - Maximum number of additional attempts after the first failure
 * @param baseDelayMs - Base delay in milliseconds for the first retry
 * @param label      - Optional label included in warn logs (e.g. "yt-dlp:videoId")
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  retries: number,
  baseDelayMs: number,
  label?: string,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        const message = err instanceof Error ? err.message : String(err);
        log.warn(
          'retryAsync',
          `attempt ${attempt + 1}/${retries + 1} failed: ${message} — retrying in ${delayMs / 1000}s`,
          undefined,
          label ? { label } : undefined,
        );
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
