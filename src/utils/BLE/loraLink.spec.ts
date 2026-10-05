import { describe, expect, it } from 'vitest';
import { decodeLoraLinkStatus, decodeLoraWanJoined } from '@/utils/BLE/loraLink';

describe('LoRaWAN LinkStatus', () => {
  it('decodes the joined field from a version 1 payload', () => {
    expect(decodeLoraWanJoined(new Uint8Array([1, 0x0f, 0, 0, 0, 0, 1]))).toBe(true);
    expect(decodeLoraWanJoined(new Uint8Array([1, 0x02, 0, 0, 0, 0, 0]))).toBe(false);
  });

  it('rejects truncated and unsupported payloads', () => {
    expect(decodeLoraWanJoined(new Uint8Array([1, 0x01]))).toBeNull();
    expect(decodeLoraWanJoined(new Uint8Array([2, 0, 0, 0, 0, 0, 1]))).toBeNull();
  });

  it('decodes radio and LinkCheck diagnostics', () => {
    const bytes = new Uint8Array(43);
    const view = new DataView(bytes.buffer);
    bytes[0] = 1;
    bytes[1] = 0x3f;
    view.setUint32(2, 100, true);
    bytes[6] = 1;
    view.setUint32(7, 90, true);
    view.setUint32(11, 600, true);
    view.setUint32(15, 101, true);
    view.setUint32(19, 7, true);
    bytes[23] = 3;
    view.setInt16(24, -97, true);
    view.setInt16(26, 22, true);
    view.setUint32(28, 869525000, true);
    bytes[32] = 5;
    bytes[33] = 1;
    bytes[34] = 12;
    bytes[35] = 125;
    bytes[36] = 4;
    view.setUint32(37, 102, true);
    bytes[41] = 18;
    bytes[42] = 3;

    expect(decodeLoraLinkStatus(bytes)).toMatchObject({
      joined: true,
      heartbeatMinSeconds: 600,
      rx: { sequence: 7, rssiDbm: -97, snrDb: 5.5, dataRate: 5 },
      applicationDownlink: { fport: 125, payloadSize: 4 },
      linkCheck: { marginDb: 18, gatewayCount: 3 },
    });
  });
});
