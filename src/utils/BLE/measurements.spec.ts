import { BleClient } from '@capacitor-community/bluetooth-le';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeKnownMeasurementCharacteristic,
  decodeMeasurementValue,
  MEASUREMENT_SOURCE_TO_ID,
  parsePresentationFormat,
  pollMeasurementMonitoring,
  startMeasurementMonitoring,
  stopMeasurementMonitoring,
} from '@/utils/BLE/measurements';
import {
  MEASURES_SERVICE_UUID,
  HUMIDITY_CHAR_UUID,
  ON_OFF_CHAR_UUID,
  PULSE_COUNT_CHAR_UUID,
  TEMPERATURE_CHAR_UUID,
} from '@/utils/BLE/characteristics';

vi.mock('@capacitor-community/bluetooth-le', () => ({
  BleClient: {
    getServices: vi.fn(),
    read: vi.fn(),
    readDescriptor: vi.fn(),
    startNotifications: vi.fn(),
    stopNotifications: vi.fn(),
  },
}));

describe('BLE measurements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the BLE battery percentage distinct from a voltage measurement', () => {
    expect(MEASUREMENT_SOURCE_TO_ID[0x0000]).toBe('battery_level_percent');
  });

  it('maps the indoor temperature and humidity source IDs', () => {
    expect(MEASUREMENT_SOURCE_TO_ID[0x0010]).toBe('temperature');
    expect(MEASUREMENT_SOURCE_TO_ID[0x0011]).toBe('humidity');
  });

  it('decodes temperature and humidity using their presentation formats', () => {
    const temperature = decodeMeasurementValue(
      new Uint8Array([0xde, 0x08]),
      { format: 0x0e, exponent: -2, unit: 0x272f, namespace: 1, sourceId: 0x0010 }
    );
    const humidity = decodeMeasurementValue(
      new Uint8Array([0xd8, 0x13]),
      { format: 0x06, exponent: -2, unit: 0x27ad, namespace: 1, sourceId: 0x0011 }
    );

    expect(temperature[0]).toMatchObject({ sourceId: 0x0010, rawHex: 'de 08' });
    expect(temperature[0].value).toBeCloseTo(22.7);
    expect(humidity[0]).toMatchObject({ sourceId: 0x0011, rawHex: 'd8 13' });
    expect(humidity[0].value).toBeCloseTo(50.8);
  });

  it('identifies standard temperature and humidity characteristics despite an incorrect descriptor source', () => {
    const presentation = { format: 0x06, exponent: -2, unit: 0x2700, namespace: 1, sourceId: 0x0001 };

    expect(decodeKnownMeasurementCharacteristic(
      new Uint8Array([0xde, 0x08]),
      presentation,
      TEMPERATURE_CHAR_UUID
    )[0]).toMatchObject({ sourceId: 0x0010 });
    expect(decodeKnownMeasurementCharacteristic(
      new Uint8Array([0xd8, 0x13]),
      presentation,
      HUMIDITY_CHAR_UUID
    )[0]).toMatchObject({ sourceId: 0x0011 });
  });

  it('builds Watteco measure UUIDs from the 8003 service namespace', () => {
    expect(MEASURES_SERVICE_UUID).toBe('80038003-890d-4f4e-a197-3f9eb158ea95');
    expect(PULSE_COUNT_CHAR_UUID).toBe('8003c001-890d-4f4e-a197-3f9eb158ea95');
  });

  it('parses the Bluetooth presentation descriptor as little-endian', () => {
    expect(parsePresentationFormat(new Uint8Array([0x06, 0xfd, 0x00, 0x27, 0x01, 0x00, 0x00])))
      .toEqual({ format: 0x06, exponent: -3, unit: 0x2700, namespace: 1, sourceId: 0 });
  });

  it('decodes and scales a little-endian battery value', () => {
    const samples = decodeMeasurementValue(
      new Uint8Array([0x0d, 0x0e]),
      { format: 0x06, exponent: -3, unit: 0x2700, namespace: 1, sourceId: 0 }
    );
    expect(samples[0].value).toBeCloseTo(3.597);
  });

  it('decodes four packed counters and assigns their source IDs', () => {
    const samples = decodeMeasurementValue(
      new Uint8Array([
        1, 0, 0, 0,
        2, 0, 0, 0,
        3, 0, 0, 0,
        4, 0, 0, 0,
      ]),
      { format: 0x08, exponent: 0, unit: 0x2700, namespace: 1, sourceId: 0x0014 }
    );
    expect(samples.map(sample => [sample.sourceId, sample.value])).toEqual([
      [0x0014, 1],
      [0x0016, 2],
      [0x0018, 3],
      [0x001a, 4],
    ]);
  });

  it('assigns repeated counter characteristics by occurrence', () => {
    const samples = decodeKnownMeasurementCharacteristic(
      new Uint8Array([42, 0, 0, 0]),
      { format: 0x08, exponent: 0, unit: 0x2700, namespace: 1, sourceId: 1 },
      PULSE_COUNT_CHAR_UUID,
      2
    );
    expect(samples).toEqual([{ sourceId: 0x0018, value: 42, rawHex: '2a 00 00 00' }]);
  });

  it('assigns repeated temperature characteristics to separate measurements', () => {
    const presentation = { format: 0x0e, exponent: -2, unit: 0x272f, namespace: 1, sourceId: 0x0010 };

    expect(decodeKnownMeasurementCharacteristic(
      new Uint8Array([0x64, 0x00]),
      presentation,
      TEMPERATURE_CHAR_UUID,
      0,
      2
    )[0]).toMatchObject({ sourceId: 0x0010, measurementId: 'temperature_1', value: 1 });
    expect(decodeKnownMeasurementCharacteristic(
      new Uint8Array([0xc8, 0x00]),
      presentation,
      TEMPERATURE_CHAR_UUID,
      1,
      2
    )[0]).toMatchObject({ sourceId: 0x0010, measurementId: 'temperature_2', value: 2 });
  });

  it('decodes the on/off byte as four input-state bits', () => {
    const samples = decodeKnownMeasurementCharacteristic(
      new Uint8Array([0x05]),
      { format: 0x01, exponent: 0, unit: 0x2700, namespace: 1, sourceId: 1 },
      ON_OFF_CHAR_UUID
    );
    expect(samples.map(sample => [sample.sourceId, sample.value])).toEqual([
      [0x0015, true],
      [0x0017, false],
      [0x0019, true],
      [0x001b, false],
    ]);
  });

  it('assigns repeated on/off characteristics by occurrence', () => {
    const samples = decodeKnownMeasurementCharacteristic(
      new Uint8Array([1]),
      { format: 0x01, exponent: 0, unit: 0x2700, namespace: 1, sourceId: 1 },
      ON_OFF_CHAR_UUID,
      1,
      4
    );
    expect(samples).toEqual([{ sourceId: 0x0017, value: true, rawHex: '01' }]);
  });

  it('subscribes separately to repeated characteristic UUID occurrences', async () => {
    const repeatedCharacteristics = [0, 1].map(() => ({
      uuid: PULSE_COUNT_CHAR_UUID,
      properties: {
        broadcast: false,
        read: true,
        writeWithoutResponse: false,
        write: false,
        notify: true,
        indicate: false,
        authenticatedSignedWrites: false,
      },
      descriptors: [],
    }));
    vi.mocked(BleClient.getServices).mockResolvedValue([{
      uuid: MEASURES_SERVICE_UUID,
      characteristics: repeatedCharacteristics,
    }]);
    vi.mocked(BleClient.read).mockResolvedValue(
      new DataView(new Uint8Array([42, 0, 0, 0]).buffer)
    );
    vi.mocked(BleClient.startNotifications).mockResolvedValue();
    vi.mocked(BleClient.stopNotifications).mockResolvedValue();

    const subscriptions = await startMeasurementMonitoring('device-id', vi.fn(), vi.fn());

    expect(BleClient.startNotifications).toHaveBeenCalledTimes(2);
    expect(BleClient.startNotifications).toHaveBeenNthCalledWith(
      1,
      'device-id',
      MEASURES_SERVICE_UUID,
      PULSE_COUNT_CHAR_UUID,
      expect.any(Function),
      { characteristicIndex: 0 }
    );
    expect(BleClient.startNotifications).toHaveBeenNthCalledWith(
      2,
      'device-id',
      MEASURES_SERVICE_UUID,
      PULSE_COUNT_CHAR_UUID,
      expect.any(Function),
      { characteristicIndex: 1 }
    );

    await stopMeasurementMonitoring('device-id', subscriptions);
    expect(BleClient.stopNotifications).toHaveBeenNthCalledWith(
      2,
      'device-id',
      MEASURES_SERVICE_UUID,
      PULSE_COUNT_CHAR_UUID,
      { characteristicIndex: 1 }
    );
  });

  it('manually polls every readable measurement occurrence', async () => {
    const repeatedCharacteristics = [0, 1].map(() => ({
      uuid: PULSE_COUNT_CHAR_UUID,
      properties: {
        broadcast: false,
        read: true,
        writeWithoutResponse: false,
        write: false,
        notify: true,
        indicate: false,
        authenticatedSignedWrites: false,
      },
      descriptors: [],
    }));
    vi.mocked(BleClient.getServices).mockResolvedValue([{
      uuid: MEASURES_SERVICE_UUID,
      characteristics: repeatedCharacteristics,
    }]);
    vi.mocked(BleClient.read).mockResolvedValue(
      new DataView(new Uint8Array([42, 0, 0, 0]).buffer)
    );
    vi.mocked(BleClient.startNotifications).mockResolvedValue();
    vi.mocked(BleClient.stopNotifications).mockResolvedValue();
    const onSample = vi.fn();

    const subscriptions = await startMeasurementMonitoring('manual-poll-device', onSample, vi.fn());
    expect(BleClient.read).toHaveBeenCalledTimes(2);

    await expect(pollMeasurementMonitoring('manual-poll-device')).resolves.toBe(2);
    expect(BleClient.read).toHaveBeenCalledTimes(4);
    expect(onSample.mock.calls.slice(-2).map(([sample]) => sample.sourceId))
      .toEqual([0x0014, 0x0016]);

    await stopMeasurementMonitoring('manual-poll-device', subscriptions);
    await expect(pollMeasurementMonitoring('manual-poll-device')).resolves.toBe(0);
  });

  it('does not publish identical fallback polling reads as new samples', async () => {
    vi.useFakeTimers();
    try {
      const repeatedCharacteristics = [0, 1].map(() => ({
        uuid: PULSE_COUNT_CHAR_UUID,
        properties: {
          broadcast: false,
          read: true,
          writeWithoutResponse: false,
          write: false,
          notify: false,
          indicate: false,
          authenticatedSignedWrites: false,
        },
        descriptors: [],
      }));
      vi.mocked(BleClient.getServices).mockResolvedValue([{
        uuid: MEASURES_SERVICE_UUID,
        characteristics: repeatedCharacteristics,
      }]);
      vi.mocked(BleClient.read).mockResolvedValue(
        new DataView(new Uint8Array([42, 0, 0, 0]).buffer)
      );
      const onSample = vi.fn();

      const subscriptions = await startMeasurementMonitoring('poll-device', onSample, vi.fn());
      expect(onSample).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1000);
      expect(onSample).toHaveBeenCalledTimes(2);

      await stopMeasurementMonitoring('poll-device', subscriptions);
    } finally {
      vi.useRealTimers();
    }
  });
});
