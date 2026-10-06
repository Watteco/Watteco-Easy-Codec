import { describe, expect, it } from 'vitest';
import { parseAppFrameHex, takeFirstConfigurationFrames } from '@/utils/BLE/appFrames';

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

describe('current configuration frame selection', () => {
  it('keeps only frames before the first 00 separator', () => {
    expect(takeFirstConfigurationFrames([
      '115000500203',
      '1105800400000801',
      '00',
      '1511020050FB1E',
      '00',
      '7106000F1D0402',
    ])).toEqual(['115000500203', '1105800400000801']);
  });

  it('keeps every frame when no separator is present', () => {
    expect(takeFirstConfigurationFrames(['11 50', '15 11'])).toEqual(['11 50', '15 11']);
  });

  it('returns no frame when the list starts with a separator', () => {
    expect(takeFirstConfigurationFrames(['00', '11 50'])).toEqual([]);
  });
});
