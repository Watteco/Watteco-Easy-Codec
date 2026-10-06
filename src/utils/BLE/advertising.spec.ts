import { describe, expect, it } from 'vitest';
import { decodeAdvertisedProductId } from './advertising';

const view = (...bytes: number[]) => new DataView(Uint8Array.from(bytes).buffer);

describe('decodeAdvertisedProductId', () => {
  it('decodes the five Product ID BCD bytes independently of the CID', () => {
    expect(decodeAdvertisedProductId({
      65535: view(0x50, 0x70, 0x26, 0x00, 0x01),
    })).toBe('50-70-260-001');

    expect(decodeAdvertisedProductId({
      1234: view(0x50, 0x70, 0x26, 0x00, 0x67),
    })).toBe('50-70-260-067');
  });

  it('supports DataViews with a non-zero byte offset', () => {
    const bytes = Uint8Array.from([0xff, 0x50, 0x70, 0x26, 0x00, 0x01, 0xff]);
    expect(decodeAdvertisedProductId({
      65535: new DataView(bytes.buffer, 1, 5),
    })).toBe('50-70-260-001');
  });

  it('rejects the firmware fallback and malformed BCD payloads', () => {
    expect(decodeAdvertisedProductId({ 65535: view(0, 0, 0, 0, 0) })).toBeNull();
    expect(decodeAdvertisedProductId({ 65535: view(0x50, 0x70, 0x2a, 0, 1) })).toBeNull();
    expect(decodeAdvertisedProductId({ 65535: view(0x50, 0x70, 0x26, 0) })).toBeNull();
  });

  it('returns null when manufacturer data is absent', () => {
    expect(decodeAdvertisedProductId()).toBeNull();
  });
});
