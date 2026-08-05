import { BleClient } from '@capacitor-community/bluetooth-le';
import { findCharacteristic } from '@/utils/BLE/connection';
import {
  parseHexToUint8Array,
  toSpacedHex,
  toUint8ArrayFromBleValue,
  writeToCharacteristicByShort,
} from '@/utils/BLE/blob';

export function asciiRunsFromBytes(bytes: Uint8Array): string[] {
  let output = '';
  for (const byte of bytes) {
    output += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '\0';
  }
  return output.split('\0').filter((run) => run.length >= 3);
}

export function tryExtractInfoFromHex(hexStr: string): { model?: string | null; fw?: string | null; decoded?: string } {
  const clean = hexStr.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2 !== 0) return {};

  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }

  let decoded = '';
  try {
    decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    decoded = Array.from(bytes).map((b) => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '\0').join('');
  }

  const parts = decoded.split(/\x00+/).map((part) => part.trim()).filter((part) => part.length > 0);
  let model: string | null = null;
  let fw: string | null = null;

  for (const part of parts) {
    if (!model) {
      const foundModel = part.match(/(\d{1,3}(?:-\d{1,3}){1,})/);
      if (foundModel) model = foundModel[0];
    }
    if (!fw) {
      const foundFw = part.match(/(\d+(?:\.\d+){1,}[\w\-\._]{2,})/);
      if (foundFw) fw = foundFw[0];
    }
  }

  if ((!model || !fw) && parts.length === 0) {
    const runs = asciiRunsFromBytes(bytes);
    for (const run of runs) {
      if (!model) {
        const foundModel = run.match(/(\d{1,3}(?:-\d{1,3}){1,})/);
        if (foundModel) model = foundModel[0];
      }
      if (!fw) {
        const foundFw = run.match(/(\d+(?:\.\d+){1,}[\w\-\._]{2,})/);
        if (foundFw) fw = foundFw[0];
      }
    }
  }

  return { model, fw, decoded };
}

export async function autoFetchModelFirmware(
  deviceId: string,
  onLog: (line: string) => void
): Promise<{ modelInfo: string | null; firmwareInfo: string | null }> {
  onLog('Starting auto fetch of model & firmware...');

  let modelInfo: string | null = null;
  let firmwareInfo: string | null = null;

  const fe61 = await findCharacteristic(deviceId, 'fe61', 'fe60', onLog);
  const fe62 = await findCharacteristic(deviceId, 'fe62', 'fe60', onLog);
  if (!fe61 || !fe62) {
    onLog('FE61 or FE62 not found');
    return { modelInfo, firmwareInfo };
  }

  const timeoutMs = 7000;
  const buffers: Record<string, number[]> = {};

  const appendToBuffer = (key: string, data: Uint8Array) => {
    if (!buffers[key]) buffers[key] = [];
    for (let i = 0; i < data.length; i++) buffers[key].push(data[i]);
  };

  const notifHandler = (value: any) => {
    const bytes = toUint8ArrayFromBleValue(value);
    if (!bytes || bytes.length < 6) return;

    const keyBytes = bytes.slice(2, 6);
    const keyHex = Array.from(keyBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const payload = bytes.slice(6);
    appendToBuffer(keyHex, payload);

    onLog(`${new Date().toLocaleTimeString()} [AUTO-NOTIF] ${toSpacedHex(bytes)}`);
  };

  try {
    await BleClient.startNotifications(deviceId, fe61.service, fe61.characteristic, notifHandler);
  } catch (error: any) {
    onLog(`startNotifications failed: ${error?.message ?? error}`);
  }

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const modelRequest = parseHexToUint8Array('110000000005');
  if (!modelRequest) {
    onLog('Model request payload is invalid');
    return { modelInfo, firmwareInfo };
  }

  const modelKey = Array.from(modelRequest.slice(2, 6)).map((b) => b.toString(16).padStart(2, '0')).join('');
  buffers[modelKey] = [];
  await writeToCharacteristicByShort(deviceId, 'fe62', modelRequest, onLog);

  let waited = 0;
  while (buffers[modelKey].length === 0 && waited < timeoutMs) {
    await wait(200);
    waited += 200;
  }
  await wait(300);

  if (buffers[modelKey] && buffers[modelKey].length > 0) {
    const bytes = new Uint8Array(buffers[modelKey]);
    const extracted = tryExtractInfoFromHex(toSpacedHex(bytes));
    if (extracted.model) {
      modelInfo = extracted.model;
    } else {
      const runs = asciiRunsFromBytes(bytes);
      if (runs.length > 0) modelInfo = runs[0];
    }
  }

  const fwRequest = parseHexToUint8Array('110000008001');
  if (!fwRequest) {
    onLog('Firmware request payload is invalid');
    return { modelInfo, firmwareInfo };
  }

  const fwKey = Array.from(fwRequest.slice(2, 6)).map((b) => b.toString(16).padStart(2, '0')).join('');
  buffers[fwKey] = [];
  await writeToCharacteristicByShort(deviceId, 'fe62', fwRequest, onLog);

  waited = 0;
  while (buffers[fwKey].length === 0 && waited < timeoutMs) {
    await wait(200);
    waited += 200;
  }
  await wait(300);

  if (buffers[fwKey] && buffers[fwKey].length > 0) {
    const bytes = new Uint8Array(buffers[fwKey]);
    const extracted = tryExtractInfoFromHex(toSpacedHex(bytes));
    if (extracted.fw) {
      firmwareInfo = extracted.fw;
    } else {
      const runs = asciiRunsFromBytes(bytes);
      if (runs.length > 0) firmwareInfo = runs.join(' ');
    }
  }

  try {
    await BleClient.stopNotifications(deviceId, fe61.service, fe61.characteristic);
  } catch {
    // ignore
  }

  onLog('--- Auto fetch result ---');
  onLog(`Model ID: ${modelInfo ?? 'not found'}`);
  onLog(`Firmware: ${firmwareInfo ?? 'not found'}`);

  return { modelInfo, firmwareInfo };
}
