import { BleClient } from '@capacitor-community/bluetooth-le';
import {
  ADMIN_FW_LONG_NAME_CHAR_UUID,
  ADMIN_RUNNING_TIME_CHAR_UUID,
  ADMIN_UNIX_TIME_CHAR_UUID,
  DATE_TIME_CHAR_UUID,
  OSA_ADMIN_SERVICE_UUID,
  OSA_STATUS_CHAR_UUID,
  normalizeUuid,
} from '@/utils/BLE/characteristics';
import { toUint8ArrayFromBleValue } from '@/utils/BLE/blob';

export type AdminDeviceStatus = {
  firmwareLongName: string | null;
  sensorTime: number | null;
  runningTimeSeconds: number | null;
  osaAuthenticated: boolean | null;
};

export type AdminTimeStatus = Pick<AdminDeviceStatus, 'sensorTime' | 'runningTimeSeconds'>;

export type AdminTimeSubscription = {
  service: string;
  characteristics: string[];
};

const MIN_PLAUSIBLE_SENSOR_TIME = Date.UTC(2020, 0, 1);

function formatTimestampForLog(value: number | null): string {
  return value === null ? 'unavailable' : `${new Date(value).toISOString()} (${value / 1_000})`;
}

export function isPlausibleSensorTime(value: number | null | undefined): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= MIN_PLAUSIBLE_SENSOR_TIME;
}

export function decodeFirmwareLongName(value: unknown): string | null {
  const bytes = toUint8ArrayFromBleValue(value);
  if (!bytes?.length) return null;
  const nulIndex = bytes.indexOf(0);
  const textBytes = nulIndex >= 0 ? bytes.subarray(0, nulIndex) : bytes;
  const decoded = new TextDecoder().decode(textBytes).trim();
  return decoded || null;
}

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

  const [firmwareLongNameRaw, unixTimeRaw, dateTimeRaw, runningTimeRaw, authStatusRaw] = await Promise.all([
    read(ADMIN_FW_LONG_NAME_CHAR_UUID),
    read(ADMIN_UNIX_TIME_CHAR_UUID),
    read(DATE_TIME_CHAR_UUID),
    read(ADMIN_RUNNING_TIME_CHAR_UUID),
    read(OSA_STATUS_CHAR_UUID),
  ]);
  const firmwareLongName = decodeFirmwareLongName(firmwareLongNameRaw);
  const unixTime = decodeUnixTime(unixTimeRaw);
  const dateTime = decodeDateTime(dateTimeRaw);
  const sensorTime = unixTime ?? dateTime;
  const runningTimeSeconds = decodeRunningTime(runningTimeRaw);
  const osaAuthenticated = decodeOsaAuthenticated(authStatusRaw);
  onLog(`[ADMIN] READ UnixTS = ${formatTimestampForLog(unixTime)}`);
  onLog(`[ADMIN] READ DateTime = ${formatTimestampForLog(dateTime)}`);
  onLog(`[ADMIN] READ RunningTime = ${runningTimeSeconds ?? 'unavailable'} s`);
  onLog('[ADMIN] Device status refreshed');
  return { firmwareLongName, sensorTime, runningTimeSeconds, osaAuthenticated };
}

export async function startAdminTimeMonitoring(
  deviceId: string,
  onStatusChange: (status: Partial<AdminTimeStatus>) => void,
  onLog: (line: string) => void,
): Promise<AdminTimeSubscription | undefined> {
  onLog('[ADMIN] Time monitoring start requested');
  let services;
  try {
    services = await BleClient.getServices(deviceId);
  } catch (error: any) {
    onLog(`[ADMIN] Time monitoring service discovery failed: ${error?.message ?? error}`);
    return undefined;
  }
  const service = services.find(candidate => normalizeUuid(candidate.uuid) === OSA_ADMIN_SERVICE_UUID);
  if (!service) {
    onLog('[ADMIN] Administration service 8001 is unavailable');
    return undefined;
  }

  const findNotifiableCharacteristic = (uuids: string[]) => uuids
    .map(uuid => service.characteristics?.find(candidate => normalizeUuid(candidate.uuid) === uuid))
    .find(characteristic => characteristic?.properties.notify || characteristic?.properties.indicate);
  const timeCharacteristic = findNotifiableCharacteristic([
    ADMIN_UNIX_TIME_CHAR_UUID,
    DATE_TIME_CHAR_UUID,
  ]);
  const runningTimeCharacteristic = findNotifiableCharacteristic([ADMIN_RUNNING_TIME_CHAR_UUID]);
  const subscriptions: string[] = [];

  const subscribe = async (
    characteristic: NonNullable<typeof timeCharacteristic>,
    processValue: (value: unknown) => void,
    label: string,
  ): Promise<void> => {
    try {
      let firstNotificationReceived = false;
      await BleClient.startNotifications(
        deviceId,
        service.uuid,
        characteristic.uuid,
        value => {
          if (!firstNotificationReceived) {
            firstNotificationReceived = true;
            onLog(`[ADMIN] ${label} first notification received`);
          }
          processValue(value);
        },
      );
      subscriptions.push(characteristic.uuid);
      onLog(`[ADMIN] ${label} notifications enabled`);
    } catch (error: any) {
      onLog(`[ADMIN] ${label} notification failed: ${error?.message ?? error}`);
    }
  };

  if (timeCharacteristic) {
    const usingUnixTime = normalizeUuid(timeCharacteristic.uuid) === ADMIN_UNIX_TIME_CHAR_UUID;
    const decodeTime = usingUnixTime ? decodeUnixTime : decodeDateTime;
    const timeLabel = usingUnixTime ? 'UnixTS' : 'DateTime';
    await subscribe(
      timeCharacteristic,
      value => {
        const sensorTime = decodeTime(value);
        onLog(`[ADMIN] NOTIFY ${timeLabel} = ${formatTimestampForLog(sensorTime)}`);
        onStatusChange({ sensorTime });
      },
      timeLabel,
    );
  } else {
    onLog('[ADMIN] Sensor time notifications unavailable');
  }

  if (runningTimeCharacteristic) {
    await subscribe(
      runningTimeCharacteristic,
      value => {
        const runningTimeSeconds = decodeRunningTime(value);
        onLog(`[ADMIN] NOTIFY RunningTime = ${runningTimeSeconds ?? 'invalid'} s`);
        onStatusChange({ runningTimeSeconds });
      },
      'Running time',
    );
  } else {
    onLog('[ADMIN] Running time notifications unavailable');
  }

  onLog(`[ADMIN] Time monitoring ${subscriptions.length > 0
    ? `active (${subscriptions.length} characteristic(s))`
    : 'inactive'}`);
  return subscriptions.length > 0
    ? { service: service.uuid, characteristics: subscriptions }
    : undefined;
}

export async function stopAdminTimeMonitoring(
  deviceId: string,
  subscription: AdminTimeSubscription | undefined,
  onLog?: (line: string) => void,
): Promise<void> {
  if (!subscription) return;
  for (const characteristic of subscription.characteristics) {
    try {
      await BleClient.stopNotifications(deviceId, subscription.service, characteristic);
    } catch (error: any) {
      onLog?.(`[ADMIN] Stop notification failed: ${error?.message ?? error}`);
    }
  }
}
