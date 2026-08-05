export const UUID_BASE_SUFFIX = '-0000-1000-8000-00805f9b34fb';

export const CABLE_REPLACEMENT_SERVICE_SHORT = 'fe60';
export const CABLE_REPLACEMENT_RX_SHORT = 'fe61';
export const CABLE_REPLACEMENT_TX_SHORT = 'fe62';

export const FF_SERVICE_SHORT = 'ff00';
export const FF_WRITE_SHORT = 'ff01';
export const FF_NOTIFY_SHORT = 'ff02';

export const OSA_ADMIN_SERVICE_UUID = '80018001-890d-4f4e-a197-3f9eb158ea95';
export const OSA_CHALLENGE_CHAR_UUID = '8001c801-890d-4f4e-a197-3f9eb158ea95';
export const OSA_RESPONSE_CHAR_UUID = '8001c802-890d-4f4e-a197-3f9eb158ea95';

export function normalizeUuid(uuid: string): string {
  if (!uuid) return uuid;
  const lower = uuid.toLowerCase();
  if (/^[0-9a-f]{4}$/.test(lower)) {
    return `0000${lower}${UUID_BASE_SUFFIX}`;
  }
  return lower;
}

export function includesShortUuid(uuid: string, shortUuid: string): boolean {
  return (uuid || '').toLowerCase().includes((shortUuid || '').toLowerCase());
}
