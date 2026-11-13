import { readonly, ref } from 'vue';

const STORAGE_KEY = 'easycodec.darkMode';
const DARK_CLASS = 'ion-palette-dark';
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export type ThemeMode = 'off' | 'on' | 'system';

const themeModeState = ref<ThemeMode>('off');
const darkModeState = ref(false);
let systemThemeQuery: MediaQueryList | undefined;

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'off' || value === 'on' || value === 'system';
}

function readStoredThemeMode(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'off';

  const storedValue = localStorage.getItem(STORAGE_KEY);
  if (isThemeMode(storedValue)) return storedValue;

  // Support preferences saved by versions where dark mode was a boolean.
  return storedValue === 'true' ? 'on' : 'off';
}

function applyTheme(enabled: boolean) {
  darkModeState.value = enabled;
  if (typeof document === 'undefined') return;

  document.documentElement.classList.toggle(DARK_CLASS, enabled);
  document.documentElement.style.colorScheme = enabled ? 'dark' : 'light';
}

function stopFollowingSystemTheme() {
  if (!systemThemeQuery) return;

  if (systemThemeQuery.removeEventListener) {
    systemThemeQuery.removeEventListener('change', handleSystemThemeChange);
  } else {
    systemThemeQuery.removeListener?.(handleSystemThemeChange);
  }
  systemThemeQuery = undefined;
}

function handleSystemThemeChange(event: MediaQueryListEvent) {
  if (themeModeState.value === 'system') applyTheme(event.matches);
}

function applyThemeMode(mode: ThemeMode) {
  stopFollowingSystemTheme();

  if (mode !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
    applyTheme(mode === 'on');
    return;
  }

  systemThemeQuery = window.matchMedia(SYSTEM_DARK_QUERY);
  applyTheme(systemThemeQuery.matches);
  if (systemThemeQuery.addEventListener) {
    systemThemeQuery.addEventListener('change', handleSystemThemeChange);
  } else {
    systemThemeQuery.addListener?.(handleSystemThemeChange);
  }
}

export function initializeTheme() {
  themeModeState.value = readStoredThemeMode();
  applyThemeMode(themeModeState.value);
}

export function useTheme() {
  const setThemeMode = (mode: ThemeMode) => {
    themeModeState.value = mode;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
    applyThemeMode(mode);
  };

  const setDarkMode = (enabled: boolean) => setThemeMode(enabled ? 'on' : 'off');

  return {
    themeMode: readonly(themeModeState),
    isDarkMode: readonly(darkModeState),
    setThemeMode,
    setDarkMode,
  };
}
