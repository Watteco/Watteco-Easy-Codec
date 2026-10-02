import { describe, expect, it } from 'vitest';
import { getSensorCardLabel, getSensorVisual } from '@/utils/sensorVisuals';

const localize = (key: string): string => ({
  '@batteryLevelLabel': 'Battery level',
  '@counterLabel': 'Counter',
  '@humidityLabel': 'Humidity',
  '@temperatureLabel': 'Temperature',
}[key] ?? key);

describe('sensorVisuals', () => {
  it('exposes the configured battery history scale', () => {
    expect(getSensorVisual(39)).toMatchObject({
      history: true,
      historyMin: 0,
      historyMax: 100,
    });
  });

  it('classifies digital input states for their specialized card', () => {
    expect(getSensorVisual(175)).toMatchObject({
      category: 'state',
      history: false,
      labelKey: '@PulseStateLabel',
      numbered: true,
    });
  });

  it('uses the short label configured for a card type', () => {
    expect(getSensorCardLabel(
      'disposable_battery_voltage',
      'Disposable battery voltage',
      getSensorVisual(39),
      localize,
    )).toBe('Battery level');
  });

  it('suffixes numbered measurements with their instance number', () => {
    expect(getSensorCardLabel(
      'index_2',
      'Pulse counter index 2',
      getSensorVisual(57),
      localize,
    )).toBe('Counter 2');

    expect(getSensorCardLabel(
      'temperature_1',
      'Temperature sensor 1',
      getSensorVisual(257),
      localize,
    )).toBe('Temperature 1');
  });

  it('does not invent a suffix for an unnumbered measurement', () => {
    expect(getSensorCardLabel(
      'index',
      'Pulse counter index',
      getSensorVisual(54),
      localize,
    )).toBe('Counter');
  });
});
