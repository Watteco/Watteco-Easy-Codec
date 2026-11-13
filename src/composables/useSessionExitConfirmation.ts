import { readonly, ref } from 'vue';

const STORAGE_KEY = 'easycodec.confirmSessionExit';

const confirmationEnabledState = ref(true);

function readStoredPreference(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

export function useSessionExitConfirmation() {
  confirmationEnabledState.value = readStoredPreference();

  const setConfirmationEnabled = (enabled: boolean) => {
    confirmationEnabledState.value = enabled;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    }
  };

  return {
    confirmationEnabled: readonly(confirmationEnabledState),
    setConfirmationEnabled,
  };
}
