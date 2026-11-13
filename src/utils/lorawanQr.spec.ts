import { describe, expect, it } from 'vitest';
import { extractDevEuiFromQrPayload } from '@/utils/lorawanQr';

describe('LoRaWAN onboarding QR codes', () => {
  it('extracts the DevEUI from a TR005 LW:D0 payload', () => {
    expect(extractDevEuiFromQrPayload(
      'LW:D0:70B3D5E75F600000:70B3D5E75E024005:0128000F:P5070205000:S0030B2E395:CBDAF',
    )).toBe('70B3D5E75E024005');
  });

  it('normalizes lowercase payloads and surrounding whitespace', () => {
    expect(extractDevEuiFromQrPayload(
      '  lw:d0:70b3d5e75f600000:70b3d5e75e024005:0128000f  ',
    )).toBe('70B3D5E75E024005');
  });

  it('accepts a bare, optionally formatted DevEUI', () => {
    expect(extractDevEuiFromQrPayload('70:B3:D5:E7:5E:02:40:05'))
      .toBe('70B3D5E75E024005');
  });

  it('rejects unsupported or malformed payloads', () => {
    expect(extractDevEuiFromQrPayload('https://example.com/sensor')).toBeNull();
    expect(extractDevEuiFromQrPayload(
      'LW:D0:70B3D5E75F600000:70B3D5E75E02400Z:0128000F',
    )).toBeNull();
    expect(extractDevEuiFromQrPayload('LW:D1:70B3D5E75F600000:70B3D5E75E024005'))
      .toBeNull();
  });
});
