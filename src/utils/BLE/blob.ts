import { BleClient } from '@capacitor-community/bluetooth-le';
import {
  FF_NOTIFY_SHORT,
  FF_SERVICE_SHORT,
  FF_WRITE_SHORT,
} from '@/utils/BLE/characteristics';
import { findCharacteristic } from '@/utils/BLE/connection';
import {
  BLOB_COMMAND_CHAR_UUID,
  BLOB_DATA_CHAR_UUID,
  BLOB_INFO_CHAR_UUID,
  BLOB_STATUS_CHAR_UUID,
  OSA_ADMIN_SERVICE_UUID,
} from '@/utils/BLE/characteristics';
import { findCharacteristicByUuid } from '@/utils/BLE/connection';

const CONFIG_OBJECT_ID = 0x00020001;
const CMD_OPEN_READ = 0x01;
const CMD_OPEN_WRITE = 0x02;
const CMD_READ_NEXT = 0x03;
const CMD_WRITE_DONE = 0x04;
const CMD_COMMIT = 0x05;
const CMD_FLAG_REBOOT_AFTER_COMMIT = 0x01;
const STATE_READY_WRITE = 0x02;
const STATE_TRANSFERRING = 0x03;
const STATE_WAIT_COMMIT = 0x04;
const STATE_DONE = 0x05;
const OBJ_DATA_HEADER_SIZE = 8;
const OBJ_DATA_PAYLOAD_MAX = 236;

export type BlobStatus = {
  state: number;
  error: number;
  attMtu: number;
  objectId: number;
  size: number;
  transferred: number;
  crc32: number;
};

export function buildConfigurationBlob(frames: readonly string[]): Uint8Array {
  const records: Uint8Array[] = [];
  let size = 1; // terminal 0xff
  for (const frame of frames) {
    const compact = frame.replace(/\s+/g, '');
    if (!/^(?:[0-9a-fA-F]{2})+$/.test(compact)) throw new Error(`Invalid hexadecimal frame: ${frame}`);
    const bytes = parseHexToUint8Array(compact);
    if (!bytes || bytes.length === 0) throw new Error(`Invalid empty/hexadecimal frame: ${frame}`);
    if (bytes.length > 0xfe) throw new Error(`Configuration frame is too long (${bytes.length} bytes)`);
    const record = new Uint8Array(bytes.length + 1);
    record[0] = bytes.length;
    record.set(bytes, 1);
    records.push(record);
    size += record.length;
  }
  if (records.length === 0) throw new Error('Configuration contains no frames');

  const blob = new Uint8Array(size);
  let offset = 0;
  for (const record of records) {
    blob.set(record, offset);
    offset += record.length;
  }
  blob[offset] = 0xff;
  return blob;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildBlobCommand(command: number, objectId: number, size = 0, expectedCrc32 = 0, flags = 0): Uint8Array {
  const bytes = new Uint8Array(20);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, command);
  view.setUint8(1, flags);
  view.setUint32(4, objectId, true);
  view.setUint32(12, size, true);
  view.setUint32(16, expectedCrc32, true);
  return bytes;
}

export function buildBlobChunk(sequence: number, isLast: boolean, offset: number, payload: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(OBJ_DATA_HEADER_SIZE + payload.length);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, sequence, true);
  view.setUint16(2, isLast ? 1 : 0, true);
  view.setUint32(4, offset, true);
  bytes.set(payload, OBJ_DATA_HEADER_SIZE);
  return bytes;
}

export function parseBlobStatus(bytes: Uint8Array): BlobStatus {
  if (bytes.length !== 20) throw new Error(`Invalid ObjStatus length: ${bytes.length}`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    state: view.getUint8(0), error: view.getUint8(1), attMtu: view.getUint16(2, true),
    objectId: view.getUint32(4, true), size: view.getUint32(8, true),
    transferred: view.getUint32(12, true), crc32: view.getUint32(16, true),
  };
}

export type BlobDataFrame = {
  sequence: number;
  flags: number;
  offset: number;
  payload: Uint8Array;
  isLast: boolean;
};

export function parseBlobData(bytes: Uint8Array): BlobDataFrame {
  if (bytes.length < OBJ_DATA_HEADER_SIZE) throw new Error(`Invalid ObjData length: ${bytes.length}`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = view.getUint16(2, true);
  return {
    sequence: view.getUint16(0, true),
    flags,
    offset: view.getUint32(4, true),
    payload: bytes.slice(OBJ_DATA_HEADER_SIZE),
    isLast: (flags & 1) !== 0,
  };
}

export function formatConfigurationBlob(blob: Uint8Array): string[] {
  const output: string[] = [];
  let offset = 0;
  let linesSinceSeparator = 0;
  while (offset < blob.length) {
    const lineSize = blob[offset];
    if (lineSize === 0xff) {
      if (offset !== blob.length - 1) throw new Error(`Unexpected data after terminal FF at offset ${offset}`);
      output.push('FF');
      return output;
    }
    if (lineSize === 0x00) {
      if (linesSinceSeparator === 0) throw new Error(`Separator 00 at offset ${offset} does not follow a line`);
      if (offset + 1 >= blob.length || blob[offset + 1] < 1 || blob[offset + 1] > 0xfe) {
        throw new Error(`Separator 00 at offset ${offset} must be followed by a line size`);
      }
      output.push('00');
      linesSinceSeparator = 0;
      offset++;
      continue;
    }
    const end = offset + 1 + lineSize;
    if (end > blob.length) throw new Error(`Truncated configuration line at offset ${offset}: size=0x${lineSize.toString(16).padStart(2, '0')}`);
    output.push(`${lineSize.toString(16).padStart(2, '0')} ${toSpacedHex(blob.slice(offset + 1, end))}`.toUpperCase());
    linesSinceSeparator++;
    offset = end;
  }
  throw new Error('Configuration BLOB has no terminal FF byte');
}

export async function downloadConfigurationBlob(
  deviceId: string,
  onLog: (line: string) => void,
  timeoutMs = 30000
): Promise<{ blob: Uint8Array; status: BlobStatus; computedCrc32: number; formattedLines: string[] }> {
  const [commandChar, statusChar, dataChar] = await Promise.all([
    findCharacteristicByUuid(deviceId, OSA_ADMIN_SERVICE_UUID, BLOB_COMMAND_CHAR_UUID, onLog),
    findCharacteristicByUuid(deviceId, OSA_ADMIN_SERVICE_UUID, BLOB_STATUS_CHAR_UUID, onLog),
    findCharacteristicByUuid(deviceId, OSA_ADMIN_SERVICE_UUID, BLOB_DATA_CHAR_UUID, onLog),
  ]);
  if (!commandChar || !statusChar || !dataChar) throw new Error('Admin BLOB characteristics not found');

  const queuedFrames: Uint8Array[] = [];
  let pendingResolve: ((bytes: Uint8Array) => void) | undefined;
  const waitForFrame = (): Promise<Uint8Array> => {
    const queued = queuedFrames.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingResolve = undefined;
        reject(new Error(`BLOB read timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
      pendingResolve = (bytes) => {
        clearTimeout(timer);
        pendingResolve = undefined;
        resolve(bytes);
      };
    });
  };
  const writeCommand = async (command: number) => {
    const bytes = buildBlobCommand(command, CONFIG_OBJECT_ID);
    await BleClient.write(deviceId, commandChar.service, commandChar.characteristic,
      new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  };

  await BleClient.startNotifications(deviceId, dataChar.service, dataChar.characteristic, (value: any) => {
    const bytes = toUint8ArrayFromBleValue(value);
    if (!bytes) return;
    const copy = bytes.slice();
    if (pendingResolve) pendingResolve(copy);
    else queuedFrames.push(copy);
  });

  try {
    onLog('BLOB read: OPEN_READ');
    await writeCommand(CMD_OPEN_READ);
    const payloadParts: Uint8Array[] = [];
    let expectedSequence = 0;
    let expectedOffset = 0;

    while (true) {
      const frame = parseBlobData(await waitForFrame());
      onLog(`ObjData(N): seq=${frame.sequence} offset=${frame.offset} len=${frame.payload.length} last=${frame.isLast}`);
      if (frame.sequence !== expectedSequence) throw new Error(`Unexpected ObjData sequence: got ${frame.sequence}, expected ${expectedSequence}`);
      if (frame.offset !== expectedOffset) throw new Error(`Unexpected ObjData offset: got ${frame.offset}, expected ${expectedOffset}`);
      payloadParts.push(frame.payload);
      expectedSequence++;
      expectedOffset += frame.payload.length;
      if (frame.isLast) break;
      await writeCommand(CMD_READ_NEXT);
    }

    const blob = new Uint8Array(expectedOffset);
    let outputOffset = 0;
    for (const part of payloadParts) {
      blob.set(part, outputOffset);
      outputOffset += part.length;
    }
    const statusRaw = await BleClient.read(deviceId, statusChar.service, statusChar.characteristic);
    const statusBytes = toUint8ArrayFromBleValue(statusRaw);
    if (!statusBytes) throw new Error('Unable to decode ObjStatus after read');
    const status = parseBlobStatus(statusBytes);
    if (status.error !== 0) throw new Error(`BLOB read failed with status error ${status.error}`);
    if (status.size !== blob.length) throw new Error(`Downloaded size mismatch: received ${blob.length}, expected ${status.size}`);
    const actualCrc = crc32(blob);
    // ObjStatus.crc32 is not populated by every firmware during OPEN_READ.
    // A zero value means "not provided" here, not an expected CRC of zero.
    if (status.crc32 !== 0 && status.crc32 !== actualCrc) {
      throw new Error(`Downloaded CRC32 mismatch: got 0x${actualCrc.toString(16).padStart(8, '0')}, expected 0x${status.crc32.toString(16).padStart(8, '0')}`);
    }
    return { blob, status, computedCrc32: actualCrc, formattedLines: formatConfigurationBlob(blob) };
  } finally {
    pendingResolve = undefined;
    await BleClient.stopNotifications(deviceId, dataChar.service, dataChar.characteristic).catch(() => undefined);
  }
}

export async function uploadConfigurationBlob(
  deviceId: string,
  frames: readonly string[],
  onLog: (line: string) => void,
  rebootAfterCommit = true
): Promise<void> {
  const chars = await Promise.all([
    findCharacteristicByUuid(deviceId, OSA_ADMIN_SERVICE_UUID, BLOB_INFO_CHAR_UUID, onLog),
    findCharacteristicByUuid(deviceId, OSA_ADMIN_SERVICE_UUID, BLOB_COMMAND_CHAR_UUID, onLog),
    findCharacteristicByUuid(deviceId, OSA_ADMIN_SERVICE_UUID, BLOB_STATUS_CHAR_UUID, onLog),
    findCharacteristicByUuid(deviceId, OSA_ADMIN_SERVICE_UUID, BLOB_DATA_CHAR_UUID, onLog),
  ]);
  const [, commandChar, statusChar, dataChar] = chars;
  if (!commandChar || !statusChar || !dataChar) throw new Error('Admin BLOB characteristics not found');

  const blob = buildConfigurationBlob(frames);
  const expectedCrc = crc32(blob);
  const write = async (characteristic: string, bytes: Uint8Array) => BleClient.write(
    deviceId, OSA_ADMIN_SERVICE_UUID, characteristic,
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  );
  const readStatus = async (phase: string, expectedStates: number[]): Promise<BlobStatus> => {
    const raw = await BleClient.read(deviceId, statusChar.service, statusChar.characteristic);
    const bytes = toUint8ArrayFromBleValue(raw);
    if (!bytes) throw new Error(`Unable to decode ObjStatus after ${phase}`);
    const status = parseBlobStatus(bytes);
    onLog(`BLOB ${phase}: state=${status.state} error=${status.error} bytes=${status.transferred}/${status.size}`);
    if (status.error !== 0 || !expectedStates.includes(status.state)) {
      throw new Error(`BLOB ${phase} rejected: state=${status.state}, error=${status.error}`);
    }
    return status;
  };

  const initial = await readStatus('INITIAL', [0, STATE_DONE]);
  const payloadMax = Math.max(1, Math.min(OBJ_DATA_PAYLOAD_MAX, (initial.attMtu || 23) - 3 - OBJ_DATA_HEADER_SIZE));
  onLog(`BLOB upload: ${blob.length} bytes, CRC32=0x${expectedCrc.toString(16).padStart(8, '0')}, chunks=${payloadMax} bytes max`);

  await write(commandChar.characteristic, buildBlobCommand(
    CMD_OPEN_WRITE, CONFIG_OBJECT_ID, blob.length, expectedCrc,
    rebootAfterCommit ? CMD_FLAG_REBOOT_AFTER_COMMIT : 0
  ));
  await readStatus('OPEN_WRITE', [STATE_READY_WRITE]);

  let offset = 0;
  let sequence = 0;
  while (offset < blob.length) {
    const payload = blob.slice(offset, offset + payloadMax);
    const isLast = offset + payload.length === blob.length;
    await write(dataChar.characteristic, buildBlobChunk(sequence, isLast, offset, payload));
    const status = await readStatus(`DATA ${sequence}${isLast ? ' LAST' : ''}`, isLast ? [STATE_WAIT_COMMIT] : [STATE_TRANSFERRING]);
    if (status.transferred !== offset + payload.length) throw new Error(`BLOB transferred byte count mismatch after chunk ${sequence}`);
    offset += payload.length;
    sequence++;
  }

  await write(commandChar.characteristic, buildBlobCommand(CMD_WRITE_DONE, CONFIG_OBJECT_ID));
  await readStatus('WRITE_DONE', [STATE_WAIT_COMMIT]);
  await write(commandChar.characteristic, buildBlobCommand(CMD_COMMIT, CONFIG_OBJECT_ID));
  if (!rebootAfterCommit) await readStatus('COMMIT', [STATE_DONE]);
  onLog(rebootAfterCommit ? 'BLOB committed; sensor reboot requested' : 'BLOB committed');
}

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
