import { computed, reactive, type ComputedRef } from 'vue';

const STORAGE_KEY_PREFIX = 'easycodec.stateVisualInverted.';
const storedPreferences = reactive<Record<string, boolean>>({});

const readPreference = (key: string): boolean => {
  if (!(key in storedPreferences)) {
    storedPreferences[key] = typeof localStorage !== 'undefined'
      && localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`) === 'true';
  }
  return storedPreferences[key];
};

export function useStateVisualPreference(getPreferenceKey: () => string): {
  inverted: ComputedRef<boolean>;
  setInverted: (value: boolean) => void;
  toggleInversion: () => void;
} {
  const inverted = computed(() => readPreference(getPreferenceKey()));

  const setInverted = (value: boolean) => {
    const key = getPreferenceKey();
    storedPreferences[key] = value;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, String(value));
    }
  };

  return {
    inverted,
    setInverted,
    toggleInversion: () => setInverted(!inverted.value),
  };
}
