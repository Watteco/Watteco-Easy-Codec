import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConfigurationFieldHelp from './ConfigurationFieldHelp.vue';

const mountHelp = (descriptions: string[]) => mount(ConfigurationFieldHelp, {
  props: { label: 'Recording period', helpLabel: 'Help', descriptions },
  global: { stubs: {
    IonIcon: true,
    IonPopover: {
      name: 'IonPopover',
      props: ['isOpen', 'event'],
      template: '<div class="popover" :data-open="isOpen"><slot /></div>',
    },
  } },
});

describe('ConfigurationFieldHelp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([true, false])('centers on mobile (%s) and anchors on larger screens', async (isMobile) => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: isMobile })));
    const wrapper = mountHelp(['Records the counter']);
    await wrapper.get('button').trigger('click');
    const event = wrapper.findComponent({ name: 'IonPopover' }).props('event');
    if (isMobile) expect(event).toBeUndefined();
    else expect(event).toBeInstanceOf(Event);
  });

  it('opens descriptions as text and resets its state when dismissed', async () => {
    const wrapper = mountHelp(['Records the counter', '<b>Plain text</b>']);
    expect(wrapper.get('button').attributes('aria-label')).toBe('Help : Recording period');
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('.popover').attributes('data-open')).toBe('true');
    expect(wrapper.findAll('p').map(p => p.text())).toEqual(['Records the counter', '<b>Plain text</b>']);
    expect(wrapper.find('b').exists()).toBe(false);
    wrapper.findComponent({ name: 'IonPopover' }).vm.$emit('didDismiss');
    await wrapper.vm.$nextTick();
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false');
  });

  it('hides the button when no description is available', () => {
    expect(mountHelp([]).find('button').exists()).toBe(false);
  });
});
