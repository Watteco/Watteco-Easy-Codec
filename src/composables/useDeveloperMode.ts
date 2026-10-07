import { computed, ref } from 'vue';

export const developerModeAvailable = (
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_BLE_DEBUG === 'true'
);

const developerModeState = ref(false);
const developerModeEnabled = computed(() => (
  developerModeAvailable && developerModeState.value
));

function setDeveloperMode(enabled: boolean): boolean {
  developerModeState.value = developerModeAvailable && enabled;
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
