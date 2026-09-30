import { describe, expect, it } from 'vitest';
import {
  extractProductReference,
  getAvailableProductChoices,
  getProductConfigurationFile,
  getProductDisplayName,
  getProductMeasurements,
} from '@/utils/productMeasurements';
import { hasSensorVisual } from '@/utils/sensorVisuals';

describe('productMeasurements', () => {
  it('resolves the visual measurements consumed by Pulse SensO Neo', () => {
    const measurements = getProductMeasurements('50-70-451');
    const measIds = measurements.map(measurement => measurement.measId);

    expect(measIds).toContain(135);
    expect(new Set(measIds).size).toBe(measIds.length);

    const visibleMeasIds = measIds.filter(hasSensorVisual);
    expect(visibleMeasIds.filter(measId => measId >= 54 && measId <= 64).length).toBeGreaterThan(1);
    expect(measurements.filter(measurement => measurement.id.startsWith('pin_state_'))
      .map(measurement => measurement.id))
      .toEqual(['pin_state_1', 'pin_state_2', 'pin_state_3']);
  });

  it('does not impose a fixed number of digital input states', () => {
    const stateIds = getProductMeasurements('50-70-016-005')
      .filter(measurement => measurement.id.startsWith('pin_state_'))
      .map(measurement => measurement.id);

    expect(stateIds).toHaveLength(10);
    expect(stateIds).toContain('pin_state_10');
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

  it('resolves the Easy Codec configuration file from a product reference', () => {
    expect(getProductConfigurationFile('50-70-451')).toBe('50-70-451-PulseSensoNeoTest');
    expect(getProductConfigurationFile('unknown')).toBeNull();
    expect(getProductConfigurationFile(null)).toBeNull();
  });

  it('resolves the human-readable sensor name', () => {
    expect(getProductDisplayName('50-70-205')).toBe("HygroTemp'O");
    expect(getProductDisplayName('50-70-014')).toBe("Pulse Sens'O");
    expect(getProductDisplayName('unknown')).toBeNull();
  });
});
