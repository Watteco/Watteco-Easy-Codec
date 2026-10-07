export const UUID_BASE_SUFFIX = '-0000-1000-8000-00805f9b34fb';

export const CABLE_REPLACEMENT_SERVICE_SHORT = 'fe60';
export const CABLE_REPLACEMENT_RX_SHORT = 'fe61';
export const CABLE_REPLACEMENT_TX_SHORT = 'fe62';

export const FF_SERVICE_SHORT = 'ff00';
export const FF_WRITE_SHORT = 'ff01';
export const FF_NOTIFY_SHORT = 'ff02';

export const OSA_ADMIN_SERVICE_UUID = '80018001-890d-4f4e-a197-3f9eb158ea95';
export const LORA_SERVICE_UUID = '80028002-890d-4f4e-a197-3f9eb158ea95';
export const MEASURES_SERVICE_UUID = '80038003-890d-4f4e-a197-3f9eb158ea95';
export const PRODUCT_ID_CHAR_UUID = '8001c001-890d-4f4e-a197-3f9eb158ea95';
export const ADMIN_FW_LONG_NAME_CHAR_UUID = '8001c002-890d-4f4e-a197-3f9eb158ea95';
export const ADMIN_UNIX_TIME_CHAR_UUID = '8001c003-890d-4f4e-a197-3f9eb158ea95';
export const ADMIN_RUNNING_TIME_CHAR_UUID = '8001c004-890d-4f4e-a197-3f9eb158ea95';
export const ADMIN_REBOOT_CHAR_UUID = '8001c005-890d-4f4e-a197-3f9eb158ea95';
export const ADMIN_APP_TX_CHAR_UUID = '8001c006-890d-4f4e-a197-3f9eb158ea95';
export const ADMIN_APP_RX_CHAR_UUID = '8001c007-890d-4f4e-a197-3f9eb158ea95';
export const LORA_LINK_STATUS_CHAR_UUID = '8002c001-890d-4f4e-a197-3f9eb158ea95';
export const LORA_LINK_TEST_CHAR_UUID = '8002c002-890d-4f4e-a197-3f9eb158ea95';
export const PULSE_COUNT_CHAR_UUID = '8003c001-890d-4f4e-a197-3f9eb158ea95';
export const BATTERY_LEVEL_CHAR_UUID = `00002a19${UUID_BASE_SUFFIX}`;
export const DATE_TIME_CHAR_UUID = `00002a08${UUID_BASE_SUFFIX}`;
export const TEMPERATURE_CHAR_UUID = `00002a6e${UUID_BASE_SUFFIX}`;
export const HUMIDITY_CHAR_UUID = `00002a6f${UUID_BASE_SUFFIX}`;
export const ON_OFF_CHAR_UUID = `00002a56${UUID_BASE_SUFFIX}`;
export const PRESENTATION_FORMAT_DESCRIPTOR_UUID = `00002904${UUID_BASE_SUFFIX}`;
export const OSA_CHALLENGE_CHAR_UUID = '8001c801-890d-4f4e-a197-3f9eb158ea95';
export const OSA_RESPONSE_CHAR_UUID = '8001c802-890d-4f4e-a197-3f9eb158ea95';
export const OSA_STATUS_CHAR_UUID = '8001c803-890d-4f4e-a197-3f9eb158ea95';

export const BLOB_INFO_CHAR_UUID = '8001cc01-890d-4f4e-a197-3f9eb158ea95';
export const BLOB_COMMAND_CHAR_UUID = '8001cc02-890d-4f4e-a197-3f9eb158ea95';
export const BLOB_STATUS_CHAR_UUID = '8001cc03-890d-4f4e-a197-3f9eb158ea95';
export const BLOB_DATA_CHAR_UUID = '8001cc04-890d-4f4e-a197-3f9eb158ea95';
export const ADMIN_EVENT_CHAR_UUID = '8001cd01-890d-4f4e-a197-3f9eb158ea95';

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
