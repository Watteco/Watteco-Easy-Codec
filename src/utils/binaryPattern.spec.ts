import { describe, expect, it } from 'vitest';
import {
  decodeBinaryPattern,
  encodeBinaryPattern,
  formatBinaryPattern,
  normalizeBinaryPatternBitCount,
} from '@/utils/binaryPattern';

describe('binaryPattern', () => {
  it('decodes Val and Gap into input states from b0 upward', () => {
    const states = decodeBinaryPattern('5 263', 10);

    expect(states).toEqual([
      'one', 'zero', 'one',
      'ignored', 'ignored', 'ignored', 'ignored', 'ignored',
      'zero', 'ignored',
    ]);
    expect(formatBinaryPattern(states)).toBe('[X0XXXXX101]');
  });

  it('encodes ignored, zero and one states as Val and Gap', () => {
    expect(encodeBinaryPattern([
      'one', 'zero', 'one',
      'ignored', 'ignored', 'ignored', 'ignored', 'ignored',
      'zero', 'ignored',
    ])).toEqual({ val: 5, gap: 263, value: '5 263' });
  });

  it('uses Gap as the authority when decoding a pattern', () => {
    expect(decodeBinaryPattern('65535 0', 3)).toEqual([
      'ignored', 'ignored', 'ignored',
    ]);
  });

  it('limits patterns to the BITMAP16 width', () => {
    expect(normalizeBinaryPatternBitCount(0)).toBe(1);
    expect(normalizeBinaryPatternBitCount(20)).toBe(16);
  });
});
