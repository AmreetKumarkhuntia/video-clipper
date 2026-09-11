import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setConfigWritable, updateField } from '@app/web/lib/stores/config.js';

beforeEach(() => {
  vi.useFakeTimers();
  setConfigWritable(false);
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  setConfigWritable(false);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('read-only settings autosave', () => {
  it('does not queue a PATCH while the page is read-only', async () => {
    updateField('SCORE_THRESHOLD', 8);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('cancels a queued autosave when write permission disappears', async () => {
    setConfigWritable(true);
    updateField('SCORE_THRESHOLD', 8);
    setConfigWritable(false);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).not.toHaveBeenCalled();
  });
});
