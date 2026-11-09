import { readonly, ref } from 'vue';
import { formatDevEui } from '@/utils/BLE/deviceIdentity';

const privilegedDevEuis = ref<ReadonlySet<string>>(new Set());

function normalizeDevEui(devEui?: string | null): string | null {
  return formatDevEui(devEui)?.replaceAll(':', '') ?? null;
}

function setPrivilegedDevEuis(devEuis: Iterable<string>): void {
  const normalized = new Set<string>();

  for (const devEui of devEuis) {
    const value = normalizeDevEui(devEui);
    if (value) normalized.add(value);
  }

  privilegedDevEuis.value = normalized;
}

function clearPrivilegedDevEuis(): void {
  privilegedDevEuis.value = new Set();
}

function addPrivilegedDevEui(devEui?: string | null): boolean {
  const normalized = normalizeDevEui(devEui);
  if (!normalized) return false;

  privilegedDevEuis.value = new Set(privilegedDevEuis.value).add(normalized);
  return true;
}

function hasPrivilegedAccess(devEui?: string | null): boolean {
  const normalized = normalizeDevEui(devEui);
  return normalized !== null && privilegedDevEuis.value.has(normalized);
}

export function useKmsAccess() {
  return {
    privilegedDevEuis: readonly(privilegedDevEuis),
    setPrivilegedDevEuis,
    clearPrivilegedDevEuis,
    addPrivilegedDevEui,
    hasPrivilegedAccess,
  };
}
