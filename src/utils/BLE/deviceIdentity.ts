const WATTECO_DEV_EUI_PREFIX = '70B3D5E75F';

export function deriveDevEuiFromDeviceName(deviceName?: string): string | null {
  const match = deviceName?.trim().toUpperCase().match(/^(?:WS|WTC)([0-9A-F]{6})$/);
  return match ? `${WATTECO_DEV_EUI_PREFIX}${match[1]}` : null;
}
