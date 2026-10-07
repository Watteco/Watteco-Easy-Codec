import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useDeveloperMode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('starts hidden and toggles developer mode explicitly', async () => {
    const { useDeveloperMode } = await import('./useDeveloperMode');
    const developerMode = useDeveloperMode();

    expect(developerMode.developerModeAvailable).toBe(true);
    expect(developerMode.developerModeEnabled.value).toBe(false);

    expect(developerMode.toggleDeveloperMode()).toBe(true);
    expect(developerMode.developerModeEnabled.value).toBe(true);

    expect(developerMode.toggleDeveloperMode()).toBe(false);
    expect(developerMode.developerModeEnabled.value).toBe(false);
  });

  it('does not restore developer mode from a previous app launch', async () => {
    localStorage.setItem('easycodec.developerMode', 'true');

    const { useDeveloperMode } = await import('./useDeveloperMode');

    expect(useDeveloperMode().developerModeEnabled.value).toBe(false);
  });
});
