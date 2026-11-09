import { BleClient } from '@capacitor-community/bluetooth-le';
import {
  BST_COMMAND_CHAR_UUID,
  BST_OSA_CHALLENGE_CHAR_UUID,
  BST_OSA_RESPONSE_CHAR_UUID,
  BST_OSA_STATUS_CHAR_UUID,
  BST_SERVICE_UUID,
  BST_STATUS_CHAR_UUID,
  normalizeUuid,
} from '@/utils/BLE/characteristics';
import { findCharacteristicByUuid } from '@/utils/BLE/connection';
import { authenticateOsa, type OsaGattProfile } from '@/utils/BLE/osa';
import { toSpacedHex, toUint8ArrayFromBleValue } from '@/utils/BLE/blob';

export const BST_PROTOCOL_VERSION = 0x01;
export const BST_COMMAND_CONFIRMATION = 0xa5;
export const BST_COMMAND_TIMEOUT_MS = 10_000;
const BST_OSA_RETRY_DELAY_MS = 750;

export const BST_OSA_GATT_PROFILE: OsaGattProfile = {
  serviceUuid: BST_SERVICE_UUID,
  challengeUuid: BST_OSA_CHALLENGE_CHAR_UUID,
  responseUuid: BST_OSA_RESPONSE_CHAR_UUID,
  statusUuid: BST_OSA_STATUS_CHAR_UUID,
};

export const BST_TARGETS = [
  { id: 0x00, key: 'normal', elevated: false },
  { id: 0x01, key: 'autotest', elevated: false },
  { id: 0x02, key: 'finalAutotest', elevated: false },
  { id: 0x03, key: 'cemOnce', elevated: false },
  { id: 0x04, key: 'cemPermanent', elevated: true },
  { id: 0x05, key: 'continuousFsk', elevated: true },
  { id: 0x06, key: 'continuousLora', elevated: true },
  { id: 0x07, key: 'burstLora', elevated: true },
  { id: 0x08, key: 'storage', elevated: false },
] as const;

export type BstTarget = typeof BST_TARGETS[number];

export type BstStatus = {
  version: number;
  phase: number;
  blockingMask: number;
  autotestLog: number;
  autotestLastNum: number;
  cemState: number;
  blockedStarting: number;
  minUptimeExpired: number;
  result: number;
  availableTargets: number;
};

export const BST_RESULT_KEYS: Record<number, string> = {
  0x00: 'none',
  0x01: 'accepted',
  0x02: 'invalidFormat',
  0x03: 'missingConfirmation',
  0x04: 'invalidTarget',
  0x05: 'persistenceFailure',
  0x06: 'authenticationRejected',
};

export function parseBstStatus(value: DataView | Uint8Array): BstStatus {
  const bytes = value instanceof Uint8Array
    ? value
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (bytes.length !== 12) throw new Error(`Invalid BST status length: ${bytes.length}`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    version: bytes[0],
    phase: bytes[1],
    blockingMask: view.getUint16(2, true),
    autotestLog: bytes[4],
    autotestLastNum: bytes[5],
    cemState: bytes[6],
    blockedStarting: bytes[7],
    minUptimeExpired: bytes[8],
    result: bytes[9],
    availableTargets: view.getUint16(10, true),
  };
}

export function getAvailableBstTargets(mask: number): BstTarget[] {
  return BST_TARGETS.filter(target => (mask & (1 << target.id)) !== 0);
}

export function buildBstCommand(target: number): Uint8Array {
  if (!Number.isInteger(target) || target < 0 || target > 8) {
    throw new Error(`Invalid BST target: ${target}`);
  }
  return Uint8Array.of(BST_PROTOCOL_VERSION, target, BST_COMMAND_CONFIRMATION, 0x00);
}

const delay = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

async function authenticateBst(
  deviceId: string,
  osaKeyHex: string,
  devEuiHex: string,
  onLog: (line: string) => void,
): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await authenticateOsa(
        deviceId,
        osaKeyHex,
        devEuiHex,
        onLog,
        BST_OSA_GATT_PROFILE,
      );
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      onLog('[BST] Encrypted access is being established; retrying OSA');
      await delay(BST_OSA_RETRY_DELAY_MS);
    }
  }
}

type PendingResult = {
  resolve: (status: BstStatus) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export type BstSession = {
  initialStatus: BstStatus;
  execute(target: number, osaKeyHex: string, devEuiHex: string): Promise<BstStatus>;
  close(): Promise<void>;
};

export async function openBstSession(
  deviceId: string,
  onStatus: (status: BstStatus) => void,
  onLog: (line: string) => void = () => undefined,
): Promise<BstSession> {
  const services = await BleClient.getServices(deviceId);
  const serviceUuids = new Set(services.map(service => normalizeUuid(service.uuid)));
  if (!serviceUuids.has(BST_SERVICE_UUID)) throw new Error('BST service 8004 was not discovered');

  const [statusChar, commandChar] = await Promise.all([
    findCharacteristicByUuid(deviceId, BST_SERVICE_UUID, BST_STATUS_CHAR_UUID, onLog),
    findCharacteristicByUuid(deviceId, BST_SERVICE_UUID, BST_COMMAND_CHAR_UUID, onLog),
  ]);
  if (!statusChar?.props.read || !(statusChar.props.notify || statusChar.props.indicate)) {
    throw new Error('BST status C901 must support read and notifications');
  }
  if (!commandChar?.props.write) throw new Error('BST command C902 must support writes with response');

  let pending: PendingResult | undefined;
  let closed = false;
  const handleStatus = (raw: DataView) => {
    try {
      const status = parseBstStatus(raw);
      onLog(`[BST] Status ${toSpacedHex(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength))}`);
      onStatus(status);
      if (pending && status.result !== 0) {
        clearTimeout(pending.timeout);
        const resolve = pending.resolve;
        pending = undefined;
        resolve(status);
      }
    } catch (error: any) {
      onLog(`[BST] Invalid status: ${error?.message ?? error}`);
    }
  };

  await BleClient.startNotifications(
    deviceId,
    statusChar.service,
    statusChar.characteristic,
    handleStatus,
  );

  try {
    const initialRaw = await BleClient.read(deviceId, statusChar.service, statusChar.characteristic);
    const initialBytes = toUint8ArrayFromBleValue(initialRaw);
    if (!initialBytes) throw new Error('Unable to decode BST status');
    const initialStatus = parseBstStatus(initialBytes);
    onStatus(initialStatus);

    return {
      initialStatus,
      async execute(target: number, osaKeyHex: string, devEuiHex: string) {
        if (closed) throw new Error('BST session is closed');
        if (pending) throw new Error('A BST command is already pending');
        await authenticateBst(
          deviceId,
          osaKeyHex,
          devEuiHex,
          onLog,
        );

        let pendingResult: PendingResult;
        const result = new Promise<BstStatus>((resolve, reject) => {
          const timeout = setTimeout(() => {
            pending = undefined;
            reject(new Error('Timed out waiting for BST command result'));
          }, BST_COMMAND_TIMEOUT_MS);
          pendingResult = { resolve, reject, timeout };
          pending = pendingResult;
        });
        const command = buildBstCommand(target);
        onLog(`[BST] Command ${toSpacedHex(command)}`);
        try {
          await BleClient.write(
            deviceId,
            commandChar.service,
            commandChar.characteristic,
            new DataView(command.buffer, command.byteOffset, command.byteLength),
          );
        } catch (error) {
          clearTimeout(pendingResult!.timeout);
          pendingResult!.reject(error instanceof Error ? error : new Error(String(error)));
          if (pending === pendingResult!) pending = undefined;
          return result;
        }
        return result;
      },
      async close() {
        if (closed) return;
        closed = true;
        if (pending) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('BST session closed'));
          pending = undefined;
        }
        try {
          await BleClient.stopNotifications(
            deviceId,
            statusChar.service,
            statusChar.characteristic,
          );
        } catch {
          // The firmware normally closes the link after accepting a command.
        }
      },
    };
  } catch (error) {
    try {
      await BleClient.stopNotifications(deviceId, statusChar.service, statusChar.characteristic);
    } catch { /* connection may already be closed */ }
    throw error;
  }
}
