import { describe, expect, it } from 'vitest';
import {
  BBS_FLAG_FACTORY_RESET,
  BBS_FLAG_START_BLOCKED,
  BBS_TARGETS,
  buildBbsCommand,
  getSupportedBbsTargets,
  isBbsTargetAuthorized,
  parseBbsStatus,
} from '@/utils/BLE/bbsProtocol';

describe('BBS protocol', () => {
  it('decodes the compact little-endian status', () => {
    expect(parseBbsStatus(Uint8Array.of(
      1, 3, 0x45, 0x01, 7, 9, 0x20, 1, 0, 1, 0x09, 0x0d, 0x0f,
    ))).toEqual({
      version: 1,
      phase: 3,
      blockingMask: 0x0145,
      autotestLog: 7,
      autotestLastNum: 9,
      cemState: 0x20,
      blockedStarting: 1,
      minUptimeExpired: 0,
      result: 1,
      supportedTargets: 0x0d09,
      authorizationMask: 0x0f,
    });
  });

  it('rejects malformed statuses', () => {
    expect(() => parseBbsStatus(new Uint8Array(12))).toThrow('length');
  });

  it('filters targets using the firmware bitmap', () => {
    expect(getSupportedBbsTargets(0x0d09).map(target => target.id)).toEqual([0, 3, 10, 11]);
  });

  it('builds confirmed commands including the return-to-service factory reset flag', () => {
    expect(buildBbsCommand(4)).toEqual(Uint8Array.of(1, 4, 0xa5, 0));
    expect(buildBbsCommand(0x0b, BBS_FLAG_FACTORY_RESET)).toEqual(
      Uint8Array.of(1, 0x0b, 0xa5, 1),
    );
    expect(buildBbsCommand(0x0b, BBS_FLAG_START_BLOCKED)).toEqual(
      Uint8Array.of(1, 0x0b, 0xa5, 2),
    );
    expect(buildBbsCommand(0x0b, BBS_FLAG_FACTORY_RESET | BBS_FLAG_START_BLOCKED)).toEqual(
      Uint8Array.of(1, 0x0b, 0xa5, 3),
    );
    expect(() => buildBbsCommand(0x0c)).toThrow('Invalid BBS target');
    expect(() => buildBbsCommand(0x08)).toThrow('Invalid BBS target');
    expect(() => buildBbsCommand(0x09)).toThrow('Invalid BBS target');
    expect(() => buildBbsCommand(4, BBS_FLAG_FACTORY_RESET)).toThrow('Invalid BBS flags');
    expect(() => buildBbsCommand(0x0b, 0x04)).toThrow('Invalid BBS flags');
  });

  it('maps target families to the authorization mask', () => {
    const autotest = BBS_TARGETS.find(target => target.id === 0x01)!;
    const radio = BBS_TARGETS.find(target => target.id === 0x0a)!;
    const returnToService = BBS_TARGETS.find(target => target.id === 0x0b)!;

    expect(isBbsTargetAuthorized(autotest, 0x01)).toBe(true);
    expect(isBbsTargetAuthorized(radio, 0x01)).toBe(false);
    expect(isBbsTargetAuthorized(radio, 0x02)).toBe(true);
    expect(isBbsTargetAuthorized(returnToService, 0x08)).toBe(true);
  });
});
