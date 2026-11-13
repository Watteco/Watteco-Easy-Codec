import { describe, expect, it } from 'vitest';
import {
  parseFirmwareMetadata,
  parseIntelHex,
  planFirmwareImage,
  STM32WB_55CG1024K_LAYOUT,
} from '@/utils/BLE/firmwareImage';

function applicationBytes(size = 0x188): Uint8Array {
  const data = new Uint8Array(size).fill(0xff);
  const view = new DataView(data.buffer);
  view.setUint32(0, 0x20010000, true);
  view.setUint32(4, 0x08007181, true);
  view.setUint32(0x140, 0x08007180, true);
  view.setUint32(0x180, 0x94448a29, true);
  return data;
}

function hexRecord(address: number, kind: number, data: Uint8Array): string {
  const body = Uint8Array.of(
    data.length,
    (address >>> 8) & 0xff,
    address & 0xff,
    kind,
    ...data,
  );
  const checksum = (-Array.from(body).reduce((sum, value) => sum + value, 0)) & 0xff;
  return `:${Array.from(Uint8Array.of(...body, checksum), value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function sparseApplicationHex(includeDefaultConfig = false): Uint8Array {
  const app = applicationBytes();
  const lines = [hexRecord(0, 4, Uint8Array.of(0x08, 0x00))];
  for (let offset = 0; offset < app.length; offset += 16) {
    lines.push(hexRecord(0x7000 + offset, 0, app.slice(offset, offset + 16)));
  }
  if (includeDefaultConfig) {
    lines.push(hexRecord(0x1000, 4, Uint8Array.of(0x08, 0x05)));
    lines.push(hexRecord(0x1000, 0, new TextEncoder().encode('CONFIG')));
  }
  lines.push(hexRecord(0, 1, new Uint8Array()));
  return new TextEncoder().encode(`${lines.join('\n')}\n`);
}

describe('firmware image planning', () => {
  it('validates a BIN and aligns its transfer', () => {
    const plan = planFirmwareImage('application.bin', applicationBytes());
    expect(plan.firstSector).toBe(7);
    expect(plan.sectorCount).toBe(0x55);
    expect(plan.protectedMask).toBe(0);
    expect(plan.transferRegions).toHaveLength(1);
    expect(plan.transferRegions[0].data.length % 8).toBe(0);
  });

  it('detects only protected regions explicitly present in sparse HEX', () => {
    const plan = planFirmwareImage('application.hex', sparseApplicationHex(true));
    expect(plan.protectedMask).toBe(0x01);
    expect(plan.transferRegions.map(region => region.address))
      .toEqual([0x08007000, 0x08051000]);
  });

  it('uses the 55CG1024k erase plan and protected addresses', () => {
    const plan = planFirmwareImage(
      'application.hex',
      sparseApplicationHex(),
      STM32WB_55CG1024K_LAYOUT,
    );
    expect(plan.firstSector).toBe(7);
    expect(plan.sectorCount).toBe(0xc9);
    expect(plan.protectedMask).toBe(0);
    expect(STM32WB_55CG1024K_LAYOUT.protectedRegions[0].start).toBe(0x080c5000);
  });

  it('rejects a bad HEX checksum', () => {
    expect(() => parseIntelHex(new TextEncoder().encode(':00000001FE\n'))).toThrow('checksum');
  });

  it('rejects invalid application markers', () => {
    const image = applicationBytes();
    new DataView(image.buffer).setUint32(0x180, 0, true);
    expect(() => planFirmwareImage('bad.bin', image)).toThrow('Invalid OTA magic');
  });

  it('validates the metadata contract', () => {
    const metadata = parseFirmwareMetadata(JSON.stringify({
      schema: 1,
      algorithm: 'SHA256',
      normalization: 'IntelHexRangeFillFF-v1',
      systemProfile: '55CE512k',
      applicationInterfaceMajor: 1,
      ranges: [{
        start: '0x08007000',
        end: '0x08050FFF',
        sha256: 'a'.repeat(64),
      }],
    }));
    expect(metadata.systemProfile).toBe('55CE512k');
    expect(metadata.ranges[0].start).toBe(0x08007000);
  });

  it('parses the 55CG1024k profile used by current Pulse Senso firmware', () => {
    const metadata = parseFirmwareMetadata(JSON.stringify({
      schema: 1,
      algorithm: 'SHA256',
      normalization: 'IntelHexRangeFillFF-v1',
      systemProfile: '55CG1024k',
      applicationInterfaceMajor: 1,
      ranges: [{
        start: '0x08007000',
        end: '0x080C4FFF',
        sha256: 'b'.repeat(64),
      }],
    }));
    expect(metadata.systemProfile).toBe('55CG1024k');
    expect(metadata.ranges[0].end).toBe(0x080c4fff);
  });
});
