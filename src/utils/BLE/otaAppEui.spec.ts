import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildOtaAppEuiWriteFrame,
  decodeOtaAppEuiResponse,
  OTA_APP_EUI_READ_FRAME,
  readOtaAppEui,
  writeAndVerifyOtaAppEui,
} from '@/utils/BLE/otaAppEui';
import {
  readAppRx,
  startAppRxMonitoring,
  stopAppRxMonitoring,
  writeAppTx,
} from '@/utils/BLE/appFrames';

vi.mock('@/utils/BLE/appFrames', () => ({
  readAppRx: vi.fn(),
  startAppRxMonitoring: vi.fn(),
  stopAppRxMonitoring: vi.fn(),
  writeAppTx: vi.fn(),
}));

const response = (value = '0123456789ABCDEF') => Uint8Array.of(
  0x11, 0x01, 0x80, 0x04, 0x00, 0x05, 0x00, 0x41, 0x08,
  ...(value.match(/.{2}/g)?.map(byte => Number.parseInt(byte, 16)) ?? []),
);

const writeResponse = (status = 0x00) => Uint8Array.of(
  0x11, 0x04, 0x80, 0x04, status, 0x00, 0x05,
);

describe('OTA AppEUI protocol', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(readAppRx).mockReset();
    vi.mocked(startAppRxMonitoring).mockReset();
    vi.mocked(stopAppRxMonitoring).mockReset().mockResolvedValue();
    vi.mocked(writeAppTx).mockReset().mockResolvedValue();
  });

  it('builds the documented read and write frames', () => {
    expect(Array.from(OTA_APP_EUI_READ_FRAME)).toEqual([
      0x11, 0x00, 0x80, 0x04, 0x00, 0x05,
    ]);
    expect(Array.from(buildOtaAppEuiWriteFrame('01:23:45:67:89:AB:CD:EF') ?? []))
      .toEqual([
        0x11, 0x02, 0x80, 0x04, 0x00, 0x05, 0x41, 0x08,
        0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF,
      ]);
    expect(buildOtaAppEuiWriteFrame('0123')).toBeNull();
  });

  it('decodes only a successful 8-byte octet-string response', () => {
    expect(decodeOtaAppEuiResponse(response())).toBe('0123456789ABCDEF');
    expect(decodeOtaAppEuiResponse(Uint8Array.of(
      0x11, 0x01, 0x80, 0x04, 0x00, 0x05, 0x86,
    ))).toBeNull();
    expect(decodeOtaAppEuiResponse(Uint8Array.of(
      0x11, 0x01, 0x80, 0x04, 0x00, 0x05, 0x00, 0x42, 0x08,
      1, 2, 3, 4, 5, 6, 7, 8,
    ))).toBeNull();
  });

  it('reads the AppEUI from an AppRx notification', async () => {
    let notify: ((frame: Uint8Array) => void) | undefined;
    vi.mocked(startAppRxMonitoring).mockImplementation(async (_deviceId, onFrame) => {
      notify = onFrame;
      return {
        deviceId: 'device-1',
        service: 'service',
        characteristic: 'characteristic',
        notifications: true,
      };
    });
    vi.mocked(writeAppTx).mockImplementation(async () => notify?.(response()));

    await expect(readOtaAppEui('device-1', vi.fn())).resolves.toBe('0123456789ABCDEF');
    expect(stopAppRxMonitoring).toHaveBeenCalledOnce();
  });

  it('reports an attribute error returned by the sensor', async () => {
    let notify: ((frame: Uint8Array) => void) | undefined;
    vi.mocked(startAppRxMonitoring).mockImplementation(async (_deviceId, onFrame) => {
      notify = onFrame;
      return {
        deviceId: 'device-1',
        service: 'service',
        characteristic: 'characteristic',
        notifications: true,
      };
    });
    vi.mocked(writeAppTx).mockImplementation(async () => notify?.(Uint8Array.of(
      0x11, 0x01, 0x80, 0x04, 0x00, 0x05, 0x86,
    )));

    await expect(readOtaAppEui('device-1', vi.fn()))
      .rejects.toThrow('Unsupported attribute');
  });

  it('polls AppRx when notifications are unavailable', async () => {
    vi.useFakeTimers();
    vi.mocked(startAppRxMonitoring).mockResolvedValue({
      deviceId: 'device-1',
      service: 'service',
      characteristic: 'characteristic',
      notifications: false,
    });
    vi.mocked(readAppRx).mockResolvedValue(response());

    const pending = readOtaAppEui('device-1', vi.fn());
    await vi.advanceTimersByTimeAsync(100);

    await expect(pending).resolves.toBe('0123456789ABCDEF');
  });

  it('writes and confirms the value with a read-back', async () => {
    let notify: ((frame: Uint8Array) => void) | undefined;
    vi.mocked(startAppRxMonitoring).mockImplementation(async (_deviceId, onFrame) => {
      notify = onFrame;
      return {
        deviceId: 'device-1',
        service: 'service',
        characteristic: 'characteristic',
        notifications: true,
      };
    });
    vi.mocked(writeAppTx).mockImplementation(async (_deviceId, frame) => {
      if (frame[1] === 0x02) notify?.(writeResponse());
      if (frame[1] === 0x00) notify?.(response());
    });

    const pending = writeAndVerifyOtaAppEui(
      'device-1',
      '01:23:45:67:89:AB:CD:EF',
      vi.fn(),
    );

    await expect(pending).resolves.toBe('0123456789ABCDEF');
    expect(vi.mocked(writeAppTx).mock.calls.map(call => call[1][1])).toEqual([0x02, 0x00]);
  });

  it('rejects a write whose read-back does not match', async () => {
    let notify: ((frame: Uint8Array) => void) | undefined;
    vi.mocked(startAppRxMonitoring).mockImplementation(async (_deviceId, onFrame) => {
      notify = onFrame;
      return {
        deviceId: 'device-1',
        service: 'service',
        characteristic: 'characteristic',
        notifications: true,
      };
    });
    vi.mocked(writeAppTx).mockImplementation(async (_deviceId, frame) => {
      if (frame[1] === 0x02) notify?.(writeResponse());
      if (frame[1] === 0x00) notify?.(response('FFEEDDCCBBAA9988'));
    });

    const pending = writeAndVerifyOtaAppEui('device-1', '0123456789ABCDEF', vi.fn());
    await expect(pending).rejects.toThrow('verification failed');
  });

  it('does not read back when the write response is an error', async () => {
    let notify: ((frame: Uint8Array) => void) | undefined;
    vi.mocked(startAppRxMonitoring).mockImplementation(async (_deviceId, onFrame) => {
      notify = onFrame;
      return {
        deviceId: 'device-1',
        service: 'service',
        characteristic: 'characteristic',
        notifications: true,
      };
    });
    vi.mocked(writeAppTx).mockImplementation(async (_deviceId, frame) => {
      if (frame[1] === 0x02) notify?.(writeResponse(0x87));
    });

    await expect(writeAndVerifyOtaAppEui('device-1', '0123456789ABCDEF', vi.fn()))
      .rejects.toThrow('Invalid value');
    expect(vi.mocked(writeAppTx).mock.calls.map(call => call[1][1])).toEqual([0x02]);
  });
});

