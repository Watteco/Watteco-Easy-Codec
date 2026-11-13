import { BleClient } from '@capacitor-community/bluetooth-le';
import {
  ADMIN_APP_RX_CHAR_UUID,
  ADMIN_APP_TX_CHAR_UUID,
  OSA_ADMIN_SERVICE_UUID,
} from '@/utils/BLE/characteristics';
import { findCharacteristicByUuid } from '@/utils/BLE/connection';
import { toSpacedHex, toUint8ArrayFromBleValue } from '@/utils/BLE/blob';

export type AppRxSubscription = {
  deviceId: string;
  service: string;
  characteristic: string;
  notifications: boolean;
};

export type ConfigurationFrame = {
  hex: string;
  label: string;
};

export type ConfigurationFrameOutcome =
  | 'success'
  | 'no-response-expected'
  | 'device-error'
  | 'timeout'
  | 'transport-error';

export type ConfigurationFrameResult = {
  index: number;
  total: number;
  frame: ConfigurationFrame;
  outcome: ConfigurationFrameOutcome;
  responseHex?: string;
  status?: number;
  errorAttributeId?: number;
  errorMessage?: string;
};

export type CurrentConfigurationSendResult = {
  state: 'success' | 'partial' | 'failed' | 'authorization-denied' | 'not-started';
  total: number;
  processed: number;
  frames: ConfigurationFrameResult[];
  errorMessage?: string;
};

type AppTxWriteOptions = {
  expectedWriteError?: (error: unknown) => boolean;
};

let appRxQueue = Promise.resolve();
const releaseAppRxBySubscription = new WeakMap<AppRxSubscription, () => void>();
const stopAppRxBySubscription = new WeakMap<AppRxSubscription, Promise<void>>();

export function parseAppFrameHex(value: string): Uint8Array | null {
  const compact = value.replace(/[\s:-]/g, '');
  if (!compact || !/^(?:[0-9a-fA-F]{2})+$/.test(compact)) return null;
  return Uint8Array.from(compact.match(/.{2}/g) ?? [], byte => Number.parseInt(byte, 16));
}

export function takeFirstConfigurationFrames(frames: readonly string[]): string[] {
  const separatorIndex = frames.findIndex(frame => frame.replace(/\s+/g, '') === '00');
  return frames.slice(0, separatorIndex < 0 ? frames.length : separatorIndex);
}

export function readOutputFrameHexes(outputArea: Element): string[] {
  return readOutputConfigurationFrames(outputArea).map(frame => frame.hex);
}

export function readOutputConfigurationFrames(outputArea: Element): ConfigurationFrame[] {
  return Array.from(outputArea.children)
    .filter(child => child.tagName === 'SPAN')
    .map(child => ({
      hex: (child.textContent ?? '').replace(/\s+/g, ''),
      label: child.getAttribute('title')?.trim() ?? '',
    }))
    .filter(frame => /^(?:[0-9a-fA-F]{2})+$/.test(frame.hex));
}

export function takeFirstConfigurationFrameEntries(
  frames: readonly ConfigurationFrame[],
): ConfigurationFrame[] {
  const separatorIndex = frames.findIndex(frame => frame.hex.replace(/\s+/g, '') === '00');
  return frames.slice(0, separatorIndex < 0 ? frames.length : separatorIndex);
}

export async function startAppRxMonitoring(
  deviceId: string,
  onFrame: (frame: Uint8Array) => void,
  onLog: (line: string) => void,
): Promise<AppRxSubscription> {
  let releaseAppRx!: () => void;
  const appRxReleased = new Promise<void>(resolve => { releaseAppRx = resolve; });
  const previousAppRxReleased = appRxQueue;
  appRxQueue = appRxReleased;
  await previousAppRxReleased;

  try {
    const characteristic = await findCharacteristicByUuid(
      deviceId,
      OSA_ADMIN_SERVICE_UUID,
      ADMIN_APP_RX_CHAR_UUID,
      onLog,
    );
    if (!characteristic) throw new Error('AppRx C007 is unavailable');

    const processValue = (value: unknown) => {
      const frame = toUint8ArrayFromBleValue(value);
      if (!frame) return;
      const copy = new Uint8Array(frame);
      onFrame(copy);
      onLog(`[APP RX] ${toSpacedHex(copy)}`);
    };

    let notifications = false;
    if (characteristic.props.notify || characteristic.props.indicate) {
      try {
        await BleClient.startNotifications(
          deviceId,
          characteristic.service,
          characteristic.characteristic,
          processValue,
        );
        notifications = true;
      } catch (error: any) {
        onLog(`[APP RX] Notification failed: ${error?.message ?? error}`);
      }
    }

    if (!notifications && !characteristic.props.read) {
      throw new Error('AppRx C007 is neither readable nor notifiable');
    }

    const subscription = {
      deviceId,
      service: characteristic.service,
      characteristic: characteristic.characteristic,
      notifications,
    };
    releaseAppRxBySubscription.set(subscription, releaseAppRx);
    return subscription;
  } catch (error) {
    releaseAppRx();
    throw error;
  }
}

export async function readAppRx(
  deviceId: string,
  subscription: AppRxSubscription,
): Promise<Uint8Array> {
  const value = await BleClient.read(
    deviceId,
    subscription.service,
    subscription.characteristic,
  );
  const frame = toUint8ArrayFromBleValue(value);
  if (!frame) throw new Error('AppRx returned an unreadable value');
  return new Uint8Array(frame);
}

export async function stopAppRxMonitoring(
  subscription: AppRxSubscription | undefined,
  onLog?: (line: string) => void,
): Promise<void> {
  if (!subscription) return;
  const pendingStop = stopAppRxBySubscription.get(subscription);
  if (pendingStop) return pendingStop;

  const releaseAppRx = releaseAppRxBySubscription.get(subscription);
  if (!releaseAppRx) return;

  const stopPromise = Promise.resolve().then(async () => {
    try {
      if (subscription.notifications) {
        await BleClient.stopNotifications(
          subscription.deviceId,
          subscription.service,
          subscription.characteristic,
        );
      }
    } catch (error: any) {
      onLog?.(`[APP RX] Stop notification failed: ${error?.message ?? error}`);
    } finally {
      releaseAppRxBySubscription.delete(subscription);
      stopAppRxBySubscription.delete(subscription);
      releaseAppRx();
    }
  });
  stopAppRxBySubscription.set(subscription, stopPromise);
  return stopPromise;
}

export async function writeAppTx(
  deviceId: string,
  frame: Uint8Array,
  onLog: (line: string) => void,
  options: AppTxWriteOptions = {},
): Promise<void> {
  const characteristic = await findCharacteristicByUuid(
    deviceId,
    OSA_ADMIN_SERVICE_UUID,
    ADMIN_APP_TX_CHAR_UUID,
    onLog,
  );
  if (!characteristic) throw new Error('AppTx C006 is unavailable');

  const value = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  try {
    if (characteristic.props.write) {
      await BleClient.write(deviceId, characteristic.service, characteristic.characteristic, value);
    } else if (characteristic.props.writeWithoutResponse) {
      await BleClient.writeWithoutResponse(deviceId, characteristic.service, characteristic.characteristic, value);
    } else {
      throw new Error('AppTx C006 is not writable');
    }
  } catch (error) {
    if (!options.expectedWriteError?.(error)) throw error;
    onLog(`[APP TX] Sensor disconnected while acknowledging the command: ${String((error as any)?.message ?? error)}`);
  }
  onLog(`[APP TX] ${toSpacedHex(frame)}`);
}
