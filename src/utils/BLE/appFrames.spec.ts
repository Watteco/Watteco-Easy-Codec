import { describe, expect, it } from 'vitest';
import { parseAppFrameHex } from '@/utils/BLE/appFrames';

describe('manual application frames', () => {
  it('parses a frame separated with spaces', () => {
    expect(parseAppFrameHex('11 00 80 04 00 04')).toEqual(
      new Uint8Array([0x11, 0x00, 0x80, 0x04, 0x00, 0x04]),
    );
  });

  it('accepts compact, colon-separated and dash-separated frames', () => {
    expect(parseAppFrameHex('110080040004')).toHaveLength(6);
    expect(parseAppFrameHex('11:00:80:04:00:04')).toHaveLength(6);
    expect(parseAppFrameHex('11-00-80-04-00-04')).toHaveLength(6);
  });

  it('rejects empty, odd and non-hexadecimal values', () => {
    expect(parseAppFrameHex('')).toBeNull();
    expect(parseAppFrameHex('110')).toBeNull();
    expect(parseAppFrameHex('11 GG')).toBeNull();
  });
});
