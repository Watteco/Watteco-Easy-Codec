import { computed, ref } from 'vue';

const STORAGE_KEY = 'easycodec.developerMode';

export const developerModeAvailable = (
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_BLE_DEBUG === 'true'
);

function getInitialDeveloperMode(): boolean {
  if (!developerModeAvailable) return false;

  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

const developerModeState = ref(getInitialDeveloperMode());
const developerModeEnabled = computed(() => (
  developerModeAvailable && developerModeState.value
));

function setDeveloperMode(enabled: boolean): boolean {
  developerModeState.value = developerModeAvailable && enabled;

  try {
    localStorage.setItem(STORAGE_KEY, String(developerModeState.value));
  } catch {
    // Keep the selected mode for this session if persistence is unavailable.
  }

  return developerModeState.value;
}

function toggleDeveloperMode(): boolean {
  return setDeveloperMode(!developerModeState.value);
}

export function useDeveloperMode() {
  return {
    developerModeAvailable,
    developerModeEnabled,
    setDeveloperMode,
    toggleDeveloperMode,
  };
}
