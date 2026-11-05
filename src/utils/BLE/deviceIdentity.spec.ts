import { describe, expect, it } from 'vitest';
import {
  deriveBleDeviceNameFromDevEuiSuffix,
  deriveDevEuiFromDeviceName,
  formatDevEui,
  formatDevEuiSuffix,
  isBleOtaLoaderName,
  isBleSensorName,
  isBleSensorOrOtaName,
  normalizeDevEuiSuffixInput,
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
    expect(deriveDevEuiFromDeviceName('WS5F006763.OTA')).toBe('70B3D5E75F006763');
  });

  it('recognizes OTA recovery loader names separately', () => {
    expect(isBleOtaLoaderName('WS5F006763.OTA')).toBe(true);
    expect(isBleOtaLoaderName('ws5f006763.ota')).toBe(true);
    expect(isBleOtaLoaderName('WS5F006763')).toBe(false);
    expect(isBleSensorOrOtaName('WS5F006763')).toBe(true);
    expect(isBleSensorOrOtaName('WS5F006763.OTA')).toBe(true);
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

  it('normalizes and formats a DevEUI suffix while it is entered', () => {
    expect(normalizeDevEuiSuffixInput('5f:00-67 63')).toBe('5F006763');
    expect(normalizeDevEuiSuffixInput('70:B3:D5:E7:5F:00:67:63')).toBe('5F006763');
    expect(normalizeDevEuiSuffixInput('00:11:22:33:5F:00:67:63')).toBe('');
    expect(formatDevEuiSuffix('5f0067')).toBe('5F:00:67');
  });

  it('derives the BLE name from a complete DevEUI suffix', () => {
    expect(deriveBleDeviceNameFromDevEuiSuffix('5F:00:67:63')).toBe('WS5F006763');
    expect(deriveBleDeviceNameFromDevEuiSuffix('5F0067')).toBeNull();
  });
});
