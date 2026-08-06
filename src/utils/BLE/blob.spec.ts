import { describe, expect, it } from 'vitest';
import {
  buildBlobChunk,
  buildBlobCommand,
  buildConfigurationBlob,
  crc32,
  formatConfigurationBlob,
  parseBlobData,
  parseBlobStatus,
} from './blob';

describe('Watteco Admin BLOB protocol', () => {
  it('encodes configuration lines and the terminal marker', () => {
    expect(Array.from(buildConfigurationBlob(['11 05', 'aa']))).toEqual([
      0x02, 0x11, 0x05, 0x01, 0xaa, 0xff,
    ]);
  });

  it('rejects malformed configuration frames', () => {
    expect(() => buildConfigurationBlob(['11 XX 05'])).toThrow(/Invalid hexadecimal frame/);
    expect(() => buildConfigurationBlob([])).toThrow(/no frames/);
  });

  it('computes the standard CRC32 vector', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('uses the firmware little-endian command and chunk layouts', () => {
    expect(Array.from(buildBlobCommand(0x02, 0x00020001, 6, 0x12345678, 1))).toEqual([
      0x02, 0x01, 0x00, 0x00, 0x01, 0x00, 0x02, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00,
      0x78, 0x56, 0x34, 0x12,
    ]);
    expect(Array.from(buildBlobChunk(2, true, 5, new Uint8Array([0xaa])))).toEqual([
      0x02, 0x00, 0x01, 0x00, 0x05, 0x00, 0x00, 0x00, 0xaa,
    ]);
  });

  it('decodes the 20-byte ObjStatus layout', () => {
    const raw = new Uint8Array(20);
    const view = new DataView(raw.buffer);
    view.setUint8(0, 4);
    view.setUint16(2, 156, true);
    view.setUint32(4, 0x00020001, true);
    view.setUint32(8, 42, true);
    view.setUint32(12, 42, true);
    view.setUint32(16, 0x12345678, true);
    expect(parseBlobStatus(raw)).toEqual({
      state: 4, error: 0, attMtu: 156, objectId: 0x00020001,
      size: 42, transferred: 42, crc32: 0x12345678,
    });
  });

  it('decodes ObjData and formats configuration records like the Python tool', () => {
    const frame = parseBlobData(new Uint8Array([
      0x02, 0x00, 0x01, 0x00, 0x05, 0x00, 0x00, 0x00, 0xaa, 0xbb,
    ]));
    expect(frame.sequence).toBe(2);
    expect(frame.offset).toBe(5);
    expect(frame.isLast).toBe(true);
    expect(Array.from(frame.payload)).toEqual([0xaa, 0xbb]);

    expect(formatConfigurationBlob(new Uint8Array([
      0x02, 0x11, 0x05, 0x00, 0x01, 0xaa, 0xff,
    ]))).toEqual(['02 11 05', '00', '01 AA', 'FF']);
  });
});
