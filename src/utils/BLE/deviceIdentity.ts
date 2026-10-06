const WATTECO_DEV_EUI_PREFIX = '70B3D5E7';

export function deriveDevEuiFromDeviceName(deviceName?: string): string | null {
  const normalizedName = deviceName?.trim().toUpperCase();
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
