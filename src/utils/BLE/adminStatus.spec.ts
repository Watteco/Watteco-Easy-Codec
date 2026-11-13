import { BleClient } from '@capacitor-community/bluetooth-le';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeDateTime,
  decodeFirmwareLongName,
  decodeOsaAuthenticated,
  decodeRunningTime,
  decodeUnixTime,
  isPlausibleSensorTime,
  startAdminTimeMonitoring,
  stopAdminTimeMonitoring,
} from '@/utils/BLE/adminStatus';
import {
  ADMIN_RUNNING_TIME_CHAR_UUID,
  ADMIN_UNIX_TIME_CHAR_UUID,
  OSA_ADMIN_SERVICE_UUID,
} from '@/utils/BLE/characteristics';

vi.mock('@capacitor-community/bluetooth-le', () => ({
  BleClient: {
    getServices: vi.fn(),
    startNotifications: vi.fn(),
    stopNotifications: vi.fn(),
  },
}));

describe('administration status decoders', () => {
  it('decodes a null-terminated firmware long name', () => {
    expect(decodeFirmwareLongName(new Uint8Array([
      0x50, 0x75, 0x6c, 0x73, 0x65, 0x20, 0x4e, 0x65, 0x6f, 0x00, 0xff,
    ]))).toBe('Pulse Neo');
    expect(decodeFirmwareLongName(new Uint8Array())).toBeNull();
  });

  it('decodes little-endian Unix and running times', () => {
    expect(decodeUnixTime(new Uint8Array([0x80, 0x00, 0x00, 0x00]))).toBe(128_000);
    expect(decodeRunningTime(new Uint8Array([0x34, 0x12, 0x00, 0x00]))).toBe(0x1234);
  });

  it('decodes the Bluetooth Date Time format', () => {
    const timestamp = decodeDateTime(new Uint8Array([0xea, 0x07, 10, 5, 14, 30, 45]));
    expect(timestamp).toBe(new Date(2026, 9, 5, 14, 30, 45).getTime());
  });

  it('rejects uninitialized sensor dates', () => {
    expect(isPlausibleSensorTime(new Date(2000, 0, 1).getTime())).toBe(false);
    expect(isPlausibleSensorTime(new Date(2026, 9, 5).getTime())).toBe(true);
    expect(isPlausibleSensorTime(null)).toBe(false);
  });

  it('recognizes OSA authenticated status 0x02', () => {
    expect(decodeOsaAuthenticated(new Uint8Array([0x02]))).toBe(true);
    expect(decodeOsaAuthenticated(new Uint8Array([0x00]))).toBe(false);
    expect(decodeOsaAuthenticated(new Uint8Array())).toBeNull();
  });
});

describe('BLE administration status', () => {
  const notifiableProperties = {
    broadcast: false,
    read: true,
    writeWithoutResponse: false,
    write: false,
    notify: true,
    indicate: false,
    authenticatedSignedWrites: false,
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(BleClient.startNotifications).mockResolvedValue();
    vi.mocked(BleClient.stopNotifications).mockResolvedValue();
  });

  it('subscribes to sensor time and running time updates', async () => {
    vi.mocked(BleClient.getServices).mockResolvedValue([{
      uuid: OSA_ADMIN_SERVICE_UUID,
      characteristics: [ADMIN_UNIX_TIME_CHAR_UUID, ADMIN_RUNNING_TIME_CHAR_UUID].map(uuid => ({
        uuid,
        properties: notifiableProperties,
        descriptors: [],
      })),
    }]);
    const onStatusChange = vi.fn();

    const onLog = vi.fn();
    const subscription = await startAdminTimeMonitoring('device-id', onStatusChange, onLog);

    expect(BleClient.startNotifications).toHaveBeenCalledTimes(2);
    const sensorTimeCallback = vi.mocked(BleClient.startNotifications).mock.calls[0][3];
    const runningTimeCallback = vi.mocked(BleClient.startNotifications).mock.calls[1][3];
    sensorTimeCallback(new DataView(Uint8Array.of(1, 0, 0, 0).buffer));
    runningTimeCallback(new DataView(Uint8Array.of(42, 0, 0, 0).buffer));
    expect(onStatusChange).toHaveBeenNthCalledWith(1, { sensorTime: 1_000 });
    expect(onStatusChange).toHaveBeenNthCalledWith(2, { runningTimeSeconds: 42 });
    expect(onLog).toHaveBeenCalledWith('[ADMIN] Time monitoring start requested');
    expect(onLog).toHaveBeenCalledWith('[ADMIN] NOTIFY UnixTS = 1970-01-01T00:00:01.000Z (1)');
    expect(onLog).toHaveBeenCalledWith('[ADMIN] NOTIFY RunningTime = 42 s');
    expect(onLog).toHaveBeenCalledWith('[ADMIN] Time monitoring active (2 characteristic(s))');

    await stopAdminTimeMonitoring('device-id', subscription);
    expect(BleClient.stopNotifications).toHaveBeenCalledTimes(2);
  });

  it('ignores administration characteristics without notifications', async () => {
    vi.mocked(BleClient.getServices).mockResolvedValue([{
      uuid: OSA_ADMIN_SERVICE_UUID,
      characteristics: [ADMIN_UNIX_TIME_CHAR_UUID, ADMIN_RUNNING_TIME_CHAR_UUID].map(uuid => ({
        uuid,
        properties: { ...notifiableProperties, notify: false },
        descriptors: [],
      })),
    }]);
    const onLog = vi.fn();

    await expect(startAdminTimeMonitoring('device-id', vi.fn(), onLog)).resolves.toBeUndefined();
    expect(BleClient.startNotifications).not.toHaveBeenCalled();
    expect(onLog).toHaveBeenCalledWith('[ADMIN] Sensor time notifications unavailable');
    expect(onLog).toHaveBeenCalledWith('[ADMIN] Running time notifications unavailable');
  });
});
