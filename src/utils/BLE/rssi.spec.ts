import { describe, expect, it } from 'vitest';
import { getBleSignalLevel } from '@/utils/BLE/rssi';

describe('BLE RSSI signal levels', () => {
  it('maps RSSI values to four signal levels', () => {
    expect(getBleSignalLevel(-55)).toBe(4);
    expect(getBleSignalLevel(-65)).toBe(3);
    expect(getBleSignalLevel(-75)).toBe(2);
    expect(getBleSignalLevel(-90)).toBe(1);
  });
});
