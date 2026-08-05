import { BleClient } from '@capacitor-community/bluetooth-le';
import {
  FF_NOTIFY_SHORT,
  FF_SERVICE_SHORT,
  FF_WRITE_SHORT,
} from '@/utils/BLE/characteristics';
import { findCharacteristic } from '@/utils/BLE/connection';

export function parseHexToUint8Array(hex: string): Uint8Array | null {
  if (!hex) return new Uint8Array([]);
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2 !== 0) return null;

  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }

  return bytes;
}

export function toUint8ArrayFromBleValue(value: any): Uint8Array | null {
  if (value instanceof DataView) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof Uint8Array) return value;
  if (value?.value instanceof DataView) return new Uint8Array(value.value.buffer, value.value.byteOffset, value.value.byteLength);
  if (value?.value instanceof ArrayBuffer) return new Uint8Array(value.value);
  return null;
}

export function toSpacedHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

export function dataViewToHex(value: DataView | ArrayBuffer | Uint8Array | any): string {
  try {
    const arr = toUint8ArrayFromBleValue(value);
    if (!arr) return JSON.stringify(value);
    return toSpacedHex(arr);
  } catch {
    return String(value);
  }
}

export function extractBleErrorCodeFromAny(error: any): string | null {
  if (!error) return null;

  const candidates = [
    error.code,
    error.errorCode,
    error.status,
    error.nativeErrorCode,
    error.androidErrorCode,
    error?.cause?.code,
    error?.cause?.errorCode,
    error?.cause?.status,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;

    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return `0x${candidate.toString(16).toLowerCase()}`;
    }

    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (/^0x[0-9a-f]+$/i.test(trimmed)) return trimmed.toLowerCase();
      if (/^[0-9]+$/.test(trimmed)) return `0x${Number(trimmed).toString(16).toLowerCase()}`;
    }
  }

  const message = String(error?.message ?? error ?? '');
  const hex = message.match(/0x([0-9a-f]{2,4})/i);
  if (hex) return `0x${hex[1].toLowerCase()}`;

  const decimal = message.match(/(?:error|status|code|application\s+error)\s*[:=]?\s*(\d{1,5})/i);
  if (decimal) return `0x${Number(decimal[1]).toString(16).toLowerCase()}`;

  return null;
}

export function formatBleWriteError(prefix: string, error: any): string {
  const code = extractBleErrorCodeFromAny(error);
  const message = String(error?.message ?? error ?? 'Unknown BLE error');
  return code ? `${prefix}: ${message} (code ${code})` : `${prefix}: ${message}`;
}

export function getBleErrorDetails(error: any): string {
  if (!error) return 'no error payload';

  const details = {
    code: error?.code,
    errorCode: error?.errorCode,
    status: error?.status,
    nativeErrorCode: error?.nativeErrorCode,
    androidErrorCode: error?.androidErrorCode,
    causeCode: error?.cause?.code,
    causeStatus: error?.cause?.status,
    name: error?.name,
    message: error?.message,
    constructor: error?.constructor?.name,
  };

  const compact = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined && value !== null)
  );

  if (Object.keys(compact).length > 0) return JSON.stringify(compact);

  try {
    const ownProps = Object.getOwnPropertyNames(error ?? {});
    if (ownProps.length > 0) {
      const ownValues = Object.fromEntries(
        ownProps.map((prop) => {
          try {
            const value = error[prop];
            if (typeof value === 'function') return [prop, '[function]'];
            if (value && typeof value === 'object') return [prop, '[object]'];
            return [prop, String(value)];
          } catch {
            return [prop, '[unreadable]'];
          }
        })
      );
      return JSON.stringify({ ownProps: ownValues });
    }
  } catch {
    // ignore
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function writeToCharacteristicByShort(
  deviceId: string,
  shortChar: string,
  data: Uint8Array,
  onLog: (line: string) => void
): Promise<void> {
  const found = await findCharacteristic(deviceId, shortChar, undefined, onLog);
  if (!found) {
    onLog(`Char ${shortChar} not found`);
    return;
  }

  try {
    const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (found.props.writeWithoutResponse) {
      await BleClient.writeWithoutResponse(deviceId, found.service, found.characteristic, dataView);
      onLog(`${new Date().toLocaleTimeString()} [WRITE-wo ${found.characteristic.slice(0, 8)}] ${toSpacedHex(data)}`);
      return;
    }
    if (found.props.write) {
      await BleClient.write(deviceId, found.service, found.characteristic, dataView);
      onLog(`${new Date().toLocaleTimeString()} [WRITE ${found.characteristic.slice(0, 8)}] ${toSpacedHex(data)}`);
      return;
    }

    onLog(`Char ${found.characteristic} not writable`);
  } catch (error: any) {
    onLog(formatBleWriteError('Write failed', error));
    console.debug('[BLE_DBG_WRITE_ERROR]', {
      code: extractBleErrorCodeFromAny(error),
      message: error?.message ?? error,
      raw: error,
    });
  }
}

export async function writeToCharacteristicInService(
  deviceId: string,
  shortService: string,
  shortChar: string,
  data: Uint8Array,
  onLog: (line: string) => void
): Promise<void> {
  const found = await findCharacteristic(deviceId, shortChar, shortService, onLog);
  if (!found) {
    onLog(`Char ${shortChar} not found in service ${shortService}`);
    return;
  }

  try {
    const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (found.props.writeWithoutResponse) {
      await BleClient.writeWithoutResponse(deviceId, found.service, found.characteristic, dataView);
      onLog(`${new Date().toLocaleTimeString()} [WRITE-wo ${found.characteristic.slice(0, 8)}] ${toSpacedHex(data)}`);
      return;
    }
    if (found.props.write) {
      await BleClient.write(deviceId, found.service, found.characteristic, dataView);
      onLog(`${new Date().toLocaleTimeString()} [WRITE ${found.characteristic.slice(0, 8)}] ${toSpacedHex(data)}`);
      return;
    }

    onLog(`Char ${found.characteristic} not writable`);
  } catch (error: any) {
    onLog(formatBleWriteError('Write failed', error));
    console.debug('[BLE_DBG_WRITE_ERROR]', {
      code: extractBleErrorCodeFromAny(error),
      message: error?.message ?? error,
      raw: error,
    });
  }
}

export async function readCharacteristicByShort(
  deviceId: string,
  shortChar: string,
  onLog: (line: string) => void
): Promise<void> {
  const found = await findCharacteristic(deviceId, shortChar, undefined, onLog);
  if (!found) {
    onLog(`Char ${shortChar} not found`);
    return;
  }

  try {
    const read = await BleClient.read(deviceId, found.service, found.characteristic);
    onLog(`${new Date().toLocaleTimeString()} [READ ${found.characteristic.slice(0, 8)}] ${dataViewToHex(read)}`);
  } catch (error: any) {
    onLog(`Read failed: ${error?.message ?? error}`);
  }
}

export async function readCharacteristicInServiceByShort(
  deviceId: string,
  shortService: string,
  shortChar: string,
  onLog: (line: string) => void
): Promise<void> {
  const found = await findCharacteristic(deviceId, shortChar, shortService, onLog);
  if (!found) {
    onLog(`Char ${shortChar} not found in service ${shortService}`);
    return;
  }

  try {
    const read = await BleClient.read(deviceId, found.service, found.characteristic);
    onLog(`${new Date().toLocaleTimeString()} [READ ${shortService.toUpperCase()}/${shortChar.toUpperCase()}] ${dataViewToHex(read)}`);
  } catch (error: any) {
    onLog(`Read failed ${shortService}/${shortChar}: ${error?.message ?? error}`);
  }
}

export async function writeToFf01(
  deviceId: string,
  payload: Uint8Array,
  onLog: (line: string) => void
): Promise<void> {
  const ff01 = await findCharacteristic(deviceId, FF_WRITE_SHORT, FF_SERVICE_SHORT, onLog);
  if (!ff01) {
    onLog('FF00/FF01 not found');
    return;
  }

  const ff00NotifyCandidate = await findCharacteristic(deviceId, FF_NOTIFY_SHORT, FF_SERVICE_SHORT, onLog);
  const ff00Notify = (ff00NotifyCandidate && (ff00NotifyCandidate.props.notify || ff00NotifyCandidate.props.indicate))
    ? ff00NotifyCandidate
    : ((ff01.props.notify || ff01.props.indicate) ? ff01 : null);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let resolveResponse: ((value: Uint8Array | null) => void) | undefined;
  const responsePromise = new Promise<Uint8Array | null>((resolve) => {
    resolveResponse = resolve;
  });

  const finishResponse = (value: Uint8Array | null) => {
    if (!resolveResponse) return;
    const resolve = resolveResponse;
    resolveResponse = undefined;

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    resolve(value);
  };

  try {
    if (ff00Notify) {
      await BleClient.startNotifications(deviceId, ff00Notify.service, ff00Notify.characteristic, (value: any) => {
        const bytes = toUint8ArrayFromBleValue(value);
        if (!bytes) return;
        onLog(`${new Date().toLocaleTimeString()} [NOTIF FF00] ${toSpacedHex(bytes)}`);
        finishResponse(bytes);
      });
      timeoutId = setTimeout(() => finishResponse(null), 3000);
    } else {
      onLog('FF00 notify char not found (continuing write only)');
      finishResponse(null);
    }

    const dataView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    if (ff01.props.writeWithoutResponse) {
      await BleClient.writeWithoutResponse(deviceId, ff01.service, ff01.characteristic, dataView);
      onLog(`${new Date().toLocaleTimeString()} [WRITE-wo FF00/FF01] ${toSpacedHex(payload)}`);
    } else if (ff01.props.write) {
      await BleClient.write(deviceId, ff01.service, ff01.characteristic, dataView);
      onLog(`${new Date().toLocaleTimeString()} [WRITE FF00/FF01] ${toSpacedHex(payload)}`);
    } else {
      onLog('FF00/FF01 is not writable');
      finishResponse(null);
      return;
    }

    if (ff00Notify) {
      const response = await responsePromise;
      if (!response) onLog('FF00 notification timeout (3s)');
    }
  } catch (error: any) {
    onLog(formatBleWriteError('FF01 write/notify failed', error));
    onLog(`FF01 error details: ${getBleErrorDetails(error)}`);
    console.debug('[BLE_DBG_FF01_ERROR]', {
      code: extractBleErrorCodeFromAny(error),
      details: getBleErrorDetails(error),
      raw: error,
    });
    finishResponse(null);
  } finally {
    if (ff00Notify) {
      try {
        await BleClient.stopNotifications(deviceId, ff00Notify.service, ff00Notify.characteristic);
      } catch (error: any) {
        onLog(`FF00 stopNotifications failed: ${error?.message ?? error}`);
      }
    }
  }
}
