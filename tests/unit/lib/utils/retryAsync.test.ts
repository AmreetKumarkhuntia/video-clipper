import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryAsync } from '@lib/utils/retryAsync.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('retryAsync', () => {
  it('returns immediately after a successful attempt', async () => {
    const operation = vi.fn(async () => 'ok');

    await expect(retryAsync(operation, 3, 100)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledOnce();
  });

  it('uses exponential delays and stops after a later success', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValue('ok');

    const result = retryAsync(operation, 2, 100);
    await vi.advanceTimersByTimeAsync(100);
    expect(operation).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(200);

    await expect(result).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('rethrows the final failure after the retry budget is exhausted', async () => {
    const failure = new Error('still broken');
    const operation = vi.fn(async (): Promise<never> => {
      throw failure;
    });

    await expect(retryAsync(operation, 0, 100)).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledOnce();
  });
});
