import { BleClient } from '@capacitor-community/bluetooth-le';
import {
  CABLE_REPLACEMENT_RX_SHORT,
  CABLE_REPLACEMENT_SERVICE_SHORT,
  CABLE_REPLACEMENT_TX_SHORT,
  includesShortUuid,
  normalizeUuid,
} from '@/utils/BLE/characteristics';

export type BleCharacteristicMatch = {
  service: string;
  characteristic: string;
  props: Record<string, any>;
};

export type BleSubscriptionTarget = {
  service: string;
  characteristic: string;
};

function valueToHex(value: any): string {
  try {
    let bytes: Uint8Array | null = null;
    if (value instanceof DataView) {
      bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    } else if (value instanceof ArrayBuffer) {
      bytes = new Uint8Array(value);
    } else if (value instanceof Uint8Array) {
      bytes = value;
    } else if (value?.value instanceof DataView) {
      bytes = new Uint8Array(value.value.buffer, value.value.byteOffset, value.value.byteLength);
    } else if (value?.value instanceof ArrayBuffer) {
      bytes = new Uint8Array(value.value);
    }

    if (!bytes) return JSON.stringify(value);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
  } catch {
    return String(value);
  }
}

export async function findCharacteristic(
  deviceId: string,
  targetCharShort: string,
  targetServiceShort = CABLE_REPLACEMENT_SERVICE_SHORT,
  onLog?: (line: string) => void
): Promise<BleCharacteristicMatch | null> {
  try {
    const services: any[] = await BleClient.getServices(deviceId);
    for (const service of services) {
      const serviceUuid = (service.uuid || '').toLowerCase();
      if (!includesShortUuid(serviceUuid, targetServiceShort)) continue;
      if (!service.characteristics) continue;

      for (const characteristic of service.characteristics) {
        const characteristicUuid = (characteristic.uuid || '').toLowerCase();
        if (!includesShortUuid(characteristicUuid, targetCharShort)) continue;

        return {
          service: normalizeUuid(service.uuid || serviceUuid),
          characteristic: normalizeUuid(characteristic.uuid || characteristicUuid),
          props: characteristic.properties || {},
        };
      }
    }
  } catch (error: any) {
    onLog?.(`findCharacteristic failed: ${error?.message ?? error}`);
  }

  return null;
}

export async function findCharacteristicByUuid(
  deviceId: string,
  serviceUuid: string,
  characteristicUuid: string,
  onLog?: (line: string) => void
): Promise<BleCharacteristicMatch | null> {
  try {
    const services: any[] = await BleClient.getServices(deviceId);
    const wantedService = serviceUuid.toLowerCase();
    const wantedCharacteristic = characteristicUuid.toLowerCase();

    for (const service of services) {
      const discoveredServiceUuid = (service.uuid || '').toLowerCase();
      if (discoveredServiceUuid !== wantedService) continue;
      if (!service.characteristics) continue;

      for (const characteristic of service.characteristics) {
        const discoveredCharacteristicUuid = (characteristic.uuid || '').toLowerCase();
        if (discoveredCharacteristicUuid !== wantedCharacteristic) continue;

        return {
          service: discoveredServiceUuid,
          characteristic: discoveredCharacteristicUuid,
          props: characteristic.properties || {},
        };
      }
    }
  } catch (error: any) {
    onLog?.(`findCharacteristicByUuid failed: ${error?.message ?? error}`);
  }

  return null;
}

export async function startDebugSubscriptions(
  deviceId: string,
  onLog: (line: string) => void
): Promise<BleSubscriptionTarget[]> {
  const subscriptions: BleSubscriptionTarget[] = [];

  const services: any[] = await BleClient.getServices(deviceId);
  for (const service of services) {
    const serviceUuid = (service.uuid || '').toLowerCase();
    if (!includesShortUuid(serviceUuid, CABLE_REPLACEMENT_SERVICE_SHORT)) continue;
    if (!service.characteristics) continue;

    for (const characteristic of service.characteristics) {
      const characteristicUuid = (characteristic.uuid || '').toLowerCase();
      const isTarget = includesShortUuid(characteristicUuid, CABLE_REPLACEMENT_RX_SHORT)
        || includesShortUuid(characteristicUuid, CABLE_REPLACEMENT_TX_SHORT);
      if (!isTarget) continue;

      const props = characteristic.properties || {};
      const serviceId = normalizeUuid(service.uuid || serviceUuid);
      const characteristicId = normalizeUuid(characteristic.uuid || characteristicUuid);
      onLog(`Found ${serviceId} / ${characteristicId} props:${Object.keys(props).filter((key) => props[key]).join(',')}`);

      try {
        if (props.notify || props.indicate) {
          await BleClient.startNotifications(deviceId, serviceId, characteristicId, (value: any) => {
            const hex = valueToHex(value);
            const ts = new Date().toLocaleTimeString();
            onLog(`${ts} [NOTIF ${serviceId.slice(0, 8)}:${characteristicId.slice(0, 8)}] ${hex}`);
          });

          subscriptions.push({ service: serviceId, characteristic: characteristicId });

          try {
            const read = await BleClient.read(deviceId, serviceId, characteristicId);
            const hex = valueToHex(read);
            const ts = new Date().toLocaleTimeString();
            onLog(`${ts} [READ ${serviceId.slice(0, 8)}:${characteristicId.slice(0, 8)}] ${hex}`);
          } catch {
            // keep subscription even if first read fails
          }
        } else {
          try {
            const read = await BleClient.read(deviceId, serviceId, characteristicId);
            const hex = valueToHex(read);
            const ts = new Date().toLocaleTimeString();
            onLog(`${ts} [READ ${serviceId.slice(0, 8)}:${characteristicId.slice(0, 8)}] ${hex}`);
          } catch (error: any) {
            onLog(`Read failed ${serviceId} ${characteristicId} -> ${error?.message ?? error}`);
          }
        }
      } catch (error: any) {
        onLog(`Subscribe/read failed ${serviceId} ${characteristicId} -> ${error?.message ?? error}`);
      }
    }
  }

  return subscriptions;
}

export async function stopDebugSubscriptions(
  deviceId: string,
  subscriptions: BleSubscriptionTarget[],
  onLog?: (line: string) => void
): Promise<void> {
  for (const subscription of subscriptions) {
    try {
      await BleClient.stopNotifications(deviceId, subscription.service, subscription.characteristic);
    } catch (error: any) {
      onLog?.(`stopNotifications failed ${subscription.service} ${subscription.characteristic}: ${error?.message ?? error}`);
    }
  }
}

export async function dumpServices(deviceId: string, onLog: (line: string) => void): Promise<void> {
  const services: any[] = await BleClient.getServices(deviceId);
  onLog(`--- Services dump (${new Date().toLocaleTimeString()}) ---`);

  for (const service of services) {
    onLog(`Service ${service.uuid}`);
    if (!service.characteristics) continue;

    for (const characteristic of service.characteristics) {
      const props = characteristic.properties || {};
      onLog(`  Char ${characteristic.uuid} props:${Object.keys(props).filter((key) => props[key]).join(',')}`);
    }
  }
}

export async function dumpServicesOnly(deviceId: string, onLog: (line: string) => void): Promise<void> {
  const services: any[] = await BleClient.getServices(deviceId);
  onLog(`--- Services only (${new Date().toLocaleTimeString()}) ---`);

  for (const service of services) {
    onLog(`Service ${service.uuid}`);
  }
}
