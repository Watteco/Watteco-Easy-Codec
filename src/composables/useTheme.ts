import { readonly, ref } from 'vue';

const STORAGE_KEY = 'easycodec.darkMode';
const DARK_CLASS = 'ion-palette-dark';
const darkModeState = ref(false);

function applyTheme(enabled: boolean) {
  if (typeof document === 'undefined') return;

  document.documentElement.classList.toggle(DARK_CLASS, enabled);
  document.documentElement.style.colorScheme = enabled ? 'dark' : 'light';
}

export function initializeTheme() {
  if (typeof localStorage !== 'undefined') {
    darkModeState.value = localStorage.getItem(STORAGE_KEY) === 'true';
  }
  applyTheme(darkModeState.value);
}

export function useTheme() {
  const setDarkMode = (enabled: boolean) => {
    darkModeState.value = enabled;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    }
    applyTheme(enabled);
  };

  return {
    isDarkMode: readonly(darkModeState),
    setDarkMode,
  };
}
