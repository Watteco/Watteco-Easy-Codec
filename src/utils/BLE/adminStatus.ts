import { BleClient } from '@capacitor-community/bluetooth-le';
import {
  ADMIN_ABSOLUTE_TIME_CHAR_UUID,
  ADMIN_FW_LONG_NAME_CHAR_UUID,
  ADMIN_RUNNING_TIME_CHAR_UUID,
  DATE_TIME_CHAR_UUID,
  OSA_ADMIN_SERVICE_UUID,
  OSA_STATUS_CHAR_UUID,
  normalizeUuid,
} from '@/utils/BLE/characteristics';
import { toUint8ArrayFromBleValue } from '@/utils/BLE/blob';

export type AdminDeviceStatus = {
  firmwareLongName: string | null;
  sensorTime: number | null;
  sensorTimeState: SensorTimeState | null;
  sensorTimeSyncAgeSeconds: number | null;
  sensorTimeFormat: SensorTimeFormat | null;
  runningTimeSeconds: number | null;
  osaAuthenticated: boolean | null;
};

export type SensorTimeState = 'legacy' | 'unknown' | 'estimated' | 'synchronized';
export type SensorTimeFormat = 'legacy-unix' | 'absolute-time' | 'date-time';

export type DecodedSensorTime = Pick<AdminDeviceStatus,
  'sensorTime' | 'sensorTimeState' | 'sensorTimeSyncAgeSeconds' | 'sensorTimeFormat'>;

export type AdminTimeStatus = Pick<AdminDeviceStatus,
  | 'sensorTime'
  | 'sensorTimeState'
  | 'sensorTimeSyncAgeSeconds'
  | 'sensorTimeFormat'
  | 'runningTimeSeconds'>;

export type AdminTimeSubscription = {
  service: string;
  characteristics: string[];
};

const MIN_PLAUSIBLE_SENSOR_TIME = Date.UTC(2020, 0, 1);
const ABSOLUTE_TIME_LENGTH = 16;
const ABSOLUTE_TIME_VERSION = 1;
const UNKNOWN_SYNC_AGE = 0xffff_ffff;
const MAX_DATE_SECONDS = 8_640_000_000_000;
const UINT32_RANGE = 0x1_0000_0000;

const SENSOR_TIME_STATES: Record<number, Exclude<SensorTimeState, 'legacy'>> = {
  0: 'unknown',
  1: 'estimated',
  2: 'synchronized',
};

function formatTimestampForLog(value: number | null): string {
  return value === null ? 'unavailable' : `${new Date(value).toISOString()} (${value / 1_000})`;
}

function formatBytesForLog(value: unknown): string {
  const bytes = toUint8ArrayFromBleValue(value);
  return bytes?.length
    ? Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(' ')
    : 'unavailable';
}

function formatSensorTimeForLog(value: DecodedSensorTime): string {
  const details = [
    `state=${value.sensorTimeState ?? 'invalid'}`,
    `format=${value.sensorTimeFormat ?? 'invalid'}`,
  ];
  if (value.sensorTimeSyncAgeSeconds !== null) {
    details.push(`syncAge=${value.sensorTimeSyncAgeSeconds}s`);
  }
  return `${formatTimestampForLog(value.sensorTime)} (${details.join(', ')})`;
}

function unavailableSensorTime(): DecodedSensorTime {
  return {
    sensorTime: null,
    sensorTimeState: null,
    sensorTimeSyncAgeSeconds: null,
    sensorTimeFormat: null,
  };
}

export function isPlausibleSensorTime(value: number | null | undefined): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= MIN_PLAUSIBLE_SENSOR_TIME;
}

export function extrapolateSensorTime(
  value: number | null,
  elapsedMs: number,
): number | null {
  if (!isPlausibleSensorTime(value)) return value;
  return value + Math.max(0, elapsedMs);
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
  return seconds * 1000;
}

export function decodeAbsoluteTime(value: unknown): DecodedSensorTime {
  const bytes = toUint8ArrayFromBleValue(value);
  if (!bytes) return unavailableSensorTime();

  if (bytes.length === 4) {
    return {
      sensorTime: decodeUnixTime(bytes),
      sensorTimeState: 'legacy',
      sensorTimeSyncAgeSeconds: null,
      sensorTimeFormat: 'legacy-unix',
    };
  }

  if (bytes.length !== ABSOLUTE_TIME_LENGTH) return unavailableSensorTime();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const state = SENSOR_TIME_STATES[view.getUint8(1)];
  if (view.getUint8(0) !== ABSOLUTE_TIME_VERSION || !state) return unavailableSensorTime();

  const seconds = view.getUint32(4, true) + view.getUint32(8, true) * UINT32_RANGE;
  const syncAge = view.getUint32(12, true);
  return {
    sensorTime: seconds <= MAX_DATE_SECONDS ? seconds * 1_000 : null,
    sensorTimeState: state,
    sensorTimeSyncAgeSeconds: syncAge === UNKNOWN_SYNC_AGE ? null : syncAge,
    sensorTimeFormat: 'absolute-time',
  };
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
  const read = async (uuid: string, label: string): Promise<unknown | null> => {
    const characteristic = findCharacteristic(uuid);
    if (!characteristic) {
      onLog(`[ADMIN] READ ${label} unavailable: characteristic missing`);
      return null;
    }
    if (!characteristic.properties.read) {
      onLog(`[ADMIN] READ ${label} unavailable: characteristic is not readable`);
      return null;
    }
    try {
      return await BleClient.read(deviceId, service.uuid, characteristic.uuid);
    } catch (error: any) {
      onLog(`[ADMIN] READ ${label} failed: ${error?.message ?? error}`);
      return null;
    }
  };

  const [firmwareLongNameRaw, absoluteTimeRaw, dateTimeRaw, runningTimeRaw, authStatusRaw] = await Promise.all([
    read(ADMIN_FW_LONG_NAME_CHAR_UUID, 'FirmwareLongName'),
    read(ADMIN_ABSOLUTE_TIME_CHAR_UUID, 'AbsoluteTime'),
    read(DATE_TIME_CHAR_UUID, 'DateTime'),
    read(ADMIN_RUNNING_TIME_CHAR_UUID, 'RunningTime'),
    read(OSA_STATUS_CHAR_UUID, 'OsaStatus'),
  ]);
  const firmwareLongName = decodeFirmwareLongName(firmwareLongNameRaw);
  const absoluteTime = decodeAbsoluteTime(absoluteTimeRaw);
  const dateTime = decodeDateTime(dateTimeRaw);
  const sensorTimeStatus: DecodedSensorTime = absoluteTime.sensorTime !== null
    ? absoluteTime
    : {
      sensorTime: dateTime,
      sensorTimeState: dateTime === null ? null : 'legacy',
      sensorTimeSyncAgeSeconds: null,
      sensorTimeFormat: dateTime === null ? null : 'date-time',
    };
  const runningTimeSeconds = decodeRunningTime(runningTimeRaw);
  const osaAuthenticated = decodeOsaAuthenticated(authStatusRaw);
  onLog(`[ADMIN] READ AbsoluteTime raw (${toUint8ArrayFromBleValue(absoluteTimeRaw)?.length ?? 0} bytes) = ${formatBytesForLog(absoluteTimeRaw)}`);
  onLog(`[ADMIN] READ AbsoluteTime = ${formatSensorTimeForLog(absoluteTime)}`);
  onLog(`[ADMIN] READ DateTime = ${formatTimestampForLog(dateTime)}`);
  onLog(`[ADMIN] READ RunningTime = ${runningTimeSeconds ?? 'unavailable'} s`);
  onLog('[ADMIN] Device status refreshed');
  return {
    firmwareLongName,
    ...sensorTimeStatus,
    runningTimeSeconds,
    osaAuthenticated,
  };
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
    ADMIN_ABSOLUTE_TIME_CHAR_UUID,
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
    const usingAbsoluteTime = normalizeUuid(timeCharacteristic.uuid) === ADMIN_ABSOLUTE_TIME_CHAR_UUID;
    const timeLabel = usingAbsoluteTime ? 'AbsoluteTime' : 'DateTime';
    await subscribe(
      timeCharacteristic,
      value => {
        if (usingAbsoluteTime) {
          const status = decodeAbsoluteTime(value);
          onLog(`[ADMIN] NOTIFY AbsoluteTime raw (${toUint8ArrayFromBleValue(value)?.length ?? 0} bytes) = ${formatBytesForLog(value)}`);
          onLog(`[ADMIN] NOTIFY AbsoluteTime = ${formatSensorTimeForLog(status)}`);
          onStatusChange(status);
          return;
        }
        const sensorTime = decodeDateTime(value);
        onLog(`[ADMIN] NOTIFY DateTime = ${formatTimestampForLog(sensorTime)}`);
        onStatusChange({
          sensorTime,
          sensorTimeState: sensorTime === null ? null : 'legacy',
          sensorTimeSyncAgeSeconds: null,
          sensorTimeFormat: sensorTime === null ? null : 'date-time',
        });
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
