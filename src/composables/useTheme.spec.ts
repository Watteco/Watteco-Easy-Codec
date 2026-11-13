import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTheme, useTheme } from '@/composables/useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.classList.remove('ion-palette-dark');
    useTheme().setDarkMode(false);
    localStorage.clear();
  });

  it('persists and applies dark mode', () => {
    const theme = useTheme();

    theme.setDarkMode(true);

    expect(theme.isDarkMode.value).toBe(true);
    expect(theme.themeMode.value).toBe('on');
    expect(localStorage.getItem('easycodec.darkMode')).toBe('on');
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('restores the saved preference on startup', () => {
    localStorage.setItem('easycodec.darkMode', 'true');

    initializeTheme();

    expect(useTheme().isDarkMode.value).toBe(true);
    expect(useTheme().themeMode.value).toBe('on');
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
  });

  it('defaults to light mode', () => {
    initializeTheme();

    expect(useTheme().themeMode.value).toBe('off');
    expect(useTheme().isDarkMode.value).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('follows changes to the system theme', () => {
    let changeHandler: ((event: MediaQueryListEvent) => void) | undefined;
    const mediaQuery = {
      matches: true,
      addEventListener: vi.fn((_event, handler) => { changeHandler = handler; }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));

    useTheme().setThemeMode('system');
    expect(useTheme().isDarkMode.value).toBe(true);
    expect(localStorage.getItem('easycodec.darkMode')).toBe('system');

    changeHandler?.({ matches: false } as MediaQueryListEvent);
    expect(useTheme().isDarkMode.value).toBe(false);
  });
});
