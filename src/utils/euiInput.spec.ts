import { describe, expect, it } from 'vitest';
import {
  formatEuiInput,
  getFormattedEuiInputCaret,
  isCompleteEuiInput,
  normalizeEuiInput,
} from '@/utils/euiInput';

describe('EUI input formatting', () => {
  it('normalizes and formats a complete 8-byte EUI', () => {
    expect(normalizeEuiInput('01:23-45 67:89:ab:cd:ef')).toBe('0123456789ABCDEF');
    expect(formatEuiInput('0123456789abcdef')).toBe('01:23:45:67:89:AB:CD:EF');
    expect(isCompleteEuiInput('01:23:45:67:89:AB:CD:EF')).toBe(true);
  });

  it('supports an immutable prefix and returns only the editable suffix', () => {
    const options = { fixedPrefix: '70:B3:D5:E7' };

    expect(normalizeEuiInput('5f:00:67:63', options)).toBe('5F006763');
    expect(normalizeEuiInput('70:B3:D5:E7:5F:00:67:63', options)).toBe('5F006763');
    expect(formatEuiInput('5F006763', options)).toBe('5F:00:67:63');
  });

  it('rejects a complete EUI that does not match the immutable prefix', () => {
    expect(normalizeEuiInput('00:11:22:33:5F:00:67:63', {
      fixedPrefix: '70B3D5E7',
    })).toBe('');
  });

  it('keeps the caret beside the same editable byte after formatting', () => {
    expect(getFormattedEuiInputCaret('01:23:4:67', 7)).toBe(7);
    expect(getFormattedEuiInputCaret('70:B3:D5:E7:5F:00:67:63', 23, {
      fixedPrefix: '70B3D5E7',
    })).toBe(11);
  });
});

