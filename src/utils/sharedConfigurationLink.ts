import { gzipSync, gunzipSync, strFromU8, strToU8 } from 'fflate';
import { parseSavedConfiguration, type SavedConfiguration } from '@/utils/savedConfigurations';

export const SHARED_CONFIGURATION_FRAGMENT_KEY = 'config';
export const SHARED_CONFIGURATION_TOKEN_VERSION = 'v1';

const MAX_ENCODED_BYTES = 100_000;
const MAX_DECOMPRESSED_BYTES = 1_000_000;

type SharedConfigurationPayload = {
  v: 1;
  s: SavedConfiguration['sections'];
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const base64UrlToBytes = (value: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    if (binary.length > MAX_ENCODED_BYTES) return null;
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch {
    return null;
  }
};

const readGzipUncompressedSize = (bytes: Uint8Array): number | null => {
  if (bytes.length < 4) return null;
  const offset = bytes.length - 4;
  return (
    bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)
  ) >>> 0;
};

export const encodeSharedConfiguration = (configuration: SavedConfiguration): string => {
  const payload: SharedConfigurationPayload = {
    v: 1,
    s: configuration.sections,
  };
  const compressed = gzipSync(strToU8(JSON.stringify(payload)), { level: 9 });
  return `${SHARED_CONFIGURATION_TOKEN_VERSION}.${bytesToBase64Url(compressed)}`;
};

export const decodeSharedConfiguration = (
  token: string,
  productConfigurationFile?: string | null,
): SavedConfiguration | null => {
  const [version, encoded, ...extra] = token.split('.');
  if (version !== SHARED_CONFIGURATION_TOKEN_VERSION || !encoded || extra.length > 0) return null;
  const compressed = base64UrlToBytes(encoded);
  if (!compressed) return null;
  const uncompressedSize = readGzipUncompressedSize(compressed);
  if (uncompressedSize === null || uncompressedSize > MAX_DECOMPRESSED_BYTES) return null;

  try {
    const serialized = strFromU8(gunzipSync(compressed));
    if (serialized.length > MAX_DECOMPRESSED_BYTES) return null;
    const legacyConfiguration = parseSavedConfiguration(serialized);
    if (legacyConfiguration) return legacyConfiguration;

    const payload: unknown = JSON.parse(serialized);
    if (
      !productConfigurationFile
      || !isRecord(payload)
      || payload.v !== 1
      || !isRecord(payload.s)
    ) return null;

    return parseSavedConfiguration(JSON.stringify({
      format: 'watteco-easy-codec-configuration',
      schemaVersion: 1,
      id: 'shared',
      name: 'Shared configuration',
      createdAt: '',
      updatedAt: '',
      product: { configurationFile: productConfigurationFile },
      sections: payload.s,
    }));
  } catch {
    return null;
  }
};

export const readSharedConfigurationToken = (hash: string): string | null => {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get(
    SHARED_CONFIGURATION_FRAGMENT_KEY,
  );
  return value?.trim() || null;
};

export const buildSharedConfigurationHash = (token: string | null): string => (
  token ? `#${SHARED_CONFIGURATION_FRAGMENT_KEY}=${encodeURIComponent(token)}` : ''
);

export const copySharedConfigurationLink = async (url: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // Embedded pages can be denied access to the Clipboard API.
    }
  }

  if (typeof document.execCommand !== 'function') return false;
  const previousFocus = document.activeElement;
  const field = document.createElement('textarea');
  field.value = url;
  field.readOnly = true;
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);

  try {
    field.focus({ preventScroll: true });
    field.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  }
};
