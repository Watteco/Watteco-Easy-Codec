const HEX_64_PATTERN = /^[0-9A-F]{16}$/;

/** Extract a DevEUI from a LoRaWAN TR005 `LW:D0` QR payload. */
export function extractDevEuiFromQrPayload(payload?: string | null): string | null {
  const normalizedPayload = payload?.trim().toUpperCase();
  if (!normalizedPayload) return null;

  // Also support labels whose 2D code contains only the DevEUI.
  const bareDevEui = normalizedPayload.replace(/[:-]/g, '');
  if (HEX_64_PATTERN.test(bareDevEui)) return bareDevEui;

  const fields = normalizedPayload.split(':');
  if (fields[0] !== 'LW' || fields[1] !== 'D0') return null;

  const joinEui = fields[2];
  const devEui = fields[3];
  if (!HEX_64_PATTERN.test(joinEui ?? '') || !HEX_64_PATTERN.test(devEui ?? '')) {
    return null;
  }

  return devEui;
}
