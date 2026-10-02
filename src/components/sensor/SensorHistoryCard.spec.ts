import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SensorHistoryCard from '@/components/sensor/SensorHistoryCard.vue';

describe('SensorHistoryCard', () => {
  it('uses the displayed precision to position chart points', () => {
    const wrapper = mount(SensorHistoryCard, {
      props: {
        label: 'Temperature',
        subtitle: 'Timestamped values',
        emptyLabel: 'No data',
        decimals: 1,
        points: [
          { timestamp: 1, value: 27.51 },
          { timestamp: 2, value: 27.54 },
          { timestamp: 3, value: 27.56 },
        ],
      },
    });

    const points = wrapper.findAll('.chart-point');

    expect(points[0].attributes('style')).toContain('top: 92%');
    expect(points[1].attributes('style')).toContain('top: 92%');
    expect(points[2].attributes('style')).toContain('top: 50%');
  });

  it('centers a flat series between distinct axis labels', () => {
    const wrapper = mount(SensorHistoryCard, {
      props: {
        label: 'Temperature',
        subtitle: 'Timestamped values',
        emptyLabel: 'No data',
        decimals: 1,
        points: [
          { timestamp: 1, value: 27.71 },
          { timestamp: 2, value: 27.72 },
          { timestamp: 3, value: 27.73 },
        ],
      },
    });

    const axisLabels = wrapper.findAll('.chart-y-axis span').map(label => label.text());
    const pointHeights = wrapper.findAll('.chart-point')
      .map(point => point.attributes('style')?.match(/top: ([^;]+)/)?.[1]);

    expect(new Set(axisLabels).size).toBe(3);
    expect(new Set(pointHeights).size).toBe(1);
    expect(Number.parseFloat(pointHeights[0] ?? '')).toBeCloseTo(50);
  });

  it('keeps axis labels distinct when values span a single precision step', () => {
    const wrapper = mount(SensorHistoryCard, {
      props: {
        label: 'Temperature',
        subtitle: 'Timestamped values',
        emptyLabel: 'No data',
        decimals: 1,
        points: [
          { timestamp: 1, value: 27.7 },
          { timestamp: 2, value: 27.6 },
          { timestamp: 3, value: 27.7 },
        ],
      },
    });

    const axisLabels = wrapper.findAll('.chart-y-axis span').map(label => label.text());

    expect(new Set(axisLabels).size).toBe(3);
  });
});
