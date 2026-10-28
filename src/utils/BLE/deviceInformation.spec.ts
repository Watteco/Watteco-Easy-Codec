import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decodeFirmwareVersionResponse,
  decodeManufacturerResponse,
  decodePcbVersionResponse,
  readDeviceInformation,
} from '@/utils/BLE/deviceInformation';

vi.mock('@/utils/BLE/appFrames', () => ({
  startAppRxMonitoring: vi.fn().mockResolvedValue({ notifications: true }),
  stopAppRxMonitoring: vi.fn().mockResolvedValue(undefined),
  writeAppTx: vi.fn().mockResolvedValue(undefined),
  readAppRx: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
});

describe('device information response decoders', () => {
  it('decodes the semantic firmware version and little-endian ui24 build number', () => {
    const response = Uint8Array.of(
      0x11, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x0d,
      0x03, 0x06, 0x02, 0x00, 0x00, 0x00,
    );
    expect(decodeFirmwareVersionResponse(response)).toBe('3.6.2:0');

    response.set([0x56, 0x34, 0x12], 11);
    expect(decodeFirmwareVersionResponse(response)).toBe('3.6.2:1193046');
  });

  it('decodes length-prefixed manufacturer and PCB strings', () => {
    const manufacturer = Uint8Array.of(
      0x11, 0x01, 0x00, 0x00, 0x00, 0x04, 0x00, 0x42,
      0x0b, 0x43, 0x6f, 0x6e, 0x74, 0x69, 0x6b, 0x69, 0x20, 0x33, 0x2e, 0x78,
    );
    const pcb = Uint8Array.of(
      0x11, 0x01, 0x00, 0x00, 0x00, 0x05, 0x00, 0x42,
      0x09, 0x37, 0x31, 0x2d, 0x30, 0x30, 0x30, 0x31, 0x2d, 0x41,
    );
    expect(decodeManufacturerResponse(manufacturer)).toBe('Contiki 3.x');
    expect(decodePcbVersionResponse(pcb)).toBe('71-0001-A');
  });

  it('rejects truncated or unrelated responses', () => {
    expect(decodeManufacturerResponse(Uint8Array.of(
      0x11, 0x01, 0x00, 0x00, 0x00, 0x04, 0x00, 0x42, 0x05, 0x41,
    ))).toBeNull();
    expect(decodePcbVersionResponse(Uint8Array.of(
      0x11, 0x01, 0x00, 0x00, 0x00, 0x04, 0x00, 0x42, 0x01, 0x41,
    ))).toBeNull();
  });

  it('treats fields filled with 0xff as not provided', () => {
    expect(decodeFirmwareVersionResponse(Uint8Array.of(
      0x11, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x0d,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    ))).toBeNull();
    expect(decodeManufacturerResponse(Uint8Array.of(
      0x11, 0x01, 0x00, 0x00, 0x00, 0x04, 0x00, 0x42,
      0x04, 0xff, 0xff, 0xff, 0xff,
    ))).toBeNull();
    expect(decodePcbVersionResponse(Uint8Array.of(
      0x11, 0x01, 0x00, 0x00, 0x00, 0x05, 0x00, 0x42,
      0x04, 0xff, 0xff, 0xff, 0xff,
    ))).toBeNull();
  });

  it('keeps fields unknown when the device does not answer', async () => {
    vi.useFakeTimers();
    const resultPromise = readDeviceInformation('device-id', () => undefined);

    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({
      firmwareVersion: undefined,
      manufacturer: undefined,
      pcbVersion: undefined,
    });
  });
});
