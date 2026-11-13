import { BleClient } from '@capacitor-community/bluetooth-le';
import {
  ADMIN_REBOOT_CHAR_UUID,
  OSA_ADMIN_SERVICE_UUID,
} from '@/utils/BLE/characteristics';
import { findCharacteristicByUuid } from '@/utils/BLE/connection';
import { toSpacedHex } from '@/utils/BLE/blob';

const LORA_REJOIN_PREFIX = new Uint8Array([0x11, 0x50, 0x80, 0x04, 0x00]);
export const FACTORY_RESET_FRAME = new Uint8Array([0x11, 0x50, 0x00, 0x50, 0x07]);

export function durationToMinutes(value: string): number | null {
  const match = /^(\d{1,4}):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= 0xffff ? minutes : null;
}

export function buildLoraRejoinFrame(duration: string): Uint8Array | null {
  const minutes = durationToMinutes(duration);
  if (minutes === null) return null;
  return Uint8Array.from([
    ...LORA_REJOIN_PREFIX,
    (minutes >>> 8) & 0xff,
    minutes & 0xff,
  ]);
}

export function isExpectedRestartDisconnect(error: unknown): boolean {
  const message = String((error as any)?.message ?? error ?? '');
  return /(?:status\s*=\s*133\b|\(\s*0x85\s*\))/i.test(message);
}

export async function rebootDevice(
  deviceId: string,
  onLog: (line: string) => void,
): Promise<void> {
  const characteristic = await findCharacteristicByUuid(
    deviceId,
    OSA_ADMIN_SERVICE_UUID,
    ADMIN_REBOOT_CHAR_UUID,
    onLog,
  );
  if (!characteristic) throw new Error('Reboot C005 is unavailable');

  const payload = Uint8Array.of(1);
  const value = new DataView(payload.buffer);
  try {
    if (characteristic.props.write) {
      await BleClient.write(deviceId, characteristic.service, characteristic.characteristic, value);
    } else if (characteristic.props.writeWithoutResponse) {
      await BleClient.writeWithoutResponse(deviceId, characteristic.service, characteristic.characteristic, value);
    } else {
      throw new Error('Reboot C005 is not writable');
    }
  } catch (error) {
    // Android reports GATT 133 when the sensor reboots before acknowledging
    // the write. For this command, that disconnect is the expected outcome.
    if (!isExpectedRestartDisconnect(error)) throw error;
    onLog('[ADMIN REBOOT] Sensor disconnected while acknowledging the command (GATT 133)');
  }
  onLog(`[ADMIN REBOOT] ${toSpacedHex(payload)}`);
}
