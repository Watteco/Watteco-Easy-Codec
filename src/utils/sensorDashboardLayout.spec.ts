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
