import { readonly, ref } from 'vue';
import { formatDevEui } from '@/utils/BLE/deviceIdentity';

// Current builds are restricted to the engineering team and test sensors.
// Switch this on only when the real KMS authorization flow is connected.
export const KMS_ACCESS_ENFORCEMENT_ENABLED = false;

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

function hasKmsPrivilege(devEui?: string | null): boolean {
  const normalized = normalizeDevEui(devEui);
  return normalized !== null && privilegedDevEuis.value.has(normalized);
}

function hasPrivilegedAccess(devEui?: string | null): boolean {
  const normalized = normalizeDevEui(devEui);
  if (!normalized) return false;
  return !KMS_ACCESS_ENFORCEMENT_ENABLED || hasKmsPrivilege(normalized);
}

export function useKmsAccess() {
  return {
    privilegedDevEuis: readonly(privilegedDevEuis),
    setPrivilegedDevEuis,
    clearPrivilegedDevEuis,
    addPrivilegedDevEui,
    hasKmsPrivilege,
    hasPrivilegedAccess,
  };
}
