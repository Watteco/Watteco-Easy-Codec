import { describe, expect, it } from 'vitest';
import {
  buildBstCommand,
  getAvailableBstTargets,
  parseBstStatus,
} from '@/utils/BLE/bstProtocol';

describe('BST protocol', () => {
  it('decodes the compact little-endian status', () => {
    expect(parseBstStatus(Uint8Array.of(
      1, 3, 0x45, 0x01, 7, 9, 0x20, 1, 0, 1, 0x09, 0x01,
    ))).toEqual({
      version: 1,
      phase: 3,
      blockingMask: 0x0145,
      autotestLog: 7,
      autotestLastNum: 9,
      cemState: 0x20,
      blockedStarting: 1,
      minUptimeExpired: 0,
      result: 1,
      availableTargets: 0x0109,
    });
  });

  it('rejects malformed statuses', () => {
    expect(() => parseBstStatus(new Uint8Array(11))).toThrow('length');
  });

  it('filters targets using the firmware bitmap', () => {
    expect(getAvailableBstTargets(0x0109).map(target => target.id)).toEqual([0, 3, 8]);
  });

  it('builds the confirmed four-byte command', () => {
    expect(buildBstCommand(4)).toEqual(Uint8Array.of(1, 4, 0xa5, 0));
    expect(() => buildBstCommand(9)).toThrow('Invalid BST target');
  });
});
