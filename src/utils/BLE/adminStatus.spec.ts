import { describe, expect, it } from 'vitest';
import {
  decodeDateTime,
  decodeOsaAuthenticated,
  decodeRunningTime,
  decodeUnixTime,
} from '@/utils/BLE/adminStatus';

describe('administration status decoders', () => {
  it('decodes little-endian Unix and running times', () => {
    expect(decodeUnixTime(new Uint8Array([0x80, 0x00, 0x00, 0x00]))).toBe(128_000);
    expect(decodeRunningTime(new Uint8Array([0x34, 0x12, 0x00, 0x00]))).toBe(0x1234);
  });

  it('decodes the Bluetooth Date Time format', () => {
    const timestamp = decodeDateTime(new Uint8Array([0xea, 0x07, 10, 5, 14, 30, 45]));
    expect(timestamp).toBe(new Date(2026, 9, 5, 14, 30, 45).getTime());
  });

  it('recognizes OSA authenticated status 0x02', () => {
    expect(decodeOsaAuthenticated(new Uint8Array([0x02]))).toBe(true);
    expect(decodeOsaAuthenticated(new Uint8Array([0x00]))).toBe(false);
    expect(decodeOsaAuthenticated(new Uint8Array())).toBeNull();
  });
});
