import { beforeEach, describe, expect, it } from 'vitest';
import { initializeTheme, useTheme } from '@/composables/useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('ion-palette-dark');
    useTheme().setDarkMode(false);
    localStorage.clear();
  });

  it('persists and applies dark mode', () => {
    const theme = useTheme();

    theme.setDarkMode(true);

    expect(theme.isDarkMode.value).toBe(true);
    expect(localStorage.getItem('easycodec.darkMode')).toBe('true');
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('restores the saved preference on startup', () => {
    localStorage.setItem('easycodec.darkMode', 'true');

    initializeTheme();

    expect(useTheme().isDarkMode.value).toBe(true);
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
  });
});
