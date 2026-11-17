import { describe, expect, it } from 'vitest';
import { parseVersionManifest } from './useWebUpdate';

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
