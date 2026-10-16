import { describe, expect, it } from 'vitest';
import {
  deriveDevEuiFromDeviceName,
  formatDevEui,
  isBleSensorName,
} from '@/utils/BLE/deviceIdentity';

describe('Watteco BLE device identity', () => {
  it('reconstructs the DevEUI from a WS identifier', () => {
    expect(deriveDevEuiFromDeviceName('WS006763')).toBe('70B3D5E75F006763');
  });

  it('accepts WTC identifiers and normalizes their case', () => {
    expect(deriveDevEuiFromDeviceName('wtc00a1bf')).toBe('70B3D5E75F00A1BF');
  });

  it('reconstructs the DevEUI from an extended WS identifier', () => {
    expect(deriveDevEuiFromDeviceName('ws5f006763')).toBe('70B3D5E75F006763');
    expect(deriveDevEuiFromDeviceName('WS12345678')).toBe('70B3D5E712345678');
  });

  it('does not infer a DevEUI from an unrecognized or incomplete name', () => {
    expect(deriveDevEuiFromDeviceName('Sensor 006763')).toBeNull();
    expect(deriveDevEuiFromDeviceName('WS6763')).toBeNull();
    expect(deriveDevEuiFromDeviceName('WTC12345678')).toBeNull();
    expect(deriveDevEuiFromDeviceName()).toBeNull();
  });

  it('accepts only current WS5 BLE sensor names', () => {
    expect(isBleSensorName('WS5F006763')).toBe(true);
    expect(isBleSensorName('ws5abcdef0')).toBe(true);
    expect(isBleSensorName('WS5F00676')).toBe(false);
    expect(isBleSensorName('WS5F0067630')).toBe(false);
    expect(isBleSensorName('WS5G006763')).toBe(false);
    expect(isBleSensorName('WTC006763')).toBe(false);
    expect(isBleSensorName()).toBe(false);
  });

  it('formats a DevEUI for display', () => {
    expect(formatDevEui('70B3D5E75F006799')).toBe('70:B3:D5:E7:5F:00:67:99');
    expect(formatDevEui('70:b3:d5:e7:5f:00:67:99')).toBe('70:B3:D5:E7:5F:00:67:99');
    expect(formatDevEui('invalid')).toBeNull();
  });
});
