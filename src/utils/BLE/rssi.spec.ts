import { describe, expect, it } from 'vitest';
import { getBleSignalLevel, getBleSignalPercent } from '@/utils/BLE/rssi';

describe('BLE RSSI signal levels', () => {
  it('maps RSSI values to four signal levels', () => {
    expect(getBleSignalLevel(-55)).toBe(4);
    expect(getBleSignalLevel(-65)).toBe(3);
    expect(getBleSignalLevel(-75)).toBe(2);
    expect(getBleSignalLevel(-90)).toBe(1);
  });

  it('maps and clamps RSSI values to a continuous percentage', () => {
    expect(getBleSignalPercent(-100)).toBe(0);
    expect(getBleSignalPercent(-88)).toBe(24);
    expect(getBleSignalPercent(-75)).toBe(50);
    expect(getBleSignalPercent(-50)).toBe(100);
    expect(getBleSignalPercent(-120)).toBe(0);
    expect(getBleSignalPercent(-35)).toBe(100);
  });
});
