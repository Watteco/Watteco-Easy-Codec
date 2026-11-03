export const STM_OTA_SERVICE_UUID = '0000fe20-cc7a-482a-984a-7f2ed5b3e58f';
export const STM_OTA_BASE_ADDRESS_CHAR_UUID = '0000fe22-8e22-4541-9d4c-21edae82ed19';
export const STM_OTA_CONFIRMATION_CHAR_UUID = '0000fe23-8e22-4541-9d4c-21edae82ed19';
export const STM_OTA_RAW_DATA_CHAR_UUID = '0000fe24-8e22-4541-9d4c-21edae82ed19';

export const STM32WB_55CE512K_FIRST_SECTOR = 0x07;
export const STM32WB_55CE512K_SECTOR_COUNT = 0x55;
export const STM_OTA_FLASH_PAGE_SIZE = 4096;
export const STM_OTA_RAW_DATA_MAX = 248;

export const STM_OTA_UPDATE_PREPARED = 0x02;
export const STM_OTA_PAGE_ACK = 0x03;
export const STM_OTA_PAGE_RETRY = 0x04;
export const STM_OTA_REBOOT_CONFIRMED = 0x01;

export const STM_OTA_FAILURES: Readonly<Record<number, string>> = {
  0x71: 'invalid erase plan',
  0x72: 'Flash sector erase failed',
  0x73: 'INFOD restore failed',
  0x74: 'application validity marker write failed',
  0x75: 'invalid transfer address',
  0x76: 'Flash data write failed',
  0x77: 'invalid loader state',
  0x7f: 'unspecified loader failure',
};

function requireByte(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${name} must be an unsigned byte`);
  }
}

export function buildOtaRebootCommand(
  firstSector: number,
  sectorCount: number,
  regionMask: number,
): Uint8Array {
  requireByte('firstSector', firstSector);
  requireByte('sectorCount', sectorCount);
  requireByte('regionMask', regionMask);
  if (sectorCount === 0) throw new RangeError('sectorCount must not be zero');
  if (regionMask > 0x1f) throw new RangeError('regionMask must be between 0 and 0x1F');
  return Uint8Array.of(0x01, firstSector, sectorCount, regionMask);
}

export function buildPrepareCommand(
  firstSector: number,
  sectorCount: number,
  regionMask: number,
): Uint8Array {
  const rebootCommand = buildOtaRebootCommand(firstSector, sectorCount, regionMask);
  rebootCommand[0] = 0x09;
  return rebootCommand;
}

let crc32Table: Uint32Array | undefined;

function getCrc32Table(): Uint32Array {
  if (crc32Table) return crc32Table;
  crc32Table = new Uint32Array(256);
  for (let index = 0; index < crc32Table.length; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = (value & 1) !== 0 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    }
    crc32Table[index] = value >>> 0;
  }
  return crc32Table;
}

export function crc32(data: Uint8Array): number {
  const table = getCrc32Table();
  let value = 0xffffffff;
  for (const byte of data) value = (value >>> 8) ^ table[(value ^ byte) & 0xff];
  return (value ^ 0xffffffff) >>> 0;
}

export function buildBeginPageCommand(address: number, data: Uint8Array): Uint8Array {
  if (!Number.isInteger(address) || address < 0 || address > 0xffffffff) {
    throw new RangeError('address must be an unsigned 32-bit integer');
  }
  if (data.length < 1 || data.length > STM_OTA_FLASH_PAGE_SIZE || data.length % 8 !== 0) {
    throw new RangeError('page data must contain 8..4096 bytes, aligned to 8');
  }
  if (address % 8 !== 0 || (address % STM_OTA_FLASH_PAGE_SIZE) + data.length > STM_OTA_FLASH_PAGE_SIZE) {
    throw new RangeError('page transfer must be aligned and stay in one Flash page');
  }
  const command = new Uint8Array(10);
  command[0] = 0x0a;
  command[1] = (address >>> 16) & 0xff;
  command[2] = (address >>> 8) & 0xff;
  command[3] = address & 0xff;
  const view = new DataView(command.buffer);
  view.setUint16(4, data.length, true);
  view.setUint32(6, crc32(data), true);
  return command;
}

export function buildCommitPageCommand(): Uint8Array {
  return Uint8Array.of(0x0b);
}

export function buildFinishCommand(): Uint8Array {
  return Uint8Array.of(0x07, 0x00, 0x00, 0x00);
}

export function deriveOtaLoaderName(applicationName?: string): string | null {
  const normalizedName = applicationName?.trim();
  if (!normalizedName || normalizedName.toUpperCase().endsWith('.OTA')) return null;
  return `${normalizedName}.OTA`;
}
