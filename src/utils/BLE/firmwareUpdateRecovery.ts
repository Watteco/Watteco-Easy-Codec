import type { DeviceLike } from '@/composables/useBle';
import { deriveDevEuiFromDeviceName } from '@/utils/BLE/deviceIdentity';
import { deriveApplicationNameFromOtaLoader } from '@/utils/BLE/firmwareUpdateProtocol';

export const FIRMWARE_UPDATE_RECOVERY_KEY = 'easycodec.firmwareUpdateRecoveryDevice';

export type FirmwareRecoveryDevice = {
  deviceId: string;
  name: string;
  devEuiHex: string;
  loaderDeviceId?: string;
  loaderName?: string;
};

export function loadFirmwareRecoveryDevice(): FirmwareRecoveryDevice | null {
  try {
    const raw = localStorage.getItem(FIRMWARE_UPDATE_RECOVERY_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      typeof value?.deviceId !== 'string'
      || typeof value?.name !== 'string'
      || typeof value?.devEuiHex !== 'string'
    ) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveFirmwareRecoveryDevice(device: FirmwareRecoveryDevice): void {
  localStorage.setItem(FIRMWARE_UPDATE_RECOVERY_KEY, JSON.stringify(device));
}

export function clearFirmwareRecoveryDevice(): void {
  localStorage.removeItem(FIRMWARE_UPDATE_RECOVERY_KEY);
}

export function recoveryDeviceFromOtaLoader(device: DeviceLike): FirmwareRecoveryDevice | null {
  const loaderName = device.name?.trim();
  const applicationName = deriveApplicationNameFromOtaLoader(loaderName);
  const devEuiHex = deriveDevEuiFromDeviceName(loaderName);
  if (!loaderName || !applicationName || !devEuiHex) return null;
  return {
    deviceId: device.deviceId,
    name: applicationName,
    devEuiHex,
    loaderDeviceId: device.deviceId,
    loaderName,
  };
}
