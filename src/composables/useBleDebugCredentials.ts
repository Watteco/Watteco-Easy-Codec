import { ref } from 'vue';
import { deriveDevEuiFromDeviceName } from '@/utils/BLE/deviceIdentity';

// Temporary common key shared by the normal BLE debug workflow and BBS tests.
const debugOtaAppKeyHex = ref('2B7E151628AED2A6ABF7158809CF4F3C');
const debugDevEuiHex = ref('');

export function useBleDebugCredentials() {
  return { debugOtaAppKeyHex, debugDevEuiHex };
}

export function updateDebugDevEuiFromDeviceName(deviceName?: string): boolean {
  const derivedDevEui = deriveDevEuiFromDeviceName(deviceName);
  if (!derivedDevEui) return false;
  debugDevEuiHex.value = derivedDevEui;
  return true;
}
