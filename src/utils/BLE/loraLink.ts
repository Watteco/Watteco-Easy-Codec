import { BleClient } from '@capacitor-community/bluetooth-le';
import {
  LORA_LINK_STATUS_CHAR_UUID,
  LORA_SERVICE_UUID,
  includesShortUuid,
  normalizeUuid,
} from '@/utils/BLE/characteristics';
import { toUint8ArrayFromBleValue } from '@/utils/BLE/blob';

export type LoraLinkSubscription = {
  service: string;
  characteristic: string;
};

export function decodeLoraWanJoined(value: unknown): boolean | null {
  const bytes = toUint8ArrayFromBleValue(value);
  if (!bytes || bytes.length < 7 || bytes[0] !== 1) return null;
  return bytes[6] !== 0;
}

export async function startLoraLinkMonitoring(
  deviceId: string,
  onJoinedChange: (joined: boolean) => void,
  onLog: (line: string) => void
): Promise<LoraLinkSubscription | undefined> {
  const services = await BleClient.getServices(deviceId);
  const service = services.find(candidate => (
    normalizeUuid(candidate.uuid) === LORA_SERVICE_UUID
    || includesShortUuid(candidate.uuid, '8002')
  ));
  if (!service) {
    onLog('[LORA] Service 8002 not found');
    return undefined;
  }

  const characteristic = service.characteristics?.find(candidate => (
    normalizeUuid(candidate.uuid) === LORA_LINK_STATUS_CHAR_UUID
  ));
  if (!characteristic) {
    onLog('[LORA] LinkStatus C001 not found');
    return undefined;
  }

  const processValue = (value: unknown) => {
    const joined = decodeLoraWanJoined(value);
    if (joined === null) {
      onLog('[LORA] Invalid or unsupported LinkStatus payload');
      return;
    }
    onJoinedChange(joined);
    onLog(`[LORA] ${joined ? 'Joined' : 'Not joined'}`);
  };

  let subscription: LoraLinkSubscription | undefined;
  if (!characteristic.properties.notify && !characteristic.properties.indicate) {
    onLog('[LORA] LinkStatus notifications unavailable');
  } else {
    try {
      await BleClient.startNotifications(deviceId, service.uuid, characteristic.uuid, processValue);
      subscription = { service: service.uuid, characteristic: characteristic.uuid };
    } catch (error: any) {
      onLog(`[LORA] LinkStatus notification failed: ${error?.message ?? error}`);
    }
  }

  if (characteristic.properties.read) {
    try {
      processValue(await BleClient.read(deviceId, service.uuid, characteristic.uuid));
    } catch (error: any) {
      onLog(`[LORA] LinkStatus read failed: ${error?.message ?? error}`);
    }
  }

  return subscription;
}

export async function stopLoraLinkMonitoring(
  deviceId: string,
  subscription?: LoraLinkSubscription,
  onLog?: (line: string) => void
): Promise<void> {
  if (!subscription) return;
  try {
    await BleClient.stopNotifications(deviceId, subscription.service, subscription.characteristic);
  } catch (error: any) {
    onLog?.(`[LORA] Stop notification failed: ${error?.message ?? error}`);
  }
}
