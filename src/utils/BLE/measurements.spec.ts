import { describe, expect, it } from 'vitest';
import {
  decodeKnownMeasurementCharacteristic,
  decodeMeasurementValue,
  MEASUREMENT_SOURCE_TO_ID,
  parsePresentationFormat,
} from '@/utils/BLE/measurements';
import {
  MEASURES_SERVICE_UUID,
  ON_OFF_CHAR_UUID,
  PULSE_COUNT_CHAR_UUID,
} from '@/utils/BLE/characteristics';

describe('BLE measurements', () => {
  it('keeps the BLE battery percentage distinct from a voltage measurement', () => {
    expect(MEASUREMENT_SOURCE_TO_ID[0x0000]).toBe('battery_level_percent');
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
});
