import { BleClient } from '@capacitor-community/bluetooth-le';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseAppFrameHex,
  readOutputConfigurationFrames,
  readOutputFrameHexes,
  startAppRxMonitoring,
  stopAppRxMonitoring,
  takeFirstConfigurationFrames,
  takeFirstConfigurationFrameEntries,
} from '@/utils/BLE/appFrames';
import { findCharacteristicByUuid } from '@/utils/BLE/connection';

vi.mock('@capacitor-community/bluetooth-le', () => ({
  BleClient: {
    startNotifications: vi.fn(),
    stopNotifications: vi.fn(),
  },
}));

vi.mock('@/utils/BLE/connection', () => ({
  findCharacteristicByUuid: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findCharacteristicByUuid).mockResolvedValue({
    service: '80010000-890d-4f4e-a197-3f9eb158ea95',
    characteristic: '8001c007-890d-4f4e-a197-3f9eb158ea95',
    props: { notify: true },
  });
  vi.mocked(BleClient.startNotifications).mockResolvedValue();
  vi.mocked(BleClient.stopNotifications).mockResolvedValue();
});

describe('manual application frames', () => {
  it('parses a frame separated with spaces', () => {
    expect(parseAppFrameHex('11 00 80 04 00 04')).toEqual(
      new Uint8Array([0x11, 0x00, 0x80, 0x04, 0x00, 0x04]),
    );
  });

  it('accepts compact, colon-separated and dash-separated frames', () => {
    expect(parseAppFrameHex('110080040004')).toHaveLength(6);
    expect(parseAppFrameHex('11:00:80:04:00:04')).toHaveLength(6);
    expect(parseAppFrameHex('11-00-80-04-00-04')).toHaveLength(6);
  });

  it('rejects empty, odd and non-hexadecimal values', () => {
    expect(parseAppFrameHex('')).toBeNull();
    expect(parseAppFrameHex('110')).toBeNull();
    expect(parseAppFrameHex('11 GG')).toBeNull();
  });
});

describe('current configuration frame selection', () => {
  it('reads separate frames even when the output is hidden in production', () => {
    const outputArea = document.createElement('div');
    outputArea.style.display = 'none';
    outputArea.innerHTML = '<span>11 50 00 50 02 03</span><br><span>11 05 8004 0000 08 00</span><br><span>00</span><br>';

    expect(readOutputFrameHexes(outputArea)).toEqual([
      '115000500203',
      '1105800400000800',
      '00',
    ]);
    expect(takeFirstConfigurationFrames(readOutputFrameHexes(outputArea))).toEqual([
      '115000500203',
      '1105800400000800',
    ]);
  });

  it('keeps the localized setting label attached to each frame', () => {
    const outputArea = document.createElement('div');
    outputArea.innerHTML = '<span title="Configures the BLE connection">11 02 0050 FB1E 41 01 00</span><br><span>00</span><br>';

    const frames = readOutputConfigurationFrames(outputArea);
    expect(frames).toEqual([
      { hex: '11020050FB1E410100', label: 'Configures the BLE connection' },
      { hex: '00', label: '' },
    ]);
    expect(takeFirstConfigurationFrameEntries(frames)).toEqual([
      { hex: '11020050FB1E410100', label: 'Configures the BLE connection' },
    ]);
  });

  it('keeps only frames before the first 00 separator', () => {
    expect(takeFirstConfigurationFrames([
      '115000500203',
      '1105800400000801',
      '00',
      '1511020050FB1E',
      '00',
      '7106000F1D0402',
    ])).toEqual(['115000500203', '1105800400000801']);
  });

  it('keeps every frame when no separator is present', () => {
    expect(takeFirstConfigurationFrames(['11 50', '15 11'])).toEqual(['11 50', '15 11']);
  });

  it('returns no frame when the list starts with a separator', () => {
    expect(takeFirstConfigurationFrames(['00', '11 50'])).toEqual([]);
  });
});

describe('AppRx monitoring ownership', () => {
  it('waits for the active monitoring session to stop before starting another one', async () => {
    let finishFirstStop!: () => void;
    vi.mocked(BleClient.stopNotifications)
      .mockImplementationOnce(() => new Promise<void>(resolve => { finishFirstStop = resolve; }))
      .mockResolvedValue();

    const first = await startAppRxMonitoring('device-1', vi.fn(), vi.fn());
    const secondPromise = startAppRxMonitoring('device-1', vi.fn(), vi.fn());

    await Promise.resolve();
    expect(findCharacteristicByUuid).toHaveBeenCalledTimes(1);

    const firstStopPromise = stopAppRxMonitoring(first);
    await Promise.resolve();
    expect(BleClient.stopNotifications).toHaveBeenCalledTimes(1);
    finishFirstStop();
    await firstStopPromise;

    const second = await secondPromise;
    expect(findCharacteristicByUuid).toHaveBeenCalledTimes(2);
    expect(BleClient.startNotifications).toHaveBeenCalledTimes(2);
    await stopAppRxMonitoring(second);
  });
});
