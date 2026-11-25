import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gzipSync, strToU8 } from 'fflate';
import {
  buildSharedConfigurationHash,
  copySharedConfigurationLink,
  decodeSharedConfiguration,
  encodeSharedConfiguration,
  readSharedConfigurationToken,
} from '@/utils/sharedConfigurationLink';
import type { SavedConfiguration } from '@/utils/savedConfigurations';

const configuration: SavedConfiguration = {
  format: 'watteco-easy-codec-configuration',
  schemaVersion: 1,
  id: 'shared',
  name: 'Shared configuration',
  createdAt: '',
  updatedAt: '',
  product: { configurationFile: "50-70-260-Pulse-Sens'O-Neo" },
  sections: {
    batch_params: {
      enabled: true,
      groups: {
        batch_P1_params: {
          enabled: true,
          fields: { p1BatchEchant: { value: '60' } },
        },
      },
    },
  },
};

describe('sharedConfigurationLink', () => {
  it('round-trips one configuration through a compact URL-safe token', () => {
    const token = encodeSharedConfiguration(configuration);
    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    expect(decodeSharedConfiguration(token, configuration.product.configurationFile))
      .toEqual(configuration);
    expect(decodeSharedConfiguration(token)).toBeNull();
  });

  it('keeps reading links generated with the original complete payload', () => {
    const compressed = gzipSync(strToU8(JSON.stringify(configuration)), { level: 9 });
    let binary = '';
    compressed.forEach((byte: number) => { binary += String.fromCharCode(byte); });
    const legacyToken = `v1.${btoa(binary)}`
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    expect(decodeSharedConfiguration(legacyToken)).toEqual(configuration);
  });

  it('reads and writes the configuration fragment', () => {
    const token = encodeSharedConfiguration(configuration);
    const hash = buildSharedConfigurationHash(token);
    expect(readSharedConfigurationToken(hash)).toBe(token);
    expect(buildSharedConfigurationHash(null)).toBe('');
  });

  it('rejects unsupported, malformed, and structurally invalid payloads', () => {
    expect(decodeSharedConfiguration('v2.abc')).toBeNull();
    expect(decodeSharedConfiguration('v1.not+url-safe')).toBeNull();
    expect(decodeSharedConfiguration('v1.abc')).toBeNull();
  });
});

describe('copySharedConfigurationLink', () => {
  const url = 'https://example.test/?sensor=alto#config=v1.example';
  const copyCommand = vi.fn();
  const originalCopyCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');

  beforeEach(() => {
    copyCommand.mockReset();
    Object.defineProperty(document, 'execCommand', { configurable: true, value: copyCommand });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalCopyCommand) {
      Object.defineProperty(document, 'execCommand', originalCopyCommand);
    } else {
      Reflect.deleteProperty(document, 'execCommand');
    }
  });

  it('uses the Clipboard API when it can copy the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    expect(await copySharedConfigurationLink(url)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(url);
    expect(copyCommand).not.toHaveBeenCalled();
  });

  it('copies the full selected link with the fallback when the Clipboard API denies access', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) } });
    copyCommand.mockImplementation(() => {
      const field = document.activeElement as HTMLTextAreaElement;
      return field.value.slice(field.selectionStart, field.selectionEnd) === url;
    });

    expect(await copySharedConfigurationLink(url)).toBe(true);
    expect(copyCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('reports failure for manual copying when the Clipboard API is absent and the fallback fails', async () => {
    vi.stubGlobal('navigator', {});
    copyCommand.mockReturnValue(false);

    expect(await copySharedConfigurationLink(url)).toBe(false);
    expect(copyCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
