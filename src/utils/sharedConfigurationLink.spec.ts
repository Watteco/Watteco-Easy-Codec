import { describe, expect, it } from 'vitest';
import { gzipSync, strToU8 } from 'fflate';
import {
  buildSharedConfigurationHash,
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
