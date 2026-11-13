import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSecretTapSequence } from '@/utils/secretTapSequence';

describe('secret tap sequence', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('unlocks only after the requested number of enabled taps', () => {
    const onComplete = vi.fn();
    const sequence = createSecretTapSequence({ requiredTaps: 20, timeoutMs: 8_000, onComplete });

    for (let tap = 0; tap < 19; tap += 1) sequence.tap();
    expect(onComplete).not.toHaveBeenCalled();

    sequence.tap();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('forgets an incomplete sequence after the timeout', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const sequence = createSecretTapSequence({ requiredTaps: 3, timeoutMs: 1_000, onComplete });

    sequence.tap();
    sequence.tap();
    vi.advanceTimersByTime(1_000);
    sequence.tap();

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('resets immediately when tapping is disabled', () => {
    const onComplete = vi.fn();
    const sequence = createSecretTapSequence({ requiredTaps: 2, timeoutMs: 1_000, onComplete });

    sequence.tap();
    sequence.tap(false);
    sequence.tap();

    expect(onComplete).not.toHaveBeenCalled();
  });
});
