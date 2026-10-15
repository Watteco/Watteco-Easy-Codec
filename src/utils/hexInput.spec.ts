import { describe, expect, it } from 'vitest';
import { formatHexInput } from '@/utils/hexInput';

describe('hex input formatting', () => {
  it('groups hexadecimal characters into uppercase bytes', () => {
    expect(formatHexInput('110080')).toEqual({ value: '11 00 80', cursor: 8 });
    expect(formatHexInput('110')).toEqual({ value: '11 0', cursor: 4 });
  });

  it('normalizes separators commonly found in pasted frames', () => {
    expect(formatHexInput('11:00-aa\n04')).toEqual({
      value: '11 00 AA 04',
      cursor: 11,
    });
  });

  it('keeps the cursor next to an insertion made in the middle', () => {
    expect(formatHexInput('1A1 00', 2)).toEqual({
      value: '1A 10 0',
      cursor: 3,
    });
  });

  it('leaves invalid input visible so validation can report it', () => {
    expect(formatHexInput('11 GG', 5)).toEqual({ value: '11 GG', cursor: 5 });
  });
});
