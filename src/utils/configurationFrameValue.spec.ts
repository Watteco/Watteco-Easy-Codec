import { describe, expect, it } from 'vitest';
import remoteHygro from '../../public/config/50-70-200-RTH.json';
import { encodeHexFrameValue } from './configurationFrameValue';
import { parseReportingConfigurations } from './BLE/reportingConfiguration';

describe('numeric configuration frame encoding', () => {
  it('encodes the remote HygroTempO decimal threshold pairs without truncation', () => {
    const temperature = remoteHygro.standard_params.standard_T_params.fields.tNotification;
    const humidity = remoteHygro.standard_params.standard_H_params.fields.hNotification;
    expect(encodeHexFrameValue(temperature.default_value, temperature.type, temperature.HMI.multiplier))
      .toBe('05e6 0bae'); // 15.1 * 100 = 1510; 29.9 * 100 = 2990
    expect(encodeHexFrameValue(humidity.default_value, humidity.type, humidity.HMI.multiplier))
      .toBe('0dac 1766'); // 35 * 100 = 3500; 59.9 * 100 = 5990
  });

  it('rounds only after scaling to the precision of the frame', () => {
    expect(encodeHexFrameValue('0.29', 'hex2B', 100)).toBe('001d');
    expect(encodeHexFrameValue('15.1', 'hex2B', 10)).toBe('0097');
    expect(encodeHexFrameValue('15.126', 'hex2B', 100)).toBe('05e9');
  });

  it('preserves integer thresholds and unscaled multi-byte values', () => {
    expect(encodeHexFrameValue('15 30', 'hex2B', '100')).toBe('05dc 0bb8');
    expect(encodeHexFrameValue('2900 3300', 'hex2B')).toBe('0b54 0ce4');
    expect(encodeHexFrameValue('1', 'hex1B')).toBe('01');
    expect(encodeHexFrameValue('4294967295', 'hex4B')).toBe('ffffffff');
  });

  it('round-trips generated decimal threshold bytes through BLE reporting reads', () => {
    const fields = remoteHygro.standard_params.standard_T_params.fields;
    const [lower, upper] = encodeHexFrameValue(
      fields.tNotification.default_value, fields.tNotification.type, fields.tNotification.HMI.multiplier,
    ).split(' ');
    const response = `11 09 0402 00 90 0000 29 800A 80F0 f0 ${lower} 000a 02 f1 ${upper} 000a 02`;
    const bytes = Uint8Array.from(response.match(/[0-9a-f]{2}/gi)!.map(byte => Number.parseInt(byte, 16)));
    const parsed = parseReportingConfigurations(remoteHygro, [bytes]);
    expect(parsed.unmatchedFrames).toEqual([]);
    expect(parsed.unsupportedValues).toEqual([]);
    expect(parsed.fieldValues.tNotification).toBe('15.1 29.9');
  });
});
