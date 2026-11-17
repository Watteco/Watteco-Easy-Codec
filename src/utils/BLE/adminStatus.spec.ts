import { BleClient } from '@capacitor-community/bluetooth-le';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeAbsoluteTime,
  decodeDateTime,
  decodeFirmwareLongName,
  decodeOsaAuthenticated,
  decodeRunningTime,
  decodeUnixTime,
  extrapolateSensorTime,
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
  const absoluteTime = (
    state: 0 | 1 | 2,
    timestampSeconds: number,
    syncAgeSeconds = 0xffff_ffff,
  ): Uint8Array => {
    const bytes = new Uint8Array(16);
    const view = new DataView(bytes.buffer);
    bytes[0] = 1;
    bytes[1] = state;
    view.setUint32(4, timestampSeconds >>> 0, true);
    view.setUint32(8, Math.floor(timestampSeconds / 0x1_0000_0000), true);
    view.setUint32(12, syncAgeSeconds, true);
    return bytes;
  };

  it('decodes a null-terminated firmware long name', () => {
    expect(decodeFirmwareLongName(new Uint8Array([
      0x50, 0x75, 0x6c, 0x73, 0x65, 0x20, 0x4e, 0x65, 0x6f, 0x00, 0xff,
    ]))).toBe('Pulse Neo');
    expect(decodeFirmwareLongName(new Uint8Array())).toBeNull();
  });

  it('decodes little-endian Unix and running times', () => {
    expect(decodeUnixTime(new Uint8Array([0x80, 0x00, 0x00, 0x00]))).toBe(128_000);
    expect(decodeUnixTime(new Uint8Array([0x00, 0x00, 0x00, 0x00]))).toBe(0);
    expect(decodeRunningTime(new Uint8Array([0x34, 0x12, 0x00, 0x00]))).toBe(0x1234);
  });

  it('keeps supporting the legacy four-byte AbsoluteTime payload', () => {
    expect(decodeAbsoluteTime(new Uint8Array([0x80, 0x00, 0x00, 0x00]))).toEqual({
      sensorTime: 128_000,
      sensorTimeState: 'legacy',
      sensorTimeSyncAgeSeconds: null,
      sensorTimeFormat: 'legacy-unix',
    });
  });

  it.each([
    [0, 'unknown', 0, null],
    [1, 'estimated', 1_800_000_000, 120],
    [2, 'synchronized', 1_800_000_030, 0],
  ] as const)('decodes AbsoluteTime state %s as %s', (state, expectedState, timestamp, age) => {
    expect(decodeAbsoluteTime(absoluteTime(state, timestamp, age ?? 0xffff_ffff))).toEqual({
      sensorTime: timestamp * 1_000,
      sensorTimeState: expectedState,
      sensorTimeSyncAgeSeconds: age,
      sensorTimeFormat: 'absolute-time',
    });
  });

  it('rejects malformed, unsupported and out-of-range AbsoluteTime payloads', () => {
    expect(decodeAbsoluteTime(new Uint8Array(15)).sensorTime).toBeNull();

    const unsupported = absoluteTime(2, 1_800_000_000);
    unsupported[0] = 2;
    expect(decodeAbsoluteTime(unsupported).sensorTime).toBeNull();

    expect(decodeAbsoluteTime(absoluteTime(2, 8_640_000_000_001))).toMatchObject({
      sensorTime: null,
      sensorTimeState: 'synchronized',
      sensorTimeFormat: 'absolute-time',
    });
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

  it('extrapolates every plausible sensor time', () => {
    const sensorTime = new Date(2026, 10, 17, 12, 0, 0).getTime();
    expect(extrapolateSensorTime(sensorTime, 5_000)).toBe(sensorTime + 5_000);
    expect(extrapolateSensorTime(sensorTime, -5_000)).toBe(sensorTime);
  });

  it('recognizes OSA authenticated status 0x02', () => {
    expect(decodeOsaAuthenticated(new Uint8Array([0x02]))).toBe(true);
    expect(decodeOsaAuthenticated(new Uint8Array([0x00]))).toBe(false);
    expect(decodeOsaAuthenticated(new Uint8Array())).toBeNull();
  });
});

describe('BLE administration status', () => {
  const synchronizedAbsoluteTime = new Uint8Array(16);
  synchronizedAbsoluteTime[0] = 1;
  synchronizedAbsoluteTime[1] = 2;
  new DataView(synchronizedAbsoluteTime.buffer).setUint32(4, 1_800_000_000, true);
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
    sensorTimeCallback(new DataView(synchronizedAbsoluteTime.buffer));
    runningTimeCallback(new DataView(Uint8Array.of(42, 0, 0, 0).buffer));
    expect(onStatusChange).toHaveBeenNthCalledWith(1, {
      sensorTime: 1_800_000_000_000,
      sensorTimeState: 'synchronized',
      sensorTimeSyncAgeSeconds: 0,
      sensorTimeFormat: 'absolute-time',
    });
    expect(onStatusChange).toHaveBeenNthCalledWith(2, { runningTimeSeconds: 42 });
    expect(onLog).toHaveBeenCalledWith('[ADMIN] Time monitoring start requested');
    expect(onLog).toHaveBeenCalledWith(expect.stringContaining(
      '[ADMIN] NOTIFY AbsoluteTime = 2027-01-15T08:00:00.000Z',
    ));
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
