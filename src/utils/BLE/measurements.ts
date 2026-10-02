import { BleClient, type BleCharacteristic } from '@capacitor-community/bluetooth-le';
import {
  BATTERY_LEVEL_CHAR_UUID,
  HUMIDITY_CHAR_UUID,
  MEASURES_SERVICE_UUID,
  ON_OFF_CHAR_UUID,
  PRESENTATION_FORMAT_DESCRIPTOR_UUID,
  PULSE_COUNT_CHAR_UUID,
  TEMPERATURE_CHAR_UUID,
  includesShortUuid,
  normalizeUuid,
} from '@/utils/BLE/characteristics';
import { toSpacedHex, toUint8ArrayFromBleValue } from '@/utils/BLE/blob';

export type GattPresentationFormat = {
  format: number;
  exponent: number;
  unit: number;
  namespace: number;
  sourceId: number;
};

export type BleMeasurementSample = {
  sourceId: number;
  value: number | boolean | string;
  rawHex: string;
};

export type BleMeasurementSubscription = {
  service: string;
  characteristic: string;
};

const pollingTimers = new Map<string, ReturnType<typeof setInterval>>();

const FORMAT_BOOLEAN = 0x01;
const FORMAT_UINT8 = 0x04;
const FORMAT_UINT16 = 0x06;
const FORMAT_UINT24 = 0x07;
const FORMAT_UINT32 = 0x08;
const FORMAT_SINT8 = 0x0c;
const FORMAT_SINT16 = 0x0e;
const FORMAT_SINT24 = 0x0f;
const FORMAT_SINT32 = 0x10;
const FORMAT_FLOAT32 = 0x14;
const FORMAT_FLOAT64 = 0x15;
const FORMAT_UTF8 = 0x19;

const SOURCE_BATTERY = 0x0000;
const SOURCE_TEMP_IN = 0x0010;
const SOURCE_HUMID_IN = 0x0011;
const SOURCE_COUNT_1 = 0x0014;
const SOURCE_ONOFF_1 = 0x0015;

const signedInt8 = (value: number): number => (value & 0x80 ? value - 0x100 : value);

export function parsePresentationFormat(bytes: Uint8Array): GattPresentationFormat | null {
  if (bytes.length < 7) return null;
  return {
    format: bytes[0],
    exponent: signedInt8(bytes[1]),
    unit: bytes[2] | (bytes[3] << 8),
    namespace: bytes[4],
    sourceId: bytes[5] | (bytes[6] << 8),
  };
}

function formatWidth(format: number): number | null {
  switch (format) {
    case FORMAT_BOOLEAN:
    case FORMAT_UINT8:
    case FORMAT_SINT8:
      return 1;
    case FORMAT_UINT16:
    case FORMAT_SINT16:
      return 2;
    case FORMAT_UINT24:
    case FORMAT_SINT24:
      return 3;
    case FORMAT_UINT32:
    case FORMAT_SINT32:
    case FORMAT_FLOAT32:
      return 4;
    case FORMAT_FLOAT64:
      return 8;
    default:
      return null;
  }
}

function readUint24(view: DataView, offset: number): number {
  return view.getUint8(offset)
    | (view.getUint8(offset + 1) << 8)
    | (view.getUint8(offset + 2) << 16);
}

function readSint24(view: DataView, offset: number): number {
  const value = readUint24(view, offset);
  return value & 0x800000 ? value - 0x1000000 : value;
}

function decodeScalar(view: DataView, offset: number, format: number): number | boolean | null {
  switch (format) {
    case FORMAT_BOOLEAN: return view.getUint8(offset) !== 0;
    case FORMAT_UINT8: return view.getUint8(offset);
    case FORMAT_UINT16: return view.getUint16(offset, true);
    case FORMAT_UINT24: return readUint24(view, offset);
    case FORMAT_UINT32: return view.getUint32(offset, true);
    case FORMAT_SINT8: return view.getInt8(offset);
    case FORMAT_SINT16: return view.getInt16(offset, true);
    case FORMAT_SINT24: return readSint24(view, offset);
    case FORMAT_SINT32: return view.getInt32(offset, true);
    case FORMAT_FLOAT32: return view.getFloat32(offset, true);
    case FORMAT_FLOAT64: return view.getFloat64(offset, true);
    default: return null;
  }
}

function sourceIdAtIndex(firstSourceId: number, index: number): number {
  if (firstSourceId >= SOURCE_COUNT_1 && firstSourceId <= 0x001a && firstSourceId % 2 === 0) {
    return firstSourceId + (index * 2);
  }
  if (firstSourceId >= SOURCE_ONOFF_1 && firstSourceId <= 0x001b && firstSourceId % 2 === 1) {
    return firstSourceId + (index * 2);
  }
  return firstSourceId;
}

export function decodeMeasurementValue(
  bytes: Uint8Array,
  presentation: GattPresentationFormat
): BleMeasurementSample[] {
  const rawHex = toSpacedHex(bytes);
  if (presentation.format === FORMAT_UTF8) {
    return [{
      sourceId: presentation.sourceId,
      value: new TextDecoder().decode(bytes).replace(/\0+$/g, ''),
      rawHex,
    }];
  }

  const width = formatWidth(presentation.format);
  if (!width || bytes.length < width) return [];

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const valueCount = Math.floor(bytes.length / width);
  const scale = 10 ** presentation.exponent;
  const samples: BleMeasurementSample[] = [];

  for (let index = 0; index < valueCount; index++) {
    const decoded = decodeScalar(view, index * width, presentation.format);
    if (decoded === null) continue;
    samples.push({
      sourceId: sourceIdAtIndex(presentation.sourceId, index),
      value: typeof decoded === 'number' ? decoded * scale : decoded,
      rawHex,
    });
  }
  return samples;
}

export function decodeKnownMeasurementCharacteristic(
  bytes: Uint8Array,
  presentation: GattPresentationFormat,
  characteristicUuid: string,
  occurrenceIndex = 0,
  occurrenceCount = 1
): BleMeasurementSample[] {
  const uuid = normalizeUuid(characteristicUuid);
  const rawHex = toSpacedHex(bytes);

  if (uuid === ON_OFF_CHAR_UUID && occurrenceCount === 1 && bytes.length > 0) {
    return Array.from({ length: 4 }, (_, index) => ({
      sourceId: SOURCE_ONOFF_1 + (index * 2),
      value: (bytes[0] & (1 << index)) !== 0,
      rawHex,
    }));
  }

  const sourceId = uuid === BATTERY_LEVEL_CHAR_UUID
    ? SOURCE_BATTERY
    : uuid === TEMPERATURE_CHAR_UUID
      ? SOURCE_TEMP_IN
      : uuid === HUMIDITY_CHAR_UUID
        ? SOURCE_HUMID_IN
    : uuid === PULSE_COUNT_CHAR_UUID
      ? SOURCE_COUNT_1 + (occurrenceIndex * 2)
      : uuid === ON_OFF_CHAR_UUID
        ? SOURCE_ONOFF_1 + (occurrenceIndex * 2)
      : presentation.sourceId;

  return decodeMeasurementValue(bytes, { ...presentation, sourceId });
}

function fallbackPresentation(characteristicUuid: string): GattPresentationFormat | null {
  const uuid = normalizeUuid(characteristicUuid);
  if (uuid === BATTERY_LEVEL_CHAR_UUID) {
    return { format: FORMAT_UINT8, exponent: 0, unit: 0x2700, namespace: 1, sourceId: SOURCE_BATTERY };
  }
  if (uuid === PULSE_COUNT_CHAR_UUID) {
    return { format: FORMAT_UINT32, exponent: 0, unit: 0x2700, namespace: 1, sourceId: SOURCE_COUNT_1 };
  }
  if (uuid === ON_OFF_CHAR_UUID) {
    return { format: FORMAT_BOOLEAN, exponent: 0, unit: 0x2700, namespace: 1, sourceId: SOURCE_ONOFF_1 };
  }
  return null;
}

async function readPresentation(
  deviceId: string,
  serviceUuid: string,
  characteristic: BleCharacteristic,
  characteristicIndex: number,
  onLog: (line: string) => void
): Promise<GattPresentationFormat | null> {
  const descriptor = characteristic.descriptors?.find(candidate => (
    normalizeUuid(candidate.uuid) === PRESENTATION_FORMAT_DESCRIPTOR_UUID
  ));
  if (!descriptor) return fallbackPresentation(characteristic.uuid);

  try {
    const raw = await BleClient.readDescriptor(
      deviceId,
      serviceUuid,
      characteristic.uuid,
      descriptor.uuid,
      { characteristicIndex } as any
    );
    const bytes = toUint8ArrayFromBleValue(raw);
    const parsed = bytes ? parsePresentationFormat(bytes) : null;
    if (parsed) return parsed;
  } catch (error: any) {
    onLog(`[MEAS] Presentation read failed for ${characteristic.uuid}: ${error?.message ?? error}`);
  }
  return fallbackPresentation(characteristic.uuid);
}

export async function startMeasurementMonitoring(
  deviceId: string,
  onSample: (sample: BleMeasurementSample) => void,
  onLog: (line: string) => void
): Promise<BleMeasurementSubscription[]> {
  const services = await BleClient.getServices(deviceId);
  const service = services.find(candidate => (
    normalizeUuid(candidate.uuid) === MEASURES_SERVICE_UUID
    || includesShortUuid(candidate.uuid, '8003')
  ));
  if (!service) {
    onLog('[MEAS] Measures service 8003 not found');
    onLog(`[MEAS] Available services: ${services.map(candidate => candidate.uuid).join(', ') || 'none'}`);
    return [];
  }
  onLog(`[MEAS] Measures service found: ${service.uuid}`);
  onLog(`[MEAS] Characteristics: ${(service.characteristics ?? []).map(characteristic => (
    `${characteristic.uuid} (${Object.entries(characteristic.properties)
      .filter(([, enabled]) => enabled)
      .map(([property]) => property)
      .join(',') || 'no properties'})`
  )).join(', ') || 'none'}`);

  const subscriptions: BleMeasurementSubscription[] = [];
  const monitoredCharacteristics = new Set<string>();
  const characteristicOccurrences = new Map<string, number>();
  const occurrenceCounts = new Map<string, number>();
  const pollReaders: Array<() => Promise<void>> = [];

  for (const characteristic of service.characteristics ?? []) {
    const uuid = normalizeUuid(characteristic.uuid);
    occurrenceCounts.set(uuid, (occurrenceCounts.get(uuid) ?? 0) + 1);
  }

  for (const characteristic of service.characteristics ?? []) {
    const characteristicUuid = normalizeUuid(characteristic.uuid);
    const occurrenceIndex = characteristicOccurrences.get(characteristicUuid) ?? 0;
    const occurrenceCount = occurrenceCounts.get(characteristicUuid) ?? 1;
    characteristicOccurrences.set(characteristicUuid, occurrenceIndex + 1);
    const presentation = await readPresentation(
      deviceId,
      service.uuid,
      characteristic,
      occurrenceIndex,
      onLog
    );
    if (!presentation) {
      onLog(`[MEAS] No presentation format for ${characteristic.uuid}`);
      continue;
    }

    let lastRawHex: string | null = null;
    const processValue = (rawValue: DataView) => {
      const bytes = toUint8ArrayFromBleValue(rawValue);
      if (!bytes) return;
      const samples = decodeKnownMeasurementCharacteristic(
        bytes,
        presentation,
        characteristicUuid,
        occurrenceIndex,
        occurrenceCount
      );
      for (const sample of samples) onSample(sample);
      const rawHex = toSpacedHex(bytes);
      if (rawHex !== lastRawHex) {
        lastRawHex = rawHex;
        const sources = samples.map(sample => `0x${sample.sourceId.toString(16).padStart(4, '0')}`).join(',');
        onLog(`[MEAS ${characteristicUuid.slice(0, 8)}#${occurrenceIndex + 1} -> ${sources || 'unsupported'}] ${rawHex}`);
      }
    };

    const readValue = async () => {
      try {
        processValue(await BleClient.read(
          deviceId,
          service.uuid,
          characteristic.uuid,
          { characteristicIndex: occurrenceIndex } as any
        ));
      } catch (error: any) {
        onLog(`[MEAS] Read failed ${characteristicUuid}: ${error?.message ?? error}`);
      }
    };

    if (characteristic.properties.read) {
      await readValue();
      if (occurrenceCount > 1) pollReaders.push(readValue);
    }

    if ((characteristic.properties.notify || characteristic.properties.indicate)
      && occurrenceCount === 1
      && !monitoredCharacteristics.has(characteristicUuid)) {
      try {
        await BleClient.startNotifications(deviceId, service.uuid, characteristic.uuid, processValue);
        monitoredCharacteristics.add(characteristicUuid);
        subscriptions.push({ service: service.uuid, characteristic: characteristic.uuid });
      } catch (error: any) {
        onLog(`[MEAS] Notification failed ${characteristicUuid}: ${error?.message ?? error}`);
      }
    }
  }

  const previousTimer = pollingTimers.get(deviceId);
  if (previousTimer) clearInterval(previousTimer);
  if (pollReaders.length > 0) {
    let polling = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        for (const readValue of pollReaders) await readValue();
      } finally {
        polling = false;
      }
    }, 1000);
    pollingTimers.set(deviceId, timer);
  }

  return subscriptions;
}

export async function stopMeasurementMonitoring(
  deviceId: string,
  subscriptions: BleMeasurementSubscription[],
  onLog?: (line: string) => void
): Promise<void> {
  const pollingTimer = pollingTimers.get(deviceId);
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimers.delete(deviceId);
  }
  for (const subscription of subscriptions) {
    try {
      await BleClient.stopNotifications(deviceId, subscription.service, subscription.characteristic);
    } catch (error: any) {
      onLog?.(`[MEAS] Stop notification failed: ${error?.message ?? error}`);
    }
  }
}

export const MEASUREMENT_SOURCE_TO_ID: Readonly<Record<number, string>> = {
  0x0000: 'battery_level_percent',
  0x0010: 'temperature',
  0x0011: 'humidity',
  0x0014: 'index_1',
  0x0015: 'pin_state_1',
  0x0016: 'index_2',
  0x0017: 'pin_state_2',
  0x0018: 'index_3',
  0x0019: 'pin_state_3',
  0x001a: 'index_4',
  0x001b: 'pin_state_4',
};
