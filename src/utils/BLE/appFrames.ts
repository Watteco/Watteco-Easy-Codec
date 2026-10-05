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

export function parseAppFrameHex(value: string): Uint8Array | null {
  const compact = value.replace(/[\s:-]/g, '');
  if (!compact || !/^(?:[0-9a-fA-F]{2})+$/.test(compact)) return null;
  return Uint8Array.from(compact.match(/.{2}/g) ?? [], byte => Number.parseInt(byte, 16));
}

export async function startAppRxMonitoring(
  deviceId: string,
  onFrame: (frame: Uint8Array) => void,
  onLog: (line: string) => void,
): Promise<AppRxSubscription> {
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

  return {
    deviceId,
    service: characteristic.service,
    characteristic: characteristic.characteristic,
    notifications,
  };
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
  if (!subscription?.notifications) return;
  try {
    await BleClient.stopNotifications(
      subscription.deviceId,
      subscription.service,
      subscription.characteristic,
    );
  } catch (error: any) {
    onLog?.(`[APP RX] Stop notification failed: ${error?.message ?? error}`);
  }
}

export async function writeAppTx(
  deviceId: string,
  frame: Uint8Array,
  onLog: (line: string) => void,
): Promise<void> {
  const characteristic = await findCharacteristicByUuid(
    deviceId,
    OSA_ADMIN_SERVICE_UUID,
    ADMIN_APP_TX_CHAR_UUID,
    onLog,
  );
  if (!characteristic) throw new Error('AppTx C006 is unavailable');

  const value = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  if (characteristic.props.write) {
    await BleClient.write(deviceId, characteristic.service, characteristic.characteristic, value);
  } else if (characteristic.props.writeWithoutResponse) {
    await BleClient.writeWithoutResponse(deviceId, characteristic.service, characteristic.characteristic, value);
  } else {
    throw new Error('AppTx C006 is not writable');
  }
  onLog(`[APP TX] ${toSpacedHex(frame)}`);
}
