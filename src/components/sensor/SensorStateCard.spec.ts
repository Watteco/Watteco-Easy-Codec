import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import SensorStateCard from '@/components/sensor/SensorStateCard.vue';

const mountCard = (preferenceKey = 'sensor-a') => mount(SensorStateCard, {
  props: {
    label: 'States',
    activeLabel: 'Active',
    inactiveLabel: 'Inactive',
    settingsLabel: 'Configure state display',
    settingsTitle: 'State display',
    mappingLabel: 'Color mapping',
    invertLabel: 'Invert display',
    settingsNote: 'Only the display changes.',
    closeLabel: 'Close',
    highLabel: 'High (1)',
    lowLabel: 'Low (0)',
    preferenceKey,
    entries: [
      { measId: 21, label: '1', value: true },
      { measId: 23, label: '2', value: false },
    ],
  },
  global: {
    stubs: {
      IonModal: {
        props: ['isOpen'],
        template: '<div class="ion-modal-stub" :data-open="String(isOpen)"><slot /></div>',
      },
    },
  },
});

describe('SensorStateCard state display settings', () => {
  beforeEach(() => localStorage.clear());

  it('opens a touch-accessible settings sheet that shows the actual mapping', async () => {
    const wrapper = mountCard('mapping-open');

    await wrapper.get('.state-settings-button').trigger('click');

    expect(wrapper.get('.ion-modal-stub').attributes('data-open')).toBe('true');
    expect(wrapper.findAll('.state-settings__value').map(value => value.text()))
      .toEqual(['High (1)', 'Low (0)']);
  });

  it('inverts only the visual mapping and keeps the real state labels explicit', async () => {
    const wrapper = mountCard('mapping-invert');

    expect(wrapper.findAll('.state-item')[0].classes()).toContain('state-item--active');
    await wrapper.get('.state-settings__invert').trigger('click');

    expect(wrapper.findAll('.state-item')[0].classes()).toContain('state-item--inactive');
    expect(wrapper.findAll('.state-item')[1].classes()).toContain('state-item--active');
    expect(wrapper.findAll('.state-settings__value').map(value => value.text()))
      .toEqual(['High (1)', 'Low (0)']);
    expect(wrapper.findAll('.state-item')[0].attributes('aria-label')).toBe('1: Active');
  });

  it('stores the inversion separately for each sensor', async () => {
    const firstSensor = mountCard('sensor-a');
    await firstSensor.get('.state-settings__invert').trigger('click');

    expect(localStorage.getItem('easycodec.stateVisualInverted.sensor-a')).toBe('true');
    expect(mountCard('sensor-a').findAll('.state-item')[0].classes()).toContain('state-item--inactive');
    expect(mountCard('sensor-b').findAll('.state-item')[0].classes()).toContain('state-item--active');
  });
});
