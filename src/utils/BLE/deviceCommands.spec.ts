import { describe, expect, it } from 'vitest';
import {
  buildLoraRejoinFrame,
  durationToMinutes,
  FACTORY_RESET_FRAME,
} from '@/utils/BLE/deviceCommands';

describe('device command frames', () => {
  it('converts an hours:minutes duration to minutes', () => {
    expect(durationToMinutes('01:30')).toBe(90);
    expect(durationToMinutes('120:00')).toBe(7200);
  });

  it('rejects invalid or overflowing durations', () => {
    expect(durationToMinutes('01:60')).toBeNull();
    expect(durationToMinutes('1093:00')).toBeNull();
  });

  it('accepts the complete uint16 minute range', () => {
    expect(durationToMinutes('1092:15')).toBe(0xffff);
  });

  it('builds a rejoin frame with a big-endian uint16 delay', () => {
    expect(buildLoraRejoinFrame('01:30')).toEqual(
      new Uint8Array([0x11, 0x50, 0x80, 0x04, 0x00, 0x00, 0x5a]),
    );
  });

  it('exposes the factory reset frame', () => {
    expect(FACTORY_RESET_FRAME).toEqual(
      new Uint8Array([0x11, 0x50, 0x00, 0x50, 0x07]),
    );
  });
});
