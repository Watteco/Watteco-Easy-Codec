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

  it('shows and hides point details when a point is clicked', async () => {
    const timestamp = new Date(2026, 9, 12, 14, 35, 20).getTime();
    const wrapper = mount(SensorHistoryCard, {
      props: {
        label: 'Temperature',
        subtitle: 'Timestamped values',
        emptyLabel: 'No data',
        unit: '°C',
        decimals: 1,
        points: [{ timestamp, value: 21.26 }],
      },
    });

    const point = wrapper.get('.chart-point');
    expect(point.attributes('aria-pressed')).toBe('false');
    expect(wrapper.find('.chart-tooltip').exists()).toBe(false);

    await point.trigger('click');

    expect(point.attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('.chart-tooltip').text()).toContain(`${(21.3).toLocaleString()} °C`);
    expect(wrapper.get('.chart-tooltip').text()).toContain('2026');

    await point.trigger('click');

    expect(point.attributes('aria-pressed')).toBe('false');
    expect(wrapper.find('.chart-tooltip').exists()).toBe(false);
  });

  it('closes point details when the chart is clicked', async () => {
    const wrapper = mount(SensorHistoryCard, {
      props: {
        label: 'RSSI',
        subtitle: 'Timestamped values',
        emptyLabel: 'No data',
        points: [{ timestamp: Date.now(), value: -91 }],
        unit: 'dBm',
      },
    });

    await wrapper.get('.chart-point').trigger('click');
    expect(wrapper.find('.chart-tooltip').exists()).toBe(true);

    await wrapper.get('.chart').trigger('click');
    expect(wrapper.find('.chart-tooltip').exists()).toBe(false);
  });

  it('uses measurement numbers instead of dates in sequence mode', async () => {
    const wrapper = mount(SensorHistoryCard, {
      props: {
        label: 'RSSI',
        subtitle: 'Network test results',
        emptyLabel: 'No data',
        points: [
          { sequence: 2, value: -107 },
          { sequence: 4, value: -109 },
        ],
        unit: 'dBm',
        xAxisMode: 'sequence',
      },
    });

    expect(wrapper.findAll('.chart-axis span').map(label => label.text())).toEqual(['#2', '#4']);

    await wrapper.findAll('.chart-point')[1].trigger('click');

    expect(wrapper.get('.chart-tooltip').text()).toContain('#4');
    expect(wrapper.get('.chart-tooltip').text()).not.toContain('1970');
  });
});
