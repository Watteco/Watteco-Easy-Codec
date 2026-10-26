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
import pt1000NeoConfig from '../../public/config/50-70-307-Temp\'O-Neo-PT1000.json';

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

  it('exposes only one pulse input for the legacy Pulse SensO Lite Neo reference', () => {
    const measurements = getProductMeasurements('50-70-260-670');

    expect(measurements.filter(measurement => measurement.id.startsWith('index_'))
      .map(measurement => measurement.id)).toEqual(['index_1']);
    expect(measurements.filter(measurement => measurement.id.startsWith('pin_state_'))
      .map(measurement => measurement.id)).toEqual(['pin_state_1']);
    expect(measurements.some(measurement => measurement.id === 'multi_state')).toBe(true);
    expect(measurements.some(measurement => measurement.id === 'temperature')).toBe(false);
    expect(measurements.some(measurement => measurement.id === 'humidity')).toBe(false);
  });

  it('exposes both temperature occurrences and battery but no pulse input for PT1000 Neo', () => {
    const product = availableProductList.products.find(candidate => (
      candidate.compatibleProducts.includes('50-70-260-672')
    ));
    const measurements = getProductMeasurements('50-70-260-672');
    const measurementIds = measurements.map(measurement => measurement.id);

    expect(product?.mId).toEqual(['tempo-neo-pt1000']);
    expect(measurementIds).toContain('temperature_1');
    expect(measurementIds).toContain('temperature_2');
    expect(measurementIds).not.toContain('temperature');
    expect(measurementIds).toContain('battery_voltage');
    expect(measurementIds).not.toContain('humidity');
    expect(measurementIds.some(id => id.startsWith('index_'))).toBe(false);
    expect(measurementIds.some(id => id.startsWith('pin_state_'))).toBe(false);
    expect(measurementIds).not.toContain('multi_state');
  });

  it('uses display-friendly measurement units', () => {
    const measurements = getProductMeasurements('50-70-260-672');

    expect(measurements.find(measurement => measurement.id === 'temperature_1')?.unit).toBe('°C');
    expect(measurements.find(measurement => measurement.id === 'battery_voltage')?.unit).toBe('V');
  });

  it('configures PT1000 Neo without pulse or binary input sections', () => {
    expect(pt1000NeoConfig.blob_only_configurations).toEqual([[
      '11 05 8004 0000 08 00',
      '11 50 00 50 02 03',
      '11 02 0050 FB1E 41 0D 01 1E 05 0078 00FA 0032 01F4 003C',
      '11 06 0402 15 0000 00 800A 803C 0000 000A 03',
      '31 06 0402 15 0000 00 800A 803C 0000 000A 0B',
      '11 06 0050 15 0006 04 85A0 85A0 0000 0064 33',
    ]]);
    expect(Object.keys(pt1000NeoConfig.batch_params)).toEqual([
      'batch_T_params',
      'batch_B_params',
      'global_params',
      'cfg_block',
    ]);
    expect(Object.keys(pt1000NeoConfig.standard_params)).toEqual([
      'standard_T_params',
      'standard_T2_params',
      'standard_B_params',
      'cfg_block',
    ]);
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
    expect(resolveAvailableProductReference('50-70-260-670')).toBe('50-70-260-670');
    expect(getProductDisplayName('50-70-260-670')).toBe("Pulse Sens'O Lite Neo");
    expect(getProductConfigurationFile('50-70-260-670')).toBe("50-70-304-Pulse-Sens'O-Lite-Neo");
    expect(resolveAvailableProductReference('50-70-260-671')).toBe('50-70-260-671');
    expect(getProductDisplayName('50-70-260-671')).toBe("HygroTemp'O Neo");
    expect(getProductConfigurationFile('50-70-260-671')).toBe("50-70-260-671-HygroTemp'O-Neo");
    expect(resolveAvailableProductReference('50-70-260-672')).toBe('50-70-260-672');
    expect(getProductDisplayName('50-70-260-672')).toBe("Temp'O Neo PT1000");
    expect(getProductConfigurationFile('50-70-260-672')).toBe('50-70-307-Temp\'O-Neo-PT1000');
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

  it('lists the Neo range first in the debug selector', () => {
    const choices = getAvailableProductChoices();
    const neoChoices = choices.filter(choice => /\bneo\b/i.test(choice.label));

    expect(choices.slice(0, neoChoices.length)).toEqual(neoChoices);
    expect(neoChoices.map(choice => choice.label)).toEqual([
      "HygroTemp'O Neo (50-70-260-671)",
      "Pulse Sens'O Lite Neo (50-70-304)",
      "Pulse Sens'O Neo (50-70-260)",
      "Temp'O Neo PT1000 (50-70-307)",
    ]);
  });

  it('resolves the Easy Codec configuration file from a product reference', () => {
    expect(getProductConfigurationFile('50-70-260')).toBe("50-70-260-Pulse-Sens'O-Neo");
    expect(getProductConfigurationFile('50-70-260-000')).toBe("50-70-260-Pulse-Sens'O-Neo");
    expect(getProductConfigurationFile('unknown')).toBeNull();
    expect(getProductConfigurationFile(null)).toBeNull();
  });

  it('resolves the human-readable sensor name', () => {
    expect(getProductDisplayName('50-70-205')).toBe("HygroTemp'O");
    expect(getProductDisplayName('50-70-014')).toBe("Pulse Sens'O");
    expect(getProductDisplayName('unknown')).toBeNull();
  });
});
