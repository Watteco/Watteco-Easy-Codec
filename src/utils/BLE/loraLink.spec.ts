import { describe, expect, it } from 'vitest';
import { decodeLoraWanJoined } from '@/utils/BLE/loraLink';

describe('LoRaWAN LinkStatus', () => {
  it('decodes the joined field from a version 1 payload', () => {
    expect(decodeLoraWanJoined(new Uint8Array([1, 0x0f, 0, 0, 0, 0, 1]))).toBe(true);
    expect(decodeLoraWanJoined(new Uint8Array([1, 0x02, 0, 0, 0, 0, 0]))).toBe(false);
  });

  it('rejects truncated and unsupported payloads', () => {
    expect(decodeLoraWanJoined(new Uint8Array([1, 0x01]))).toBeNull();
    expect(decodeLoraWanJoined(new Uint8Array([2, 0, 0, 0, 0, 0, 1]))).toBeNull();
  });
});
