import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type StatusBarBackground = 'light' | 'dark';

export const getStatusBarStyle = (background: StatusBarBackground): Style => (
  // Capacitor names the style after the background, not the icon colour.
  background === 'light' ? Style.Light : Style.Dark
);

export const setStatusBarStyle = (background: StatusBarBackground): void => {
  if (!Capacitor.isNativePlatform()) return;

  void StatusBar.setStyle({ style: getStatusBarStyle(background) }).catch(() => {
    // Keep the application usable if the native status bar cannot be configured.
  });
};
