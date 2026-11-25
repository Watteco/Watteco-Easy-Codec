import { Capacitor } from '@capacitor/core';
import { readonly, ref } from 'vue';

interface VersionManifest {
  version: string;
}

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const UPDATE_ATTEMPT_KEY = 'easycodec.web-update-attempt';

const updateAvailable = ref(false);
const availableVersion = ref<string>();
let checksStarted = false;

export function parseVersionManifest(value: unknown): VersionManifest | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const candidate = value as Partial<VersionManifest>;
  if (typeof candidate.version !== 'string' || !candidate.version) return undefined;

  return { version: candidate.version };
}

export function buildWebUpdateUrl(currentUrl: string, version: string): string {
  const url = new URL(currentUrl);
  url.searchParams.set('update', version);
  return url.href;
}

function reloadWithFreshEntryPoint(version: string) {
  window.location.replace(buildWebUpdateUrl(window.location.href, version));
}

function previousUpdateAttempt(): string | null {
  try {
    return sessionStorage.getItem(UPDATE_ATTEMPT_KEY);
  } catch {
    return null;
  }
}

function rememberUpdateAttempt(version: string) {
  try {
    sessionStorage.setItem(UPDATE_ATTEMPT_KEY, version);
  } catch {
    // The cache-busting URL still works when session storage is unavailable.
  }
}

export async function checkForWebUpdate(allowAutomaticReload = false): Promise<void> {
  if (Capacitor.isNativePlatform() || !import.meta.env.PROD) return;

  try {
    const manifestUrl = new URL('version.json', `${window.location.origin}${import.meta.env.BASE_URL}`);
    manifestUrl.searchParams.set('check', Date.now().toString());

    const response = await fetch(manifestUrl, { cache: 'no-store' });
    if (!response.ok) return;

    const manifest = parseVersionManifest(await response.json());
    if (!manifest || manifest.version === __APP_VERSION__) return;

    availableVersion.value = manifest.version;

    if (allowAutomaticReload && previousUpdateAttempt() !== manifest.version) {
      rememberUpdateAttempt(manifest.version);
      reloadWithFreshEntryPoint(manifest.version);
      return;
    }

    updateAvailable.value = true;
  } catch (error) {
    console.debug('Web update check failed', error);
  }
}

export function installWebUpdateChecks() {
  if (checksStarted || Capacitor.isNativePlatform() || !import.meta.env.PROD) return;
  checksStarted = true;

  void checkForWebUpdate(true);
  window.setInterval(() => void checkForWebUpdate(), CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForWebUpdate();
  });
}

export function applyWebUpdate() {
  if (!updateAvailable.value) return;
  reloadWithFreshEntryPoint(`${availableVersion.value ?? 'latest'}-${Date.now()}`);
}

export function useWebUpdate() {
  return {
    updateAvailable: readonly(updateAvailable),
    availableVersion: readonly(availableVersion),
    applyWebUpdate,
  };
}
