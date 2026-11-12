import { BleClient, BluetoothLe } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import {
  BBS_COMMAND_CHAR_UUID,
  BBS_OSA_CHALLENGE_CHAR_UUID,
  BBS_OSA_RESPONSE_CHAR_UUID,
  BBS_OSA_STATUS_CHAR_UUID,
  BBS_SERVICE_UUID,
  BBS_STATUS_CHAR_UUID,
  normalizeUuid,
} from '@/utils/BLE/characteristics';
import { findCharacteristicByUuid } from '@/utils/BLE/connection';
import { authenticateOsa, type OsaGattProfile } from '@/utils/BLE/osa';
import { toSpacedHex, toUint8ArrayFromBleValue } from '@/utils/BLE/blob';

export const BBS_PROTOCOL_VERSION = 0x01;
export const BBS_COMMAND_CONFIRMATION = 0xa5;
export const BBS_COMMAND_RESULT_WINDOW_MS = 5_000;
export const BBS_KEEP_ALIVE_INTERVAL_MS = 20_000;
export const BBS_FLAG_FACTORY_RESET = 0x01;
export const BBS_FLAG_START_BLOCKED = 0x02;
export const BBS_PHASE_ACCEPTED = 0x05;
export const BBS_AUTH_AUTOTEST_STATE = 0x01;
export const BBS_AUTH_RADIO_TESTS = 0x02;
export const BBS_AUTH_STARTUP_STATE = 0x04;
export const BBS_AUTH_RETURN_TO_SERVICE = 0x08;
const BBS_OSA_RETRY_DELAY_MS = 750;
const BBS_BOND_TIMEOUT_MS = 15_000;
const BBS_RESULT_POLL_INTERVAL_MS = 150;

type BluetoothLeWithBondRemoval = typeof BluetoothLe & {
  removeBond(options: { deviceId: string; timeout?: number }): Promise<void>;
};

const bluetoothLeWithBondRemoval = BluetoothLe as BluetoothLeWithBondRemoval;
const bbsBondCleanupOperations = new Map<string, Promise<void>>();

export function removeBbsAndroidBond(
  deviceId: string,
  onLog: (line: string) => void = () => undefined,
  reason = 'BBS cleanup',
): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return Promise.resolve();
  }

  const previous = bbsBondCleanupOperations.get(deviceId) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(async () => {
    if (!await BleClient.isBonded(deviceId)) {
      onLog(`[BBS] No Android bond to remove (${reason})`);
      return;
    }

    onLog(`[BBS] Removing Android bond (${reason})`);
    await bluetoothLeWithBondRemoval.removeBond({
      deviceId,
      timeout: BBS_BOND_TIMEOUT_MS,
    });
    if (await BleClient.isBonded(deviceId)) {
      throw new Error(`Android retained the BBS bond after ${reason}`);
    }
    onLog(`[BBS] Android bond removed (${reason})`);
  });

  bbsBondCleanupOperations.set(deviceId, operation);
  return operation.finally(() => {
    if (bbsBondCleanupOperations.get(deviceId) === operation) {
      bbsBondCleanupOperations.delete(deviceId);
    }
  });
}

export const BBS_OSA_GATT_PROFILE: OsaGattProfile = {
  serviceUuid: BBS_SERVICE_UUID,
  challengeUuid: BBS_OSA_CHALLENGE_CHAR_UUID,
  responseUuid: BBS_OSA_RESPONSE_CHAR_UUID,
  statusUuid: BBS_OSA_STATUS_CHAR_UUID,
  checkExistingSession: false,
};

export const BBS_TARGETS = [
  { id: 0x00, key: 'normal', authorization: BBS_AUTH_AUTOTEST_STATE },
  { id: 0x01, key: 'autotest', authorization: BBS_AUTH_AUTOTEST_STATE },
  { id: 0x02, key: 'finalAutotest', authorization: BBS_AUTH_AUTOTEST_STATE },
  { id: 0x03, key: 'cemOnce', authorization: BBS_AUTH_RADIO_TESTS },
  { id: 0x04, key: 'cemPermanent', authorization: BBS_AUTH_RADIO_TESTS },
  { id: 0x05, key: 'continuousFsk', authorization: BBS_AUTH_RADIO_TESTS },
  { id: 0x06, key: 'continuousLora', authorization: BBS_AUTH_RADIO_TESTS },
  { id: 0x07, key: 'burstLora', authorization: BBS_AUTH_RADIO_TESTS },
  { id: 0x0a, key: 'stopCem', authorization: BBS_AUTH_RADIO_TESTS },
  { id: 0x0b, key: 'returnToService', authorization: BBS_AUTH_RETURN_TO_SERVICE },
] as const;

export type BbsTarget = typeof BBS_TARGETS[number];

export type BbsStatus = {
  version: number;
  phase: number;
  blockingMask: number;
  autotestLog: number;
  autotestLastNum: number;
  cemState: number;
  blockedStarting: number;
  minUptimeExpired: number;
  result: number;
  supportedTargets: number;
  authorizationMask: number;
};

export const BBS_RESULT_KEYS: Record<number, string> = {
  0x00: 'none',
  0x01: 'accepted',
  0x02: 'invalidFormat',
  0x03: 'missingConfirmation',
  0x04: 'invalidTarget',
  0x05: 'persistenceFailure',
  0x06: 'authenticationRejected',
  0x07: 'authorizationRejected',
};

export function parseBbsStatus(value: DataView | Uint8Array): BbsStatus {
  const bytes = value instanceof Uint8Array
    ? value
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (bytes.length !== 13) throw new Error(`Invalid BBS status length: ${bytes.length}`);
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
    supportedTargets: view.getUint16(10, true),
    authorizationMask: bytes[12],
  };
}

export function getSupportedBbsTargets(mask: number): BbsTarget[] {
  return BBS_TARGETS.filter(target => (mask & (1 << target.id)) !== 0);
}

export function isBbsTargetAuthorized(target: BbsTarget, authorizationMask: number): boolean {
  return (authorizationMask & target.authorization) !== 0;
}

export function buildBbsCommand(target: number, flags = 0): Uint8Array {
  if (!Number.isInteger(target) || !BBS_TARGETS.some(candidate => candidate.id === target)) {
    throw new Error(`Invalid BBS target: ${target}`);
  }
  if (!Number.isInteger(flags) || flags < 0 || flags > 0xff) {
    throw new Error(`Invalid BBS flags: ${flags}`);
  }
  const returnToServiceFlags = BBS_FLAG_FACTORY_RESET | BBS_FLAG_START_BLOCKED;
  if (flags !== 0 && (target !== 0x0b || (flags & ~returnToServiceFlags) !== 0)) {
    throw new Error(`Invalid BBS flags 0x${flags.toString(16)} for target 0x${target.toString(16)}`);
  }
  return Uint8Array.of(BBS_PROTOCOL_VERSION, target, BBS_COMMAND_CONFIRMATION, flags);
}

const delay = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

async function establishBbsEncryptedLink(
  deviceId: string,
  onLog: (line: string) => void,
): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    onLog('[BBS] Explicit bonding unavailable on this platform; encrypted access will trigger pairing');
    return;
  }

  await removeBbsAndroidBond(deviceId, onLog, 'before BBS pairing');

  onLog('[BBS] Starting Android pairing before protected GATT operations');
  await BleClient.createBond(deviceId, { timeout: BBS_BOND_TIMEOUT_MS });
  const bonded = await BleClient.isBonded(deviceId);
  if (!bonded) throw new Error('Android pairing completed without a bonded state');
  onLog('[BBS] Android pairing complete; encrypted link confirmed');
}

async function authenticateBbs(
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
        BBS_OSA_GATT_PROFILE,
      );
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      onLog('[BBS] Encrypted access is being established; retrying OSA');
      await delay(BBS_OSA_RETRY_DELAY_MS);
    }
  }
}

export type BbsSession = {
  initialStatus: BbsStatus;
  authenticate(osaKeyHex: string, devEuiHex: string): Promise<BbsStatus>;
  execute(
    target: number,
    flags: number,
    osaKeyHex: string,
    devEuiHex: string,
  ): Promise<BbsStatus>;
  close(): Promise<void>;
};

export async function openBbsSession(
  deviceId: string,
  onStatus: (status: BbsStatus) => void,
  onLog: (line: string) => void = () => undefined,
): Promise<BbsSession> {
  const services = await BleClient.getServices(deviceId);
  const serviceUuids = new Set(services.map(service => normalizeUuid(service.uuid)));
  if (!serviceUuids.has(BBS_SERVICE_UUID)) throw new Error('BBS service 8004 was not discovered');

  const [statusChar, commandChar] = await Promise.all([
    findCharacteristicByUuid(deviceId, BBS_SERVICE_UUID, BBS_STATUS_CHAR_UUID, onLog),
    findCharacteristicByUuid(deviceId, BBS_SERVICE_UUID, BBS_COMMAND_CHAR_UUID, onLog),
  ]);
  if (!statusChar?.props.read || !(statusChar.props.notify || statusChar.props.indicate)) {
    throw new Error('BBS status C901 must support read and notifications');
  }
  if (!commandChar?.props.write) throw new Error('BBS command C902 must support writes with response');

  let closed = false;
  let authenticated = false;
  let commandFinalizing = false;
  let keepAliveTimer: ReturnType<typeof setTimeout> | undefined;
  let latestStatus: BbsStatus;

  const publishStatus = (raw: DataView | Uint8Array, source: string): BbsStatus => {
    const bytes = raw instanceof Uint8Array
      ? raw
      : new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    const nextStatus = parseBbsStatus(bytes);
    latestStatus = nextStatus;
    onLog(`[BBS] ${source} ${toSpacedHex(bytes)}`);
    onStatus(nextStatus);
    return nextStatus;
  };

  const handleStatus = (raw: DataView) => {
    try {
      publishStatus(raw, 'Status notification');
    } catch (error: any) {
      onLog(`[BBS] Invalid status: ${error?.message ?? error}`);
    }
  };

  const readStatus = async (source: string): Promise<BbsStatus> => {
    if (closed) throw new Error('BBS session is closed');
    const raw = await BleClient.read(deviceId, statusChar.service, statusChar.characteristic);
    const bytes = toUint8ArrayFromBleValue(raw);
    if (!bytes) throw new Error('Unable to decode BBS status');
    return publishStatus(bytes, source);
  };

  const stopKeepAlive = () => {
    if (keepAliveTimer) clearTimeout(keepAliveTimer);
    keepAliveTimer = undefined;
  };

  const isPageVisible = () => (
    typeof document === 'undefined' || document.visibilityState === 'visible'
  );

  const scheduleKeepAlive = () => {
    stopKeepAlive();
    if (closed || !authenticated || commandFinalizing || !isPageVisible()) return;
    keepAliveTimer = setTimeout(async () => {
      keepAliveTimer = undefined;
      if (closed || !authenticated || commandFinalizing) return;
      try {
        await readStatus('Keep-alive status');
      } catch (error: any) {
        onLog(`[BBS] Keep-alive failed: ${error?.message ?? error}`);
      } finally {
        scheduleKeepAlive();
      }
    }, BBS_KEEP_ALIVE_INTERVAL_MS);
  };

  const handleVisibilityChange = () => {
    if (isPageVisible()) scheduleKeepAlive();
    else stopKeepAlive();
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  await BleClient.startNotifications(
    deviceId,
    statusChar.service,
    statusChar.characteristic,
    handleStatus,
  );

  try {
    const initialStatus = await readStatus('Initial status');
    await establishBbsEncryptedLink(deviceId, onLog);

    return {
      initialStatus,
      async authenticate(osaKeyHex: string, devEuiHex: string) {
        if (closed) throw new Error('BBS session is closed');
        if (!authenticated) {
          await authenticateBbs(deviceId, osaKeyHex, devEuiHex, onLog);
          authenticated = true;
        }
        const authenticatedStatus = await readStatus('Authenticated status');
        scheduleKeepAlive();
        return authenticatedStatus;
      },
      async execute(target: number, flags: number, osaKeyHex: string, devEuiHex: string) {
        if (closed) throw new Error('BBS session is closed');
        if (commandFinalizing) throw new Error('A BBS command is already pending');
        if (!authenticated) {
          await authenticateBbs(deviceId, osaKeyHex, devEuiHex, onLog);
          authenticated = true;
          await readStatus('Authenticated status');
        }

        const targetDefinition = BBS_TARGETS.find(candidate => candidate.id === target);
        if (!targetDefinition || (latestStatus.supportedTargets & (1 << target)) === 0) {
          throw new Error(`BBS target 0x${target.toString(16)} is not supported`);
        }
        if (!isBbsTargetAuthorized(targetDefinition, latestStatus.authorizationMask)) {
          throw new Error(`BBS target 0x${target.toString(16)} is not authorized`);
        }

        commandFinalizing = true;
        stopKeepAlive();
        const command = buildBbsCommand(target, flags);
        onLog(`[BBS] Command ${toSpacedHex(command)}`);
        try {
          await BleClient.write(
            deviceId,
            commandChar.service,
            commandChar.characteristic,
            new DataView(command.buffer, command.byteOffset, command.byteLength),
          );
        } catch (error) {
          commandFinalizing = false;
          scheduleKeepAlive();
          throw error;
        }

        const deadline = Date.now() + BBS_COMMAND_RESULT_WINDOW_MS;
        let lastReadError: unknown;
        while (!closed && Date.now() < deadline) {
          try {
            const finalStatus = await readStatus('Final status');
            if (finalStatus.phase === BBS_PHASE_ACCEPTED && finalStatus.result !== 0) {
              return finalStatus;
            }
          } catch (error) {
            lastReadError = error;
          }
          await delay(Math.min(BBS_RESULT_POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
        }
        const detail = lastReadError instanceof Error ? `: ${lastReadError.message}` : '';
        throw new Error(`Timed out reading the final BBS command result${detail}`);
      },
      async close() {
        if (closed) return;
        closed = true;
        stopKeepAlive();
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    try {
      await BleClient.stopNotifications(deviceId, statusChar.service, statusChar.characteristic);
    } catch { /* connection may already be closed */ }
    throw error;
  }
}
