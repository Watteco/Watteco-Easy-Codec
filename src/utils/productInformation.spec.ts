import { describe, expect, it } from 'vitest';
import { getBundledProductImageUrl, getProductInformation } from '@/utils/productInformation';

describe('productInformation', () => {
  it('maps a BLE development ID to the bundled commercial product', () => {
    const information = getProductInformation('50-70-260-670');

    expect(information?.name).toContain('Pulse');
    expect(information?.image).toMatch(/^product-assets\/product-[a-f0-9]{12}\.webp$/);
    expect(information?.datasheets.fr).toContain('/50-70-304/pdf/fr');
  });

  it('does not expose external resources for the internal 671 test product', () => {
    const information = getProductInformation('50-70-260-671');

    expect(information?.name).toContain("HygroTemp'O Neo");
    expect(information?.image).toBeNull();
    expect(information?.datasheets.fr).toBeNull();
    expect(information?.support).toBeNull();
  });

  it('builds an application-relative URL for a bundled image', () => {
    expect(getBundledProductImageUrl('product-assets/sensor.webp'))
      .toBe(`${import.meta.env.BASE_URL}product-assets/sensor.webp`);
    expect(getBundledProductImageUrl(null)).toBeNull();
  });
});
