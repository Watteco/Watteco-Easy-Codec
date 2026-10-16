import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SensorMetricCard from '@/components/sensor/SensorMetricCard.vue';

const mountCounterCard = (props: Record<string, unknown> = {}) => mount(SensorMetricCard, {
  props: {
    label: 'Counter 1',
    value: 42,
    icon: 'speedometer',
    editable: true,
    editLabel: 'Set counter value',
    ...props,
  },
});

describe('SensorMetricCard counter editing', () => {
  it('requests the counter dialog without changing the card layout', async () => {
    const wrapper = mountCounterCard();

    await wrapper.get('.metric-card').trigger('click');

    expect(wrapper.emitted('edit')).toHaveLength(1);
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.find('.metric-edit-indicator').exists()).toBe(true);
  });

  it('disables the card action while an update is running', async () => {
    const wrapper = mountCounterCard({ updating: true });

    await wrapper.get('.metric-card').trigger('click');

    expect(wrapper.emitted('edit')).toBeUndefined();
    expect(wrapper.get('.metric-card').attributes('aria-disabled')).toBe('true');
    expect(wrapper.find('ion-spinner').exists()).toBe(true);
  });

  it('does not show an edit action on ordinary metric cards', () => {
    const wrapper = mountCounterCard({ editable: false });

    expect(wrapper.find('.metric-edit-indicator').exists()).toBe(false);
    expect(wrapper.get('.metric-card').attributes('role')).toBeUndefined();
  });

  it('opens the dialog with the keyboard', async () => {
    const wrapper = mountCounterCard();

    await wrapper.get('.metric-card').trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('edit')).toHaveLength(1);
  });

  it('keeps the complete localized uint32 value available to the responsive fitter', () => {
    const value = 4294967295;
    const wrapper = mountCounterCard({ value });
    const displayedValue = wrapper.get('.metric-value span');

    expect(displayedValue.text()).toBe(value.toLocaleString());
    expect(displayedValue.attributes('title')).toBe(value.toLocaleString());
    expect(displayedValue.classes()).toContain('metric-value__number--uint32-max-length');
  });

  it('applies a safe initial size to a nine-digit counter before WebView measurement', () => {
    const value = 111111111;
    const wrapper = mountCounterCard({ value });

    expect(wrapper.get('.metric-value span').classes())
      .toContain('metric-value__number--very-long');
  });

  it('applies the smallest size to a ten-digit uint32 counter', () => {
    const value = 1111111111;
    const wrapper = mountCounterCard({ value });
    const displayedValue = wrapper.get('.metric-value span');

    expect(displayedValue.text()).toBe(value.toLocaleString());
    expect(displayedValue.classes()).toContain('metric-value__number--uint32-max-length');
  });
});
