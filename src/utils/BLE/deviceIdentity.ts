import {
  formatEuiInput,
  getFormattedEuiInputCaret,
  normalizeEuiInput,
} from '@/utils/euiInput';

export const WATTECO_DEV_EUI_PREFIX = '70B3D5E7';

export const BLE_SENSOR_NAME_PREFIX = 'WS5';
export const BLE_SENSOR_NAME_PATTERN = /^WS5[0-9A-F]{7}$/i;
export const BLE_OTA_LOADER_NAME_PATTERN = /^WS5[0-9A-F]{7}\.OTA$/i;
export const BLE_SPECIAL_MODE_NAME_PATTERN = /^WS5[0-9A-F]{7}\.BBS$/i;

export function normalizeDevEuiSuffixInput(value?: string): string {
  return normalizeEuiInput(value, { fixedPrefix: WATTECO_DEV_EUI_PREFIX });
}

export function formatDevEuiSuffix(value?: string): string {
  return formatEuiInput(value, { fixedPrefix: WATTECO_DEV_EUI_PREFIX });
}

export function getFormattedDevEuiSuffixCaret(
  value: string,
  selectionStart: number | null,
): number {
  return getFormattedEuiInputCaret(value, selectionStart, {
    fixedPrefix: WATTECO_DEV_EUI_PREFIX,
  });
}

export function deriveBleDeviceNameFromDevEuiSuffix(value?: string): string | null {
  const normalized = normalizeDevEuiSuffixInput(value);
  if (!/^[0-9A-F]{8}$/.test(normalized)) return null;
  return `WS${normalized}`;
}

export function isBleSensorName(deviceName?: string): boolean {
  return BLE_SENSOR_NAME_PATTERN.test(deviceName?.trim() ?? '');
}

export function isBleOtaLoaderName(deviceName?: string): boolean {
  return BLE_OTA_LOADER_NAME_PATTERN.test(deviceName?.trim() ?? '');
}

export function isBleSpecialModeName(deviceName?: string): boolean {
  return BLE_SPECIAL_MODE_NAME_PATTERN.test(deviceName?.trim() ?? '');
}

export function isBleSensorOrOtaName(deviceName?: string): boolean {
  return isBleSensorName(deviceName) || isBleOtaLoaderName(deviceName);
}

export function isBleDiscoverableName(deviceName?: string): boolean {
  return isBleSensorOrOtaName(deviceName) || isBleSpecialModeName(deviceName);
}

export function matchesTargetBleName(deviceName: string | undefined, targetName: string): boolean {
  const normalizedDeviceName = deviceName?.trim().toUpperCase();
  const normalizedTargetName = targetName.trim().toUpperCase();
  return normalizedDeviceName === normalizedTargetName;
}

export function deriveDevEuiFromDeviceName(deviceName?: string): string | null {
  const normalizedName = deviceName?.trim().toUpperCase().replace(/\.(?:BBS|OTA)$/, '');
  const extendedWsMatch = normalizedName?.match(/^WS([0-9A-F]{8})$/);
  if (extendedWsMatch) return `${WATTECO_DEV_EUI_PREFIX}${extendedWsMatch[1]}`;

  const legacyMatch = normalizedName?.match(/^(?:WS|WTC)([0-9A-F]{6})$/);
  return legacyMatch ? `${WATTECO_DEV_EUI_PREFIX}5F${legacyMatch[1]}` : null;
}

export function formatDevEui(devEui?: string | null): string | null {
  const normalizedDevEui = devEui?.replace(/[:-]/g, '').trim().toUpperCase();
  if (!normalizedDevEui?.match(/^[0-9A-F]{16}$/)) return null;
  return normalizedDevEui.match(/.{2}/g)?.join(':') ?? null;
}
