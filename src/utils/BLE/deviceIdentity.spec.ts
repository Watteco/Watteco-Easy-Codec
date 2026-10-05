import { describe, expect, it } from 'vitest';
import { deriveDevEuiFromDeviceName } from '@/utils/BLE/deviceIdentity';

describe('Watteco BLE device identity', () => {
  it('reconstructs the DevEUI from a WS identifier', () => {
    expect(deriveDevEuiFromDeviceName('WS006763')).toBe('70B3D5E75F006763');
  });

  it('accepts WTC identifiers and normalizes their case', () => {
    expect(deriveDevEuiFromDeviceName('wtc00a1bf')).toBe('70B3D5E75F00A1BF');
  });

  it('does not infer a DevEUI from an unrecognized or incomplete name', () => {
    expect(deriveDevEuiFromDeviceName('Sensor 006763')).toBeNull();
    expect(deriveDevEuiFromDeviceName('WS6763')).toBeNull();
    expect(deriveDevEuiFromDeviceName()).toBeNull();
  });
});
