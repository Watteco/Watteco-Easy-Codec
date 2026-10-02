import { describe, expect, it } from 'vitest';
import {
  extractProductReference,
  getAvailableProductChoices,
  getProductConfigurationFile,
  getProductDisplayName,
  getProductMeasurements,
  resolveAvailableProductReference,
} from '@/utils/productMeasurements';
import { hasSensorVisual } from '@/utils/sensorVisuals';
import availableProductList from '../../public/config/AvailableProductList.json';

describe('productMeasurements', () => {
  it('defines compatibleProducts for every catalogue entry', () => {
    expect(availableProductList.products.every(product => (
      Array.isArray(product.compatibleProducts) && product.compatibleProducts.length > 0
    ))).toBe(true);
  });

  it('resolves the visual measurements consumed by Pulse SensO Neo', () => {
    const measurements = getProductMeasurements('50-70-260');
    const measIds = measurements.map(measurement => measurement.measId);

    expect(measIds).toContain(135);
    expect(new Set(measIds).size).toBe(measIds.length);

    const visibleMeasIds = measIds.filter(hasSensorVisual);
    expect(visibleMeasIds.filter(measId => measId >= 54 && measId <= 64).length).toBeGreaterThan(1);
    expect(measurements.filter(measurement => measurement.id.startsWith('pin_state_'))
      .map(measurement => measurement.id))
      .toEqual(['pin_state_1', 'pin_state_2', 'pin_state_3', 'pin_state_4']);
  });

  it('does not impose a fixed number of digital input states', () => {
    const stateIds = getProductMeasurements('50-70-016-005')
      .filter(measurement => measurement.id.startsWith('pin_state_'))
      .map(measurement => measurement.id);

    expect(stateIds).toHaveLength(10);
    expect(stateIds).toContain('pin_state_10');
  });

  it('extracts the public product reference', () => {
    expect(extractProductReference('Product 50-70-260 rev A')).toBe('50-70-260');
    expect(extractProductReference(undefined)).toBeNull();
  });

  it('resolves a BLE ProductID to the most specific available product', () => {
    expect(resolveAvailableProductReference('50-70-260-000')).toBe('50-70-260');
    expect(resolveAvailableProductReference('50-70-016-005')).toBe('50-70-016-005');
    expect(resolveAvailableProductReference('50-70-016-006')).toBeNull();
    expect(resolveAvailableProductReference('50-70-999-000')).toBeNull();
    expect(resolveAvailableProductReference('unknown')).toBeNull();
  });

  it('prefers an exact revision over a revision-agnostic match', () => {
    expect(resolveAvailableProductReference('50-70-017-004')).toBe('50-70-017-004');
    expect(resolveAvailableProductReference('50-70-017-006')).toBe('50-70-017');
  });

  it('matches all revisions only when compatibleProducts omits the revision', () => {
    expect(getProductDisplayName('50-70-101-000')).toBe("Ventil'O");
    expect(getProductDisplayName('50-70-101-999')).toBe("Ventil'O");
    expect(getProductMeasurements('50-70-016-006')).toEqual([]);
  });

  it('lists existing products for the debug selector', () => {
    expect(getAvailableProductChoices()).toContainEqual(expect.objectContaining({
      reference: '50-70-260',
    }));
  });

  it('resolves the Easy Codec configuration file from a product reference', () => {
    expect(getProductConfigurationFile('50-70-260')).toBe('50-70-260-PulseSensoNeoTest');
    expect(getProductConfigurationFile('50-70-260-000')).toBe('50-70-260-PulseSensoNeoTest');
    expect(getProductConfigurationFile('unknown')).toBeNull();
    expect(getProductConfigurationFile(null)).toBeNull();
  });

  it('resolves the human-readable sensor name', () => {
    expect(getProductDisplayName('50-70-205')).toBe("HygroTemp'O");
    expect(getProductDisplayName('50-70-014')).toBe("Pulse Sens'O");
    expect(getProductDisplayName('unknown')).toBeNull();
  });
});
