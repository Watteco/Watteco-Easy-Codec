import { describe, expect, it } from 'vitest';
import {
  decodeTimeValue,
  encodeTimeValueHex,
  formatTimeValue,
  parseTimeValue,
  timeValueToSeconds,
} from '@/utils/timeValue';

describe('timeValue', () => {
  it('keeps legacy unit-less values in minutes', () => {
    expect(parseTimeValue('10')).toEqual({ unit: 'minutes', value: 10 });
    expect(encodeTimeValueHex('10')).toBe('800a');
  });

  it('parses and encodes seconds without the unit bit', () => {
    expect(parseTimeValue('10s')).toEqual({ unit: 'seconds', value: 10 });
    expect(parseTimeValue('1m30s')).toEqual({ unit: 'seconds', value: 90 });
    expect(encodeTimeValueHex('10s')).toBe('000a');
    expect(encodeTimeValueHex('1m30s')).toBe('005a');
  });

  it('decodes both protocol units without losing the unit', () => {
    expect(decodeTimeValue(0x800a)).toBe('10');
    expect(decodeTimeValue(0x000a)).toBe('10s');
    expect(decodeTimeValue(0x003c)).toBe('60s');
  });

  it('compares values through their real duration', () => {
    expect(timeValueToSeconds('59s')).toBe(59);
    expect(timeValueToSeconds('1')).toBe(60);
  });

  it('formats seconds and legacy minute values', () => {
    expect(formatTimeValue('10s')).toBe('10 s');
    expect(formatTimeValue('90s')).toBe('1m30s');
    expect(formatTimeValue('65')).toBe('1h05');
  });
});
