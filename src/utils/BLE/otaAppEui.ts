import {
  readAppRx,
  startAppRxMonitoring,
  stopAppRxMonitoring,
  writeAppTx,
  type AppRxSubscription,
} from '@/utils/BLE/appFrames';
import {
  getAppFrameResponseStatus,
  getAppFrameStatusName,
  matchesAppFrameResponse,
} from '@/utils/BLE/appFrameResponseRules';
import { toSpacedHex } from '@/utils/BLE/blob';

const RESPONSE_TIMEOUT_MS = 2_000;
const OTA_APP_EUI_ATTRIBUTE = [0x00, 0x05] as const;

export const OTA_APP_EUI_READ_FRAME = Uint8Array.of(
  0x11, 0x00, 0x80, 0x04, ...OTA_APP_EUI_ATTRIBUTE,
);

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeAppEui(value: string): string | null {
  const normalized = value.replace(/[^0-9a-f]/gi, '').toUpperCase();
  return /^[0-9A-F]{16}$/.test(normalized) ? normalized : null;
}

export function buildOtaAppEuiWriteFrame(value: string): Uint8Array | null {
  const normalized = normalizeAppEui(value);
  if (!normalized) return null;
  const bytes = normalized.match(/.{2}/g)?.map(byte => Number.parseInt(byte, 16)) ?? [];
  return Uint8Array.of(
    0x11, 0x02, 0x80, 0x04, ...OTA_APP_EUI_ATTRIBUTE, 0x41, 0x08, ...bytes,
  );
}

export function decodeOtaAppEuiResponse(frame: Uint8Array): string | null {
  if (
    frame.length < 17
    || !matchesAppFrameResponse(OTA_APP_EUI_READ_FRAME, frame)
    || frame[6] !== 0x00
    || frame[7] !== 0x41
    || frame[8] !== 0x08
  ) return null;

  return Array.from(frame.subarray(9, 17), byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function pollForResponse(
  deviceId: string,
  subscription: AppRxSubscription,
  request: Uint8Array,
  onLog: (line: string) => void,
): Promise<Uint8Array | null> {
  const deadline = Date.now() + RESPONSE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await delay(100);
    try {
      const response = await readAppRx(deviceId, subscription);
      onLog(`[APP RX] ${toSpacedHex(response)}`);
      if (matchesAppFrameResponse(request, response)) return response;
    } catch (error: any) {
      onLog(`[OTA AppEUI] APP RX read failed: ${error?.message ?? error}`);
    }
  }
  return null;
}

async function sendRequestAndWaitForResponse(
  deviceId: string,
  request: Uint8Array,
  operation: string,
  onLog: (line: string) => void,
): Promise<Uint8Array> {
  let subscription: AppRxSubscription | undefined;
  let receivedFrame: ((frame: Uint8Array) => void) | undefined;
  let notificationTimeout: ReturnType<typeof setTimeout> | undefined;

  try {
    subscription = await startAppRxMonitoring(
      deviceId,
      frame => receivedFrame?.(frame),
      onLog,
    );

    let notificationResponse: Promise<Uint8Array | null> | undefined;
    if (subscription.notifications) {
      notificationResponse = new Promise(resolve => {
        notificationTimeout = setTimeout(() => {
          receivedFrame = undefined;
          resolve(null);
        }, RESPONSE_TIMEOUT_MS);
        receivedFrame = frame => {
          if (!matchesAppFrameResponse(request, frame)) return;
          if (notificationTimeout !== undefined) clearTimeout(notificationTimeout);
          notificationTimeout = undefined;
          receivedFrame = undefined;
          resolve(frame);
        };
      });
    }

    await writeAppTx(deviceId, request, onLog);
    const response = notificationResponse
      ? await notificationResponse
      : await pollForResponse(deviceId, subscription, request, onLog);
    if (!response) throw new Error(`OTA AppEUI ${operation} timed out`);
    return response;
  } finally {
    if (notificationTimeout !== undefined) clearTimeout(notificationTimeout);
    receivedFrame = undefined;
    await stopAppRxMonitoring(subscription, onLog);
  }
}

function assertSuccessfulResponse(
  request: Uint8Array,
  response: Uint8Array,
  operation: string,
): void {
  const status = getAppFrameResponseStatus(request, response);
  if (status === 0x00) return;
  const name = status === null ? null : getAppFrameStatusName(status);
  throw new Error(`OTA AppEUI ${operation} rejected${status === null ? '' : `: ${name ?? `0x${status.toString(16).padStart(2, '0')}`}`}`);
}

export async function readOtaAppEui(
  deviceId: string,
  onLog: (line: string) => void,
): Promise<string> {
  const response = await sendRequestAndWaitForResponse(
    deviceId,
    OTA_APP_EUI_READ_FRAME,
    'read',
    onLog,
  );
  assertSuccessfulResponse(OTA_APP_EUI_READ_FRAME, response, 'read');

  const appEui = decodeOtaAppEuiResponse(response);
  if (!appEui) throw new Error('Malformed OTA AppEUI response');
  return appEui;
}

export async function writeAndVerifyOtaAppEui(
  deviceId: string,
  value: string,
  onLog: (line: string) => void,
): Promise<string> {
  const expected = normalizeAppEui(value);
  const frame = buildOtaAppEuiWriteFrame(value);
  if (!expected || !frame) throw new Error('OTA AppEUI must contain exactly 8 bytes');

  const writeResponse = await sendRequestAndWaitForResponse(deviceId, frame, 'write', onLog);
  assertSuccessfulResponse(frame, writeResponse, 'write');
  const confirmed = await readOtaAppEui(deviceId, onLog);
  if (confirmed !== expected) {
    throw new Error(`OTA AppEUI verification failed: expected ${expected}, received ${confirmed}`);
  }
  return confirmed;
}

