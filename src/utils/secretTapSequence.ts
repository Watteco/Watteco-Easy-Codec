export interface SecretTapSequenceOptions {
  requiredTaps: number;
  timeoutMs: number;
  onComplete: () => void;
}

export interface SecretTapSequence {
  tap: (enabled?: boolean) => void;
  reset: () => void;
}

/**
 * Counts a short, invisible sequence of taps without exposing reactive state to
 * the UI. This keeps easter-egg behaviour out of the component that hosts it.
 */
export function createSecretTapSequence({
  requiredTaps,
  timeoutMs,
  onComplete,
}: SecretTapSequenceOptions): SecretTapSequence {
  let tapCount = 0;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const reset = () => {
    tapCount = 0;
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = undefined;
  };

  const tap = (enabled = true) => {
    if (!enabled) {
      reset();
      return;
    }

    if (tapCount === 0) {
      resetTimer = setTimeout(reset, timeoutMs);
    }

    tapCount += 1;
    if (tapCount < requiredTaps) return;

    reset();
    onComplete();
  };

  return { tap, reset };
}
