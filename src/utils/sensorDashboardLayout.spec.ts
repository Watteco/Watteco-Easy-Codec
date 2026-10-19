import { describe, expect, it } from 'vitest';
import { getSensorDashboardLayout } from '@/utils/sensorDashboardLayout';

describe('sensorDashboardLayout', () => {
  it('describes the Pulse SensO Neo dashboard', () => {
    const layout = getSensorDashboardLayout('50-70-260');

    expect(layout.displayMeasurements).toHaveLength(5);
    expect(layout.metricMeasurements).toHaveLength(4);
    expect(layout.stateMeasurements.map(measurement => measurement.id)).toEqual([
      'pin_state_1',
      'pin_state_2',
      'pin_state_3',
      'pin_state_4',
    ]);
    expect(layout.historyMeasurements).toHaveLength(5);
  });

  it('adapts to a single-input Pulse SensO Neo', () => {
    const layout = getSensorDashboardLayout('50-70-260-670');

    expect(layout.displayMeasurements.map(measurement => measurement.id)).toEqual([
      'disposable_battery_voltage',
      'index_1',
    ]);
    expect(layout.metricMeasurements.map(measurement => measurement.id)).toEqual(['index_1']);
    expect(layout.stateMeasurements.map(measurement => measurement.id)).toEqual(['pin_state_1']);
    expect(layout.historyMeasurements.map(measurement => measurement.id)).toEqual([
      'disposable_battery_voltage',
      'index_1',
    ]);
  });

  it('adapts to a product without state measurements', () => {
    const layout = getSensorDashboardLayout('50-70-260-672');

    expect(layout.displayMeasurements.map(measurement => measurement.id)).toEqual([
      'disposable_battery_voltage',
      'temperature_1',
      'temperature_2',
    ]);
    expect(layout.metricMeasurements.map(measurement => measurement.id)).toEqual([
      'temperature_1',
      'temperature_2',
    ]);
    expect(layout.stateMeasurements).toEqual([]);
    expect(layout.historyMeasurements.map(measurement => measurement.id)).toEqual([
      'disposable_battery_voltage',
      'temperature_1',
      'temperature_2',
    ]);
  });

  it('returns an empty layout for an unknown product', () => {
    expect(getSensorDashboardLayout('unknown')).toEqual({
      visibleMeasurements: [],
      displayMeasurements: [],
      metricMeasurements: [],
      stateMeasurements: [],
      historyMeasurements: [],
    });
  });
});
