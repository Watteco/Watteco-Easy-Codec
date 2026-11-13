const FLASH_BASE = 0x08000000;
const FLASH_PAGE_SIZE = 0x1000;
const OTA_WRITE_ALIGNMENT = 8;
const OTA_MAGIC_POINTER_OFFSET = 0x140;
const OTA_MAGIC_VALUE = 0x94448a29;

export type FirmwareRegion = {
  address: number;
  data: Uint8Array;
};

type ProtectedRegion = {
  name: string;
  start: number;
  size: number;
  mask: number;
};

export type FirmwareMemoryLayout = {
  systemProfile: string;
  programStart: number;
  programEnd: number;
  reservedStart: number;
  reservedEnd: number;
  protectedRegions: readonly ProtectedRegion[];
};

export type FirmwareImagePlan = {
  fileName: string;
  sourceFormat: 'BIN' | 'Intel HEX';
  sourceSize: number;
  regions: readonly FirmwareRegion[];
  transferRegions: readonly FirmwareRegion[];
  protectedMask: number;
  firstSector: number;
  sectorCount: number;
  transferSize: number;
};

type FirmwareHashRange = {
  start: number;
  end: number;
  sha256: string;
};

export type FirmwareMetadata = {
  systemProfile: string;
  applicationInterfaceMajor: number;
  ranges: readonly FirmwareHashRange[];
};

export type FirmwareDryRunResult = {
  layout: FirmwareMemoryLayout;
  image: FirmwareImagePlan;
  metadata: FirmwareMetadata | null;
  metadataVerified: boolean;
};

export const STM32WB_55CE512K_LAYOUT: FirmwareMemoryLayout = {
  systemProfile: '55CE512k',
  programStart: 0x08007000,
  programEnd: 0x0805bfff,
  reservedStart: 0x0804c000,
  reservedEnd: 0x0805c000,
  protectedRegions: [
    { name: 'DEFAULT_CONF', start: 0x08051000, size: 0x0400, mask: 0x01 },
    { name: 'INFOD', start: 0x08052000, size: 0x0100, mask: 0x02 },
    { name: 'INFOC', start: 0x08053000, size: 0x0080, mask: 0x04 },
    { name: 'INFOB', start: 0x08054000, size: 0x0080, mask: 0x08 },
    { name: 'INFOA', start: 0x08055000, size: 0x0080, mask: 0x10 },
  ],
};

export const STM32WB_55CG1024K_LAYOUT: FirmwareMemoryLayout = {
  systemProfile: '55CG1024k',
  programStart: 0x08007000,
  programEnd: 0x080cffff,
  reservedStart: 0x080c0000,
  reservedEnd: 0x080d0000,
  protectedRegions: [
    { name: 'DEFAULT_CONF', start: 0x080c5000, size: 0x0400, mask: 0x01 },
    { name: 'INFOD', start: 0x080c6000, size: 0x0100, mask: 0x02 },
    { name: 'INFOC', start: 0x080c7000, size: 0x0080, mask: 0x04 },
    { name: 'INFOB', start: 0x080c8000, size: 0x0080, mask: 0x08 },
    { name: 'INFOA', start: 0x080c9000, size: 0x0080, mask: 0x10 },
  ],
};

export const FIRMWARE_MEMORY_LAYOUTS: Readonly<Record<string, FirmwareMemoryLayout>> = {
  [STM32WB_55CE512K_LAYOUT.systemProfile]: STM32WB_55CE512K_LAYOUT,
  [STM32WB_55CG1024K_LAYOUT.systemProfile]: STM32WB_55CG1024K_LAYOUT,
};

function hexAddress(value: number): string {
  return `0x${value.toString(16).padStart(8, '0').toUpperCase()}`;
}

function regionEnd(region: FirmwareRegion): number {
  return region.address + region.data.length;
}

function rangesFromAddresses(addresses: readonly number[]): Array<[number, number]> {
  if (addresses.length === 0) return [];
  const ranges: Array<[number, number]> = [];
  let start = addresses[0];
  let previous = start;
  for (const address of addresses.slice(1)) {
    if (address !== previous + 1) {
      ranges.push([start, previous + 1]);
      start = address;
    }
    previous = address;
  }
  ranges.push([start, previous + 1]);
  return ranges;
}

function regionsFromMemory(memory: ReadonlyMap<number, number>): FirmwareRegion[] {
  const addresses = Array.from(memory.keys()).sort((left, right) => left - right);
  return rangesFromAddresses(addresses).map(([start, end]) => {
    const data = new Uint8Array(end - start);
    for (let address = start; address < end; address++) data[address - start] = memory.get(address)!;
    return { address: start, data };
  });
}

export function parseIntelHex(raw: Uint8Array): Map<number, number> {
  if (raw.some(value => value > 0x7f)) throw new Error('Intel HEX is not ASCII');
  const lines = new TextDecoder('ascii').decode(raw).split(/\r?\n/);
  const memory = new Map<number, number>();
  let upper = 0;
  let eofSeen = false;

  for (let index = 0; index < lines.length; index++) {
    const text = lines[index].trim();
    if (!text) continue;
    const lineNumber = index + 1;
    if (!text.startsWith(':')) throw new Error(`Intel HEX line ${lineNumber}: missing ':'`);
    if (!/^[0-9a-f]+$/i.test(text.slice(1)) || text.length % 2 === 0) {
      throw new Error(`Intel HEX line ${lineNumber}: invalid hex`);
    }
    const record = Uint8Array.from(text.slice(1).match(/.{2}/g)!.map(value => Number.parseInt(value, 16)));
    if (record.length < 5 || record[0] + 5 !== record.length) {
      throw new Error(`Intel HEX line ${lineNumber}: invalid length`);
    }
    if ((record.reduce((sum, value) => sum + value, 0) & 0xff) !== 0) {
      throw new Error(`Intel HEX line ${lineNumber}: checksum mismatch`);
    }

    const count = record[0];
    const offset = (record[1] << 8) | record[2];
    const kind = record[3];
    const data = record.slice(4, 4 + count);
    if (kind === 0x00) {
      const baseAddress = upper + offset;
      data.forEach((value, dataIndex) => {
        const address = baseAddress + dataIndex;
        const previous = memory.get(address);
        if (previous !== undefined && previous !== value) {
          throw new Error(`Intel HEX conflicting data at ${hexAddress(address)}`);
        }
        memory.set(address, value);
      });
    } else if (kind === 0x01) {
      if (count !== 0) throw new Error(`Intel HEX line ${lineNumber}: invalid EOF`);
      eofSeen = true;
      break;
    } else if (kind === 0x02) {
      if (count !== 2) throw new Error(`Intel HEX line ${lineNumber}: invalid segment address`);
      upper = ((data[0] << 8) | data[1]) << 4;
    } else if (kind === 0x04) {
      if (count !== 2) throw new Error(`Intel HEX line ${lineNumber}: invalid linear address`);
      upper = ((data[0] << 8) | data[1]) * 0x10000;
    } else if (kind !== 0x03 && kind !== 0x05) {
      throw new Error(`Intel HEX line ${lineNumber}: unsupported type ${kind.toString(16).padStart(2, '0')}`);
    }
  }

  if (!eofSeen) throw new Error('Intel HEX EOF record is missing');
  if (memory.size === 0) throw new Error('Intel HEX contains no data');
  return memory;
}

function readRegionBytes(regions: readonly FirmwareRegion[], address: number, size: number): Uint8Array {
  const result = new Uint8Array(size);
  for (let index = 0; index < size; index++) {
    const currentAddress = address + index;
    const region = regions.find(candidate => (
      candidate.address <= currentAddress && currentAddress < regionEnd(candidate)
    ));
    if (!region) throw new Error(`Required firmware byte absent at ${hexAddress(currentAddress)}`);
    result[index] = region.data[currentAddress - region.address];
  }
  return result;
}

function readUint32Le(data: Uint8Array): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0, true);
}

function validateApplicationMarkers(
  regions: readonly FirmwareRegion[],
  layout: FirmwareMemoryLayout,
): void {
  const initialStackPointer = readUint32Le(readRegionBytes(regions, layout.programStart, 4));
  const resetHandler = readUint32Le(readRegionBytes(regions, layout.programStart + 4, 4));
  if (initialStackPointer < 0x20000000 || initialStackPointer > 0x20040000 || initialStackPointer % 4) {
    throw new Error(`Invalid Cortex-M initial stack pointer: ${hexAddress(initialStackPointer)}`);
  }
  const resetAddress = resetHandler & 0xfffffffe;
  if ((resetHandler & 1) === 0 || resetAddress < layout.programStart || resetAddress >= layout.reservedStart) {
    throw new Error(`Invalid application reset handler: ${hexAddress(resetHandler)}`);
  }
  const magicAddress = readUint32Le(
    readRegionBytes(regions, layout.programStart + OTA_MAGIC_POINTER_OFFSET, 4),
  );
  const magicValue = readUint32Le(readRegionBytes(regions, magicAddress, 4));
  if (magicValue !== OTA_MAGIC_VALUE) {
    throw new Error(
      `Invalid OTA magic at ${hexAddress(magicAddress)}: ${hexAddress(magicValue)}, expected ${hexAddress(OTA_MAGIC_VALUE)}`,
    );
  }
}

function validateImageAddresses(regions: readonly FirmwareRegion[], layout: FirmwareMemoryLayout): void {
  for (const region of regions) {
    if (region.address < layout.programStart || regionEnd(region) > layout.reservedEnd) {
      throw new Error(
        `Image range ${hexAddress(region.address)}..${hexAddress(regionEnd(region) - 1)} lies outside the selected platform layout`,
      );
    }
  }
}

function protectedMask(
  ranges: ReadonlyArray<readonly [number, number]>,
  layout: FirmwareMemoryLayout,
): number {
  return layout.protectedRegions.reduce((mask, protectedRegion) => {
    const protectedEnd = protectedRegion.start + protectedRegion.size;
    const present = ranges.some(([start, end]) => start < protectedEnd && end > protectedRegion.start);
    return present ? mask | protectedRegion.mask : mask;
  }, 0);
}

function alignTransferRegions(regions: readonly FirmwareRegion[]): FirmwareRegion[] {
  const aligned: FirmwareRegion[] = [];
  for (const region of regions) {
    const start = region.address & ~(OTA_WRITE_ALIGNMENT - 1);
    const end = (regionEnd(region) + OTA_WRITE_ALIGNMENT - 1) & ~(OTA_WRITE_ALIGNMENT - 1);
    const data = new Uint8Array(end - start).fill(0xff);
    data.set(region.data, region.address - start);
    const previous = aligned.at(-1);
    const samePage = previous !== undefined
      && Math.floor(start / FLASH_PAGE_SIZE) === Math.floor((regionEnd(previous) - 1) / FLASH_PAGE_SIZE);
    if (previous && (start <= regionEnd(previous) || samePage)) {
      aligned.pop();
      const mergedEnd = Math.max(regionEnd(previous), end);
      const merged = new Uint8Array(mergedEnd - previous.address).fill(0xff);
      merged.set(previous.data);
      merged.set(data, start - previous.address);
      aligned.push({ address: previous.address, data: merged });
    } else {
      aligned.push({ address: start, data });
    }
  }
  if (aligned.length === 0) throw new Error('Image contains no data that needs to be transferred');
  return aligned;
}

function makeTransferRegions(
  regions: readonly FirmwareRegion[],
  sourceFormat: FirmwareImagePlan['sourceFormat'],
): FirmwareRegion[] {
  if (sourceFormat !== 'BIN') return alignTransferRegions(regions);
  const raw = regions[0];
  const sparse: FirmwareRegion[] = [];
  for (let pageStart = raw.address; pageStart < regionEnd(raw); pageStart += FLASH_PAGE_SIZE) {
    const pageEnd = Math.min(pageStart + FLASH_PAGE_SIZE, regionEnd(raw));
    const data = raw.data.slice(pageStart - raw.address, pageEnd - raw.address);
    if (data.some(value => value !== 0xff)) sparse.push({ address: pageStart, data });
  }
  return alignTransferRegions(sparse);
}

export function planFirmwareImage(
  fileName: string,
  raw: Uint8Array,
  layout: FirmwareMemoryLayout = STM32WB_55CE512K_LAYOUT,
): FirmwareImagePlan {
  if (raw.length === 0) throw new Error('Firmware image is empty');
  const extension = fileName.toLowerCase().match(/\.[^.]+$/)?.[0];
  let sourceFormat: FirmwareImagePlan['sourceFormat'];
  let regions: FirmwareRegion[];
  let presentRanges: Array<[number, number]>;

  if (extension === '.hex' || extension === '.ihex') {
    const memory = parseIntelHex(raw);
    const addresses = Array.from(memory.keys()).sort((left, right) => left - right);
    sourceFormat = 'Intel HEX';
    presentRanges = rangesFromAddresses(addresses);
    regions = regionsFromMemory(memory);
  } else if (extension === '.bin') {
    const end = layout.programStart + raw.length;
    if (end > layout.reservedEnd) {
      throw new Error(`BIN ends at ${hexAddress(end - 1)}, beyond layout end ${hexAddress(layout.reservedEnd - 1)}`);
    }
    sourceFormat = 'BIN';
    presentRanges = [[layout.programStart, end]];
    regions = [{ address: layout.programStart, data: raw }];
  } else {
    throw new Error('Firmware extension must be .bin, .hex, or .ihex');
  }

  validateImageAddresses(regions, layout);
  validateApplicationMarkers(regions, layout);
  const transferRegions = makeTransferRegions(regions, sourceFormat);
  return {
    fileName,
    sourceFormat,
    sourceSize: raw.length,
    regions,
    transferRegions,
    protectedMask: protectedMask(presentRanges, layout),
    firstSector: (layout.programStart - FLASH_BASE) / FLASH_PAGE_SIZE,
    sectorCount: (layout.reservedEnd - layout.programStart) / FLASH_PAGE_SIZE,
    transferSize: transferRegions.reduce((total, region) => total + region.data.length, 0),
  };
}

function parseMetadataInteger(value: unknown, label: string): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 0)
      : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid ${label} in firmware metadata`);
  return parsed;
}

export function parseFirmwareMetadata(text: string): FirmwareMetadata {
  let document: any;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error('Invalid firmware metadata JSON');
  }
  if (
    document?.schema !== 1
    || document?.algorithm !== 'SHA256'
    || document?.normalization !== 'IntelHexRangeFillFF-v1'
  ) {
    throw new Error('Unsupported firmware metadata contract');
  }
  if (typeof document.systemProfile !== 'string' || !/^[a-z0-9_-]+$/i.test(document.systemProfile)) {
    throw new Error('Invalid systemProfile in firmware metadata');
  }
  if (!Number.isInteger(document.applicationInterfaceMajor) || document.applicationInterfaceMajor < 1) {
    throw new Error('Invalid applicationInterfaceMajor in firmware metadata');
  }
  if (!Array.isArray(document.ranges) || document.ranges.length === 0) {
    throw new Error('Firmware metadata contains no hash range');
  }

  let previousEnd = -1;
  const ranges = document.ranges.map((item: any, index: number): FirmwareHashRange => {
    const start = parseMetadataInteger(item?.start, `range ${index} start`);
    const end = parseMetadataInteger(item?.end, `range ${index} end`);
    const sha256 = item?.sha256;
    if (start > end || start <= previousEnd) {
      throw new Error(`Overlapping or unordered firmware metadata range ${index}`);
    }
    if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(sha256)) {
      throw new Error(`Invalid SHA-256 in firmware metadata range ${index}`);
    }
    previousEnd = end;
    return { start, end, sha256: sha256.toLowerCase() };
  });
  return {
    systemProfile: document.systemProfile,
    applicationInterfaceMajor: document.applicationInterfaceMajor,
    ranges,
  };
}

function validateMetadataLayout(metadata: FirmwareMetadata, layout: FirmwareMemoryLayout): void {
  if (metadata.systemProfile !== layout.systemProfile) {
    throw new Error(`Unsupported firmware system profile: ${metadata.systemProfile}`);
  }
  const defaultConfig = layout.protectedRegions.find(region => region.name === 'DEFAULT_CONF')!;
  if (
    metadata.ranges.length !== 1
    || metadata.ranges[0].start !== layout.programStart
    || metadata.ranges[0].end !== defaultConfig.start - 1
  ) {
    throw new Error(`Firmware metadata hash ranges do not match system profile ${layout.systemProfile}`);
  }
}

function bytesToHex(data: Uint8Array): string {
  return Array.from(data, value => value.toString(16).padStart(2, '0')).join('');
}

async function sha256(data: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 is unavailable on this platform');
  const digestInput = new Uint8Array(data).buffer;
  return bytesToHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', digestInput)));
}

async function verifyMetadataHash(
  fileName: string,
  raw: Uint8Array,
  metadata: FirmwareMetadata,
): Promise<void> {
  const extension = fileName.toLowerCase().match(/\.[^.]+$/)?.[0];
  const memory = extension === '.hex' || extension === '.ihex' ? parseIntelHex(raw) : null;
  if (!memory && extension !== '.bin') throw new Error('Metadata verification requires .bin, .hex, or .ihex');
  const binaryStart = metadata.ranges[0].start;

  for (const range of metadata.ranges) {
    const normalized = new Uint8Array(range.end - range.start + 1).fill(0xff);
    for (let address = range.start; address <= range.end; address++) {
      if (memory) {
        normalized[address - range.start] = memory.get(address) ?? 0xff;
      } else {
        const offset = address - binaryStart;
        if (offset >= 0 && offset < raw.length) normalized[address - range.start] = raw[offset];
      }
    }
    const actual = await sha256(normalized);
    if (actual !== range.sha256) {
      throw new Error(
        `Firmware SHA-256 mismatch for range ${hexAddress(range.start)}..${hexAddress(range.end)}`,
      );
    }
  }
}

export async function dryRunFirmwareImage(
  fileName: string,
  raw: Uint8Array,
  metadataText?: string,
): Promise<FirmwareDryRunResult> {
  const metadata = metadataText === undefined ? null : parseFirmwareMetadata(metadataText);
  const layout = metadata
    ? FIRMWARE_MEMORY_LAYOUTS[metadata.systemProfile]
    : STM32WB_55CE512K_LAYOUT;
  if (!layout) {
    throw new Error(
      `Unsupported firmware system profile: ${metadata!.systemProfile}; supported: ${Object.keys(FIRMWARE_MEMORY_LAYOUTS).join(', ')}`,
    );
  }
  if (metadata) {
    validateMetadataLayout(metadata, layout);
    await verifyMetadataHash(fileName, raw, metadata);
  }
  return {
    layout,
    image: planFirmwareImage(fileName, raw, layout),
    metadata,
    metadataVerified: metadata !== null,
  };
}

export function formatFirmwareDryRun(result: FirmwareDryRunResult): string[] {
  const { image, layout, metadataVerified } = result;
  return [
    `[FW dry-run] PASS: ${image.fileName}`,
    `[FW dry-run] Profile: ${layout.systemProfile}; metadata: ${metadataVerified ? 'verified' : 'absent'}`,
    `[FW dry-run] Format: ${image.sourceFormat}; source: ${image.sourceSize} bytes`,
    `[FW dry-run] Erase plan: first=${image.firstSector}, count=${image.sectorCount}, mask=0x${image.protectedMask.toString(16).padStart(2, '0').toUpperCase()}`,
    `[FW dry-run] Transfer: ${image.transferRegions.length} region(s), ${image.transferSize} bytes`,
    ...image.transferRegions.map((region, index) => (
      `[FW dry-run] Region ${index + 1}: ${hexAddress(region.address)}, ${region.data.length} bytes`
    )),
  ];
}
