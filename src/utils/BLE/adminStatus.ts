import { BleClient } from '@capacitor-community/bluetooth-le';
import {
  ADMIN_RUNNING_TIME_CHAR_UUID,
  ADMIN_UNIX_TIME_CHAR_UUID,
  DATE_TIME_CHAR_UUID,
  OSA_ADMIN_SERVICE_UUID,
  OSA_STATUS_CHAR_UUID,
  normalizeUuid,
} from '@/utils/BLE/characteristics';
import { toUint8ArrayFromBleValue } from '@/utils/BLE/blob';

export type AdminDeviceStatus = {
  sensorTime: number | null;
  runningTimeSeconds: number | null;
  osaAuthenticated: boolean | null;
};

export function decodeUnixTime(value: unknown): number | null {
  const bytes = toUint8ArrayFromBleValue(value);
  if (!bytes || bytes.length < 4) return null;
  const seconds = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
  return seconds > 0 ? seconds * 1000 : null;
}

export function decodeRunningTime(value: unknown): number | null {
  const bytes = toUint8ArrayFromBleValue(value);
  if (!bytes || bytes.length < 4) return null;
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
}

export function decodeDateTime(value: unknown): number | null {
  const bytes = toUint8ArrayFromBleValue(value);
  if (!bytes || bytes.length < 7) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const year = view.getUint16(0, true);
  const month = bytes[2];
  const day = bytes[3];
  const hour = bytes[4];
  const minute = bytes[5];
  const second = bytes[6];
  if (year < 1970 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  return new Date(year, month - 1, day, hour, minute, second).getTime();
}

export function decodeOsaAuthenticated(value: unknown): boolean | null {
  const bytes = toUint8ArrayFromBleValue(value);
  if (!bytes?.length) return null;
  return bytes[0] === 0x02;
}

export async function readAdminDeviceStatus(
  deviceId: string,
  onLog: (line: string) => void,
): Promise<AdminDeviceStatus> {
  const services = await BleClient.getServices(deviceId);
  const service = services.find(candidate => normalizeUuid(candidate.uuid) === OSA_ADMIN_SERVICE_UUID);
  if (!service) throw new Error('Administration service 8001 is unavailable');

  const findCharacteristic = (uuid: string) => service.characteristics?.find(candidate => (
    normalizeUuid(candidate.uuid) === uuid
  ));
  const read = async (uuid: string): Promise<unknown | null> => {
    const characteristic = findCharacteristic(uuid);
    if (!characteristic?.properties.read) return null;
    try {
      return await BleClient.read(deviceId, service.uuid, characteristic.uuid);
    } catch (error: any) {
      onLog(`[ADMIN] Read ${uuid.slice(4, 8)} failed: ${error?.message ?? error}`);
      return null;
    }
  };

  const [unixTimeRaw, dateTimeRaw, runningTimeRaw, authStatusRaw] = await Promise.all([
    read(ADMIN_UNIX_TIME_CHAR_UUID),
    read(DATE_TIME_CHAR_UUID),
    read(ADMIN_RUNNING_TIME_CHAR_UUID),
    read(OSA_STATUS_CHAR_UUID),
  ]);
  const sensorTime = decodeUnixTime(unixTimeRaw) ?? decodeDateTime(dateTimeRaw);
  const runningTimeSeconds = decodeRunningTime(runningTimeRaw);
  const osaAuthenticated = decodeOsaAuthenticated(authStatusRaw);
  onLog('[ADMIN] Device status refreshed');
  return { sensorTime, runningTimeSeconds, osaAuthenticated };
}
