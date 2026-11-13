import { BleClient } from '@capacitor-community/bluetooth-le';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeLoraLinkTestAttError,
  decodeLoraLinkStatus,
  decodeLoraWanJoined,
  eu868DataRateToSpreadingFactor,
  LoraLinkTestRejectedError,
  sendLoraLinkTest,
} from '@/utils/BLE/loraLink';
import {
  LORA_LINK_TEST_CHAR_UUID,
  LORA_SERVICE_UUID,
} from '@/utils/BLE/characteristics';

vi.mock('@capacitor-community/bluetooth-le', () => ({
  BleClient: {
    getServices: vi.fn(),
    write: vi.fn(),
    writeWithoutResponse: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(BleClient.getServices).mockResolvedValue([{
    uuid: LORA_SERVICE_UUID,
    characteristics: [{
      uuid: LORA_LINK_TEST_CHAR_UUID,
      descriptors: [],
      properties: {
        broadcast: false,
        read: false,
        write: true,
        writeWithoutResponse: true,
        notify: false,
        indicate: false,
        authenticatedSignedWrites: false,
      },
    }],
  }]);
  vi.mocked(BleClient.write).mockResolvedValue();
});

describe('LoRaWAN LinkStatus', () => {
  it('decodes the joined field from a version 1 payload', () => {
    expect(decodeLoraWanJoined(new Uint8Array([1, 0x0f, 0, 0, 0, 0, 1]))).toBe(true);
    expect(decodeLoraWanJoined(new Uint8Array([1, 0x02, 0, 0, 0, 0, 0]))).toBe(false);
  });

  it('rejects truncated and unsupported payloads', () => {
    expect(decodeLoraWanJoined(new Uint8Array([1, 0x01]))).toBeNull();
    expect(decodeLoraWanJoined(new Uint8Array([2, 0, 0, 0, 0, 0, 1]))).toBeNull();
  });

  it('decodes radio, LinkCheck and TX diagnostics', () => {
    const bytes = new Uint8Array(59);
    const view = new DataView(bytes.buffer);
    bytes[0] = 1;
    bytes[1] = 0x7f;
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
    view.setUint32(43, 103, true);
    view.setUint32(47, 8, true);
    view.setUint32(51, 868100000, true);
    view.setInt8(55, 14);
    bytes[56] = 3;
    bytes[57] = 5;
    bytes[58] = 1;

    expect(decodeLoraLinkStatus(bytes)).toMatchObject({
      joined: true,
      heartbeatMinSeconds: 600,
      rx: { sequence: 7, rssiDbm: -97, snrDb: 5.5, dataRate: 5 },
      applicationDownlink: { fport: 125, payloadSize: 4 },
      linkCheck: { marginDb: 18, gatewayCount: 3 },
      tx: {
        timestamp: 103_000,
        sequence: 8,
        frequencyHz: 868_100_000,
        powerDbm: 14,
        dataRate: 3,
        payloadSize: 5,
        status: 1,
      },
    });
  });

  it('keeps supporting version 1 payloads without appended TX metadata', () => {
    const bytes = new Uint8Array(43);
    bytes[0] = 1;
    bytes[1] = 0x40;

    expect(decodeLoraLinkStatus(bytes)).toMatchObject({ tx: null });
  });

  it('converts EU868 LoRa data rates to spreading factors', () => {
    expect(eu868DataRateToSpreadingFactor(0)).toBe(12);
    expect(eu868DataRateToSpreadingFactor(5)).toBe(7);
    expect(eu868DataRateToSpreadingFactor(6)).toBe(7);
    expect(eu868DataRateToSpreadingFactor(7)).toBeNull();
    expect(eu868DataRateToSpreadingFactor(null)).toBeNull();
  });
});

describe('LoRaWAN LinkTest writes', () => {
  it('uses a write with response even when write without response is available', async () => {
    await sendLoraLinkTest('device-id', {
      linkCheck: true,
      sendUplink: true,
      fport: 199,
    }, vi.fn());

    expect(BleClient.write).toHaveBeenCalledOnce();
    expect(BleClient.writeWithoutResponse).not.toHaveBeenCalled();
    const data = vi.mocked(BleClient.write).mock.calls[0][3];
    expect(Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))).toEqual([
      0x01, 0x03, 0xc7, 0x00,
    ]);
  });

  it.each([
    [0x81, 'not-initialized'],
    [0x82, 'invalid'],
    [0x83, 'busy'],
    [0x84, 'failed'],
    [0x85, 'no-time'],
    [0x86, 'invalid-stack-id'],
    [0x87, 'no-event'],
  ] as const)('decodes Android ATT error 0x%s as %s', (attCode, reason) => {
    expect(decodeLoraLinkTestAttError(
      new Error(`Writing characteristic failed. status=${attCode} (0x${attCode.toString(16)})`),
    )).toEqual({ attCode, reason });
  });

  it('throws a typed rejection when the modem is busy', async () => {
    vi.mocked(BleClient.write).mockRejectedValueOnce(
      new Error('Writing characteristic failed. status=131 (0x83)'),
    );

    const request = sendLoraLinkTest('device-id', { linkCheck: true }, vi.fn());
    await expect(request).rejects.toMatchObject({
      name: 'LoraLinkTestRejectedError',
      attCode: 0x83,
      reason: 'busy',
    });
    await expect(request).rejects.toBeInstanceOf(LoraLinkTestRejectedError);
  });

  it.each([
    [0x81, 'not-initialized'],
    [0x82, 'invalid'],
    [0x83, 'busy'],
    [0x84, 'failed'],
    [0x85, 'no-time'],
    [0x86, 'invalid-stack-id'],
    [0x87, 'no-event'],
  ] as const)('preserves iOS vendor ATT error 0x%s as %s', async (attCode, reason) => {
    vi.mocked(BleClient.write).mockRejectedValueOnce(
      new Error(`Unknown ATT error (ATT 0x${attCode.toString(16)})`),
    );

    await expect(sendLoraLinkTest('device-id', { linkCheck: true }, vi.fn()))
      .rejects.toMatchObject({ name: 'LoraLinkTestRejectedError', attCode, reason });
    expect(BleClient.writeWithoutResponse).not.toHaveBeenCalled();
  });

  it('keeps an unknown iOS error unclassified when its ATT code is missing or unsupported', () => {
    expect(decodeLoraLinkTestAttError(new Error('Unknown ATT error'))).toBeNull();
    expect(decodeLoraLinkTestAttError(new Error('Unknown ATT error (ATT 0x88)'))).toBeNull();
  });
});
