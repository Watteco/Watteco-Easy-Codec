import CryptoJS from 'crypto-js';

const LABEL = 'WATTECO-BLE-OSA-V1';
const BLOCK_SIZE = 16;

function uint8ToWordArray(u8: Uint8Array) {
  const words: number[] = [];
  for (let i = 0; i < u8.length; i += 4) {
    words.push(
      ((u8[i] || 0) << 24) |
      ((u8[i + 1] || 0) << 16) |
      ((u8[i + 2] || 0) << 8) |
      ((u8[i + 3] || 0) << 0)
    );
  }
  return CryptoJS.lib.WordArray.create(words, u8.length);
}

function wordArrayToUint8(wordArray: CryptoJS.lib.WordArray): Uint8Array {
  const len = wordArray.sigBytes;
  const words = wordArray.words;
  const u8 = new Uint8Array(len);
  let offset = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    for (let b = 3; b >= 0; b--) {
      if (offset < len) {
        u8[offset++] = (w >>> (b * 8)) & 0xff;
      }
    }
  }
  return u8;
}

function xorBlock(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

function leftShiftOneBit(input: Uint8Array): Uint8Array {
  const out = new Uint8Array(input.length);
  let overflow = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    const b = input[i];
    out[i] = ((b << 1) & 0xff) | overflow;
    overflow = (b & 0x80) ? 1 : 0;
  }
  return out;
}

function aesEcbEncryptBlock(key16: Uint8Array, block16: Uint8Array): Uint8Array {
  const keyWA = uint8ToWordArray(key16);
  const dataWA = uint8ToWordArray(block16);
  const encrypted = CryptoJS.AES.encrypt(dataWA, keyWA, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.NoPadding });
  return wordArrayToUint8(encrypted.ciphertext as CryptoJS.lib.WordArray);
}

function aesCmac128(key16: Uint8Array, data: Uint8Array): Uint8Array {
  if (key16.length !== 16) throw new Error('key16 must be 16 bytes');

  const zeroBlock = new Uint8Array(16);
  const l = aesEcbEncryptBlock(key16, zeroBlock);
  const constRb = 0x87;

  const k1 = (() => {
    const ls = leftShiftOneBit(l);
    if ((l[0] & 0x80) !== 0) ls[ls.length - 1] ^= constRb;
    return ls;
  })();

  const k2 = (() => {
    const ls = leftShiftOneBit(k1);
    if ((k1[0] & 0x80) !== 0) ls[ls.length - 1] ^= constRb;
    return ls;
  })();

  const nBlocks = Math.ceil(data.length / BLOCK_SIZE) || 1;
  const blocks: Uint8Array[] = [];
  for (let i = 0; i < nBlocks; i++) {
    const start = i * BLOCK_SIZE;
    const end = Math.min(start + BLOCK_SIZE, data.length);
    const block = new Uint8Array(BLOCK_SIZE);
    block.set(data.slice(start, end));
    blocks.push(block);
  }

  let lastBlock = blocks[blocks.length - 1];
  if (data.length === 0 || (data.length % BLOCK_SIZE) !== 0) {
    const padded = new Uint8Array(BLOCK_SIZE);
    padded.set(lastBlock.slice(0, data.length % BLOCK_SIZE));
    padded[data.length % BLOCK_SIZE] = 0x80;
    lastBlock = xorBlock(padded, k2);
  } else {
    lastBlock = xorBlock(lastBlock, k1);
  }

  let x = new Uint8Array(BLOCK_SIZE);
  for (let i = 0; i < blocks.length - 1; i++) {
    const y = xorBlock(x, blocks[i]);
    x = aesEcbEncryptBlock(key16, y);
  }

  const y = xorBlock(x, lastBlock);
  return aesEcbEncryptBlock(key16, y);
}

export function deriveApskSp800108(otaAppKey16: Uint8Array, devEui8: Uint8Array): Uint8Array {
  if (otaAppKey16.length !== 16) throw new Error('otaAppKey16 must be 16 bytes');
  if (devEui8.length !== 8) throw new Error('devEui8 must be 8 bytes');

  const labelBytes = new TextEncoder().encode(LABEL);
  const msg = new Uint8Array(1 + labelBytes.length + 1 + 8 + 2);
  let idx = 0;
  msg[idx++] = 0x01;
  msg.set(labelBytes, idx); idx += labelBytes.length;
  msg[idx++] = 0x00;
  msg.set(devEui8, idx); idx += 8;
  msg[idx++] = 0x00;
  msg[idx++] = 0x80;

  return aesCmac128(otaAppKey16, msg);
}

export function computeOsaResp(otaAppKey16: Uint8Array, devEui8: Uint8Array, chal16: Uint8Array): Uint8Array {
  if (chal16.length !== 16) throw new Error('chal16 must be 16 bytes');
  const apsk = deriveApskSp800108(otaAppKey16, devEui8);
  return aesCmac128(apsk, chal16);
}