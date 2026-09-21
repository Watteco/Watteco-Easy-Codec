import { describe, expect, it } from 'vitest';
import {
  extractProductReference,
  getAvailableProductChoices,
  getProductMeasurements,
} from '@/utils/productMeasurements';
import { hasSensorVisual } from '@/utils/sensorVisuals';

describe('productMeasurements', () => {
  it('resolves the visual measurements consumed by Pulse SensO Neo', () => {
    const measurements = getProductMeasurements('50-70-451');
    const measIds = measurements.map(measurement => measurement.measId);

    expect(measIds).toContain(54);
    expect(measIds).toContain(64);
    expect(measIds).toContain(135);
    expect(new Set(measIds).size).toBe(measIds.length);

    const visibleMeasIds = measIds.filter(hasSensorVisual);
    expect(visibleMeasIds.filter(measId => measId >= 54 && measId <= 64)).toHaveLength(11);
  });

  it('extracts the public product reference', () => {
    expect(extractProductReference('Product 50-70-451 rev A')).toBe('50-70-451');
    expect(extractProductReference(undefined)).toBeNull();
  });

  it('lists existing products for the debug selector', () => {
    expect(getAvailableProductChoices()).toContainEqual(expect.objectContaining({
      reference: '50-70-451',
    }));
  });
});
