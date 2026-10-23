import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import PatternInput from '@/components/PatternInput.vue';
import StateMappingIcon from '@/components/sensor/StateMappingIcon.vue';

const translations: Record<string, string> = {
  '@InputLabel': 'Input',
  '@patternLegendHelp': 'Show pattern legend',
  '@patternIgnored': 'Ignored',
  '@patternExpectedZero': 'Expected at 0',
  '@patternExpectedOne': 'Expected at 1',
  '@stateDisplayMappingLabel': 'State display mapping',
  '@highStateLabel': 'High (1)',
  '@lowStateLabel': 'Low (0)',
  '@invertStateDisplayLabel': 'Invert display',
  '@patternNoInputWarning': 'Select an input',
  '@patternPeriodicOnly': 'Periodic only',
};

const mountPattern = (preferenceKey: string) => mount(PatternInput, {
  props: {
    label: 'Expected input pattern',
    value: '1 3',
    bitCount: 3,
    stateVisualPreferenceKey: preferenceKey,
    localize: (key: string) => translations[key] ?? key,
  },
});

describe('PatternInput state display mapping', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the ignored state in the legend opened by the mapping icon', async () => {
    const wrapper = mountPattern('pattern-legend');

    await wrapper.get('.pattern-help').trigger('click');

    expect(wrapper.get('.pattern-state--ignored').text()).toContain('Ignored');
    expect(wrapper.getComponent(StateMappingIcon).props('inverted')).toBe(false);
  });

  it('updates the pattern colors and shared mini legend when the mapping is inverted', async () => {
    const wrapper = mountPattern('pattern-inverted');
    await wrapper.get('.pattern-help').trigger('click');

    const legendItems = wrapper.findAll('.pattern-legend__item');
    expect(legendItems[1].classes()).toContain('pattern-visual--inactive');
    expect(legendItems[2].classes()).toContain('pattern-visual--active');

    await wrapper.get('.pattern-display-setting__invert').trigger('click');

    expect(legendItems[1].classes()).toContain('pattern-visual--active');
    expect(legendItems[2].classes()).toContain('pattern-visual--inactive');
    expect(wrapper.getComponent(StateMappingIcon).props('inverted')).toBe(true);
    expect(localStorage.getItem('easycodec.stateVisualInverted.pattern-inverted')).toBe('true');
  });
});
