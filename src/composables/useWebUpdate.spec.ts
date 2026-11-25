import { describe, expect, it } from 'vitest';
import { buildWebUpdateUrl, parseVersionManifest } from './useWebUpdate';

describe('web update manifest', () => {
  it('accepts a published version', () => {
    expect(parseVersionManifest({ version: '1.2.3' })).toEqual({ version: '1.2.3' });
  });

  it.each([
    null,
    {},
    { version: '' },
    { version: 18 },
  ])('rejects an invalid manifest', (manifest) => {
    expect(parseVersionManifest(manifest)).toBeUndefined();
  });
});

describe('web update URL', () => {
  it('preserves the current route, selected sensor and pending shared configuration', () => {
    const updatedUrl = buildWebUpdateUrl(
      'https://support.watteco.com/Tools/EasyCodec/tabs/downlink?sensor=50-70-206-Flash%27O-3-probes#config=v1.abc',
      '0.11.27',
    );

    expect(updatedUrl).toBe(
      'https://support.watteco.com/Tools/EasyCodec/tabs/downlink?sensor=50-70-206-Flash%27O-3-probes&update=0.11.27#config=v1.abc',
    );
  });

  it('replaces the previous update parameter during a retry', () => {
    const updatedUrl = buildWebUpdateUrl(
      'https://support.watteco.com/Tools/EasyCodec/tabs/uplink?update=0.11.27',
      '0.11.27-123',
    );

    expect(updatedUrl).toBe('https://support.watteco.com/Tools/EasyCodec/tabs/uplink?update=0.11.27-123');
  });
});
