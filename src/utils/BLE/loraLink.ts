import { BleClient } from '@capacitor-community/bluetooth-le';
import {
  LORA_LINK_STATUS_CHAR_UUID,
  LORA_LINK_TEST_CHAR_UUID,
  LORA_SERVICE_UUID,
  includesShortUuid,
  normalizeUuid,
} from '@/utils/BLE/characteristics';
import { toUint8ArrayFromBleValue } from '@/utils/BLE/blob';

export type LoraLinkSubscription = {
  service: string;
  characteristic: string;
  notifications: boolean;
  testAvailable: boolean;
};

export type LoraLinkStatus = {
  version: number;
  flags: number;
  updatedAt: number;
  joined: boolean;
  joinedStatusAt: number | null;
  heartbeatMinSeconds: number | null;
  rx: {
    timestamp: number;
    sequence: number;
    source: number;
    rssiDbm: number;
    snrDb: number;
    frequencyHz: number;
    dataRate: number;
    window: number;
    payloadSize: number;
  } | null;
  applicationDownlink: { fport: number; payloadSize: number } | null;
  linkCheck: { timestamp: number; marginDb: number; gatewayCount: number } | null;
};

export type LoraLinkTestOptions = {
  linkCheck?: boolean;
  sendUplink?: boolean;
  confirmed?: boolean;
  fport?: number;
  payload?: Uint8Array;
};

const FLAG_JOIN_TIMESTAMP_VALID = 0x02;
const FLAG_HEARTBEAT_VALID = 0x04;
const FLAG_RX_METADATA_VALID = 0x08;
const FLAG_APPLICATION_DOWNLINK_VALID = 0x10;
const FLAG_LINK_CHECK_ANSWERED = 0x20;

function unixSecondsToMilliseconds(value: number): number {
  return value * 1000;
}

export function decodeLoraLinkStatus(value: unknown): LoraLinkStatus | null {
  const bytes = toUint8ArrayFromBleValue(value);
  if (!bytes || bytes.length < 43 || bytes[0] !== 1) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = view.getUint8(1);
  const rxValid = (flags & FLAG_RX_METADATA_VALID) !== 0;
  const appDownlinkValid = (flags & FLAG_APPLICATION_DOWNLINK_VALID) !== 0;
  const linkCheckValid = (flags & FLAG_LINK_CHECK_ANSWERED) !== 0;

  return {
    version: 1,
    flags,
    updatedAt: unixSecondsToMilliseconds(view.getUint32(2, true)),
    joined: view.getUint8(6) !== 0,
    joinedStatusAt: (flags & FLAG_JOIN_TIMESTAMP_VALID)
      ? unixSecondsToMilliseconds(view.getUint32(7, true))
      : null,
    heartbeatMinSeconds: (flags & FLAG_HEARTBEAT_VALID)
      ? view.getUint32(11, true)
      : null,
    rx: rxValid ? {
      timestamp: unixSecondsToMilliseconds(view.getUint32(15, true)),
      sequence: view.getUint32(19, true),
      source: view.getUint8(23),
      rssiDbm: view.getInt16(24, true),
      snrDb: view.getInt16(26, true) / 4,
      frequencyHz: view.getUint32(28, true),
      dataRate: view.getUint8(32),
      window: view.getUint8(33),
      payloadSize: view.getUint8(34),
    } : null,
    applicationDownlink: appDownlinkValid ? {
      fport: view.getUint8(35),
      payloadSize: view.getUint8(36),
    } : null,
    linkCheck: linkCheckValid ? {
      timestamp: unixSecondsToMilliseconds(view.getUint32(37, true)),
      marginDb: view.getUint8(41),
      gatewayCount: view.getUint8(42),
    } : null,
  };
}

export function decodeLoraWanJoined(value: unknown): boolean | null {
  const bytes = toUint8ArrayFromBleValue(value);
  if (!bytes || bytes.length < 7 || bytes[0] !== 1) return null;
  return bytes[6] !== 0;
}

export async function startLoraLinkMonitoring(
  deviceId: string,
  onStatusChange: (status: LoraLinkStatus) => void,
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
    const status = decodeLoraLinkStatus(value);
    if (!status) {
      onLog('[LORA] Invalid or unsupported LinkStatus payload');
      return;
    }
    onStatusChange(status);
    onLog(`[LORA] ${status.joined ? 'Joined' : 'Not joined'}`);
  };

  let notifications = false;
  if (!characteristic.properties.notify && !characteristic.properties.indicate) {
    onLog('[LORA] LinkStatus notifications unavailable');
  } else {
    try {
      await BleClient.startNotifications(deviceId, service.uuid, characteristic.uuid, processValue);
      notifications = true;
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

  const testCharacteristic = service.characteristics?.find(candidate => (
    normalizeUuid(candidate.uuid) === LORA_LINK_TEST_CHAR_UUID
  ));
  const testAvailable = Boolean(
    testCharacteristic?.properties.write || testCharacteristic?.properties.writeWithoutResponse
  );

  return {
    service: service.uuid,
    characteristic: characteristic.uuid,
    notifications,
    testAvailable,
  };
}

export async function stopLoraLinkMonitoring(
  deviceId: string,
  subscription?: LoraLinkSubscription,
  onLog?: (line: string) => void
): Promise<void> {
  if (!subscription?.notifications) return;
  try {
    await BleClient.stopNotifications(deviceId, subscription.service, subscription.characteristic);
  } catch (error: any) {
    onLog?.(`[LORA] Stop notification failed: ${error?.message ?? error}`);
  }
}

export async function readLoraLinkStatus(
  deviceId: string,
  subscription: LoraLinkSubscription | undefined,
  onLog: (line: string) => void
): Promise<LoraLinkStatus> {
  let target = subscription;
  if (!target) {
    const services = await BleClient.getServices(deviceId);
    const service = services.find(candidate => (
      normalizeUuid(candidate.uuid) === LORA_SERVICE_UUID
      || includesShortUuid(candidate.uuid, '8002')
    ));
    const characteristic = service?.characteristics?.find(candidate => (
      normalizeUuid(candidate.uuid) === LORA_LINK_STATUS_CHAR_UUID
    ));
    if (!service || !characteristic) throw new Error('LoRaWAN LinkStatus is unavailable');
    target = {
      service: service.uuid,
      characteristic: characteristic.uuid,
      notifications: false,
      testAvailable: false,
    };
  }

  const value = await BleClient.read(deviceId, target.service, target.characteristic);
  const status = decodeLoraLinkStatus(value);
  if (!status) throw new Error('Invalid or unsupported LoRaWAN LinkStatus payload');
  onLog('[LORA] LinkStatus refreshed');
  return status;
}

export async function sendLoraLinkTest(
  deviceId: string,
  options: LoraLinkTestOptions,
  onLog: (line: string) => void
): Promise<void> {
  const payload = options.payload ?? new Uint8Array();
  const fport = options.fport ?? 199;
  if (payload.length > 64) throw new Error('LoRaWAN diagnostic payload is limited to 64 bytes');
  if (!Number.isInteger(fport) || fport < 1 || fport > 223) {
    throw new Error('FPort must be between 1 and 223');
  }
  if (!options.linkCheck && !options.sendUplink) {
    throw new Error('No LoRaWAN diagnostic action selected');
  }

  const services = await BleClient.getServices(deviceId);
  const service = services.find(candidate => (
    normalizeUuid(candidate.uuid) === LORA_SERVICE_UUID
    || includesShortUuid(candidate.uuid, '8002')
  ));
  const characteristic = service?.characteristics?.find(candidate => (
    normalizeUuid(candidate.uuid) === LORA_LINK_TEST_CHAR_UUID
  ));
  if (!service || !characteristic) throw new Error('LoRaWAN LinkTest is unavailable');

  let flags = 0;
  if (options.linkCheck) flags |= 0x01;
  if (options.sendUplink) flags |= 0x02;
  if (options.confirmed && options.sendUplink) flags |= 0x04;
  const command = new Uint8Array([0x01, flags, fport, payload.length, ...payload]);
  const data = new DataView(command.buffer);

  if (characteristic.properties.writeWithoutResponse) {
    await BleClient.writeWithoutResponse(deviceId, service.uuid, characteristic.uuid, data);
  } else if (characteristic.properties.write) {
    await BleClient.write(deviceId, service.uuid, characteristic.uuid, data);
  } else {
    throw new Error('LoRaWAN LinkTest is not writable');
  }
  onLog(`[LORA] LinkTest sent (flags=0x${flags.toString(16).padStart(2, '0')}, fport=${fport}, payload=${payload.length})`);
}
