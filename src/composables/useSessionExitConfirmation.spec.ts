import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionExitConfirmation } from './useSessionExitConfirmation';

describe('useSessionExitConfirmation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('enables confirmation by default', () => {
    const { confirmationEnabled } = useSessionExitConfirmation();

    expect(confirmationEnabled.value).toBe(true);
  });

  it('persists a disabled confirmation', () => {
    const { confirmationEnabled, setConfirmationEnabled } = useSessionExitConfirmation();

    setConfirmationEnabled(false);

    expect(confirmationEnabled.value).toBe(false);
    expect(localStorage.getItem('easycodec.confirmSessionExit')).toBe('false');
    expect(useSessionExitConfirmation().confirmationEnabled.value).toBe(false);
  });

  it('can re-enable confirmation from the settings', () => {
    localStorage.setItem('easycodec.confirmSessionExit', 'false');
    const { confirmationEnabled, setConfirmationEnabled } = useSessionExitConfirmation();

    setConfirmationEnabled(true);

    expect(confirmationEnabled.value).toBe(true);
    expect(localStorage.getItem('easycodec.confirmSessionExit')).toBe('true');
  });
});
