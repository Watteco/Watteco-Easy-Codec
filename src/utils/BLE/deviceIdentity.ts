export const WATTECO_DEV_EUI_PREFIX = '70B3D5E7';

export const BLE_SENSOR_NAME_PREFIX = 'WS5';
export const BLE_SENSOR_NAME_PATTERN = /^WS5[0-9A-F]{7}$/i;
export const BLE_OTA_LOADER_NAME_PATTERN = /^WS5[0-9A-F]{7}\.OTA$/i;
export const BLE_SPECIAL_MODE_NAME_PATTERN = /^WS5[0-9A-F]{7}\.BBS$/i;

export function normalizeDevEuiSuffixInput(value?: string): string {
  let normalized = value?.replace(/[^0-9A-F]/gi, '').toUpperCase() ?? '';
  if (normalized.length === 16) {
    if (!normalized.startsWith(WATTECO_DEV_EUI_PREFIX)) return '';
    normalized = normalized.slice(WATTECO_DEV_EUI_PREFIX.length);
  }
  return normalized.slice(0, 8);
}

export function formatDevEuiSuffix(value?: string): string {
  const normalized = normalizeDevEuiSuffixInput(value);
  return normalized.match(/.{1,2}/g)?.join(':') ?? '';
}

export function getFormattedDevEuiSuffixCaret(
  value: string,
  selectionStart: number | null,
): number {
  const caret = selectionStart ?? value.length;
  const compactValue = value.replace(/[^0-9A-F]/gi, '').toUpperCase();
  const hexBeforeCaret = value.slice(0, caret).replace(/[^0-9A-F]/gi, '').length;
  const pastedFullDevEui = compactValue.length === 16
    && compactValue.startsWith(WATTECO_DEV_EUI_PREFIX);
  const suffixHexBeforeCaret = pastedFullDevEui
    ? Math.max(0, hexBeforeCaret - WATTECO_DEV_EUI_PREFIX.length)
    : hexBeforeCaret;
  const suffixLength = normalizeDevEuiSuffixInput(value).length;
  const boundedHexCount = Math.min(suffixHexBeforeCaret, suffixLength);

  if (boundedHexCount === 0) return 0;
  return boundedHexCount + Math.floor((boundedHexCount - 1) / 2);
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
