import { Style } from '@capacitor/status-bar';
import { describe, expect, it } from 'vitest';
import { getStatusBarStyle } from '@/utils/statusBar';

describe('status bar style', () => {
  it('uses dark icons on a light background', () => {
    expect(getStatusBarStyle('light')).toBe(Style.Light);
  });

  it('uses light icons on a dark background', () => {
    expect(getStatusBarStyle('dark')).toBe(Style.Dark);
  });
});
