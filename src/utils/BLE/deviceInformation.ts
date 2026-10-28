import {
  readAppRx,
  startAppRxMonitoring,
  stopAppRxMonitoring,
  writeAppTx,
  type AppRxSubscription,
} from '@/utils/BLE/appFrames';

export type DeviceInformation = {
  // null means that the device explicitly returned an empty/0xff value.
  // undefined means that no usable response was received.
  firmwareVersion: string | null | undefined;
  manufacturer: string | null | undefined;
  pcbVersion: string | null | undefined;
};

type DeviceInformationField = 2 | 4 | 5;

const RESPONSE_TIMEOUT_MS = 2_000;
const RESPONSE_PREFIX = [0x11, 0x01, 0x00, 0x00, 0x00] as const;

function isResponseFor(frame: Uint8Array, field: DeviceInformationField): boolean {
  return frame.length >= 8
    && RESPONSE_PREFIX.every((byte, index) => frame[index] === byte)
    && frame[5] === field
    && frame[6] === 0x00;
}

function decodeAscii(bytes: Uint8Array): string | null {
  if (bytes.length > 0 && bytes.every(byte => byte === 0xff)) return null;
  const value = new TextDecoder('ascii').decode(bytes).replace(/\0+$/, '').trim();
  return value || null;
}

export function decodeFirmwareVersionResponse(frame: Uint8Array): string | null {
  if (!isResponseFor(frame, 2) || frame[7] !== 0x0d || frame.length < 14) return null;
  if (frame.subarray(8, 14).every(byte => byte === 0xff)) return null;
  const semanticVersion = Array.from(frame.subarray(8, 11)).join('.');
  const version = frame[11] | (frame[12] << 8) | (frame[13] << 16);
  return `${semanticVersion}:${version}`;
}

function decodeStringResponse(frame: Uint8Array, field: 4 | 5): string | null {
  if (!isResponseFor(frame, field) || frame[7] !== 0x42 || frame.length < 9) return null;
  const length = frame[8];
  if (frame.length < 9 + length) return null;
  return decodeAscii(frame.subarray(9, 9 + length));
}

export function decodeManufacturerResponse(frame: Uint8Array): string | null {
  return decodeStringResponse(frame, 4);
}

export function decodePcbVersionResponse(frame: Uint8Array): string | null {
  return decodeStringResponse(frame, 5);
}

function decodeReceivedFirmwareVersion(frame: Uint8Array | null | undefined): string | null | undefined {
  if (!frame || frame[7] !== 0x0d || frame.length < 14) return undefined;
  return decodeFirmwareVersionResponse(frame);
}

function decodeReceivedString(
  frame: Uint8Array | null | undefined,
  field: 4 | 5,
): string | null | undefined {
  if (
    !frame
    || frame[7] !== 0x42
    || frame.length < 9
    || frame.length < 9 + frame[8]
  ) return undefined;
  return field === 4
    ? decodeManufacturerResponse(frame)
    : decodePcbVersionResponse(frame);
}

function buildRequest(field: DeviceInformationField): Uint8Array {
  return Uint8Array.of(0x11, 0x00, 0x00, 0x00, 0x00, field);
}

async function readDeviceInformationFields(
  deviceId: string,
  fields: readonly DeviceInformationField[],
  onLog: (line: string) => void,
): Promise<Map<DeviceInformationField, Uint8Array | null>> {
  let subscription: AppRxSubscription | undefined;
  let receivedFrame: ((frame: Uint8Array) => void) | undefined;
  const responses = new Map<DeviceInformationField, Uint8Array | null>();

  try {
    subscription = await startAppRxMonitoring(
      deviceId,
      frame => receivedFrame?.(frame),
      onLog,
    );

    const request = async (field: DeviceInformationField): Promise<Uint8Array | null> => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const response = new Promise<Uint8Array | null>(resolve => {
        receivedFrame = frame => {
          if (!isResponseFor(frame, field)) return;
          if (timeoutId !== undefined) clearTimeout(timeoutId);
          receivedFrame = undefined;
          resolve(frame);
        };
        timeoutId = setTimeout(() => {
          receivedFrame = undefined;
          resolve(null);
        }, RESPONSE_TIMEOUT_MS);
      });

      await writeAppTx(deviceId, buildRequest(field), onLog);
      if (!subscription?.notifications) {
        try {
          receivedFrame?.(await readAppRx(deviceId, subscription!));
        } catch (error: any) {
          onLog(`[DEVICE INFO] Read ${field} failed: ${error?.message ?? error}`);
        }
      }
      return response;
    };

    for (const field of fields) responses.set(field, await request(field));
    return responses;
  } finally {
    receivedFrame = undefined;
    await stopAppRxMonitoring(subscription, onLog);
  }
}

export async function readFirmwareVersion(
  deviceId: string,
  onLog: (line: string) => void,
): Promise<string | null> {
  const responses = await readDeviceInformationFields(deviceId, [2], onLog);
  return decodeFirmwareVersionResponse(responses.get(2) ?? new Uint8Array());
}

export async function readDeviceInformation(
  deviceId: string,
  onLog: (line: string) => void,
): Promise<DeviceInformation> {
  const responses = await readDeviceInformationFields(deviceId, [2, 4, 5], onLog);
  const firmwareResponse = responses.get(2);
  const manufacturerResponse = responses.get(4);
  const pcbResponse = responses.get(5);
  return {
    firmwareVersion: decodeReceivedFirmwareVersion(firmwareResponse),
    manufacturer: decodeReceivedString(manufacturerResponse, 4),
    pcbVersion: decodeReceivedString(pcbResponse, 5),
  };
}
