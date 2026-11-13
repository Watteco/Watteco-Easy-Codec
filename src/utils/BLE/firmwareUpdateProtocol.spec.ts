import { describe, expect, it } from 'vitest';
import {
  buildOtaRebootCommand,
  buildBeginPageCommand,
  buildCommitPageCommand,
  buildFinishCommand,
  buildPrepareCommand,
  crc32,
  deriveOtaLoaderName,
  deriveApplicationNameFromOtaLoader,
  STM32WB_55CE512K_FIRST_SECTOR,
  STM32WB_55CE512K_SECTOR_COUNT,
} from '@/utils/BLE/firmwareUpdateProtocol';

describe('firmware update protocol', () => {
  it('builds the non-destructive 55CE512k loader reboot request', () => {
    expect(buildOtaRebootCommand(
      STM32WB_55CE512K_FIRST_SECTOR,
      STM32WB_55CE512K_SECTOR_COUNT,
      0,
    )).toEqual(Uint8Array.of(0x01, 0x07, 0x55, 0x00));
  });

  it('reuses the same plan bytes for prepare', () => {
    expect(buildPrepareCommand(0x07, 0x55, 0x1f))
      .toEqual(Uint8Array.of(0x09, 0x07, 0x55, 0x1f));
  });

  it('rejects invalid erase plans', () => {
    expect(() => buildOtaRebootCommand(7, 0, 0)).toThrow('sectorCount');
    expect(() => buildOtaRebootCommand(7, 0x55, 0x20)).toThrow('regionMask');
    expect(() => buildOtaRebootCommand(-1, 0x55, 0)).toThrow('firstSector');
  });

  it('derives the device-specific loader name', () => {
    expect(deriveOtaLoaderName('WS5F006761')).toBe('WS5F006761.OTA');
    expect(deriveOtaLoaderName(' WS5F006761 ')).toBe('WS5F006761.OTA');
    expect(deriveOtaLoaderName('WS5F006761.OTA')).toBeNull();
    expect(deriveOtaLoaderName()).toBeNull();
  });

  it('derives the application name from a recovery loader', () => {
    expect(deriveApplicationNameFromOtaLoader('WS5F006761.OTA')).toBe('WS5F006761');
    expect(deriveApplicationNameFromOtaLoader(' ws5f006761.ota ')).toBe('ws5f006761');
    expect(deriveApplicationNameFromOtaLoader('WS5F006761')).toBeNull();
  });

  it('calculates the standard reflected CRC-32 used by zlib', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('builds page begin, commit, and finish commands', () => {
    const data = new Uint8Array(16).fill(0xa5);
    const begin = buildBeginPageCommand(0x08007180, data);
    expect(Array.from(begin.slice(0, 6))).toEqual([0x0a, 0x00, 0x71, 0x80, 0x10, 0x00]);
    expect(new DataView(begin.buffer).getUint32(6, true)).toBe(crc32(data));
    expect(buildCommitPageCommand()).toEqual(Uint8Array.of(0x0b));
    expect(buildFinishCommand()).toEqual(Uint8Array.of(0x07, 0, 0, 0));
  });

  it('rejects page blocks that cross a Flash page', () => {
    expect(() => buildBeginPageCommand(0x08007ff8, new Uint8Array(16)))
      .toThrow('stay in one Flash page');
  });
});
