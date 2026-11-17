import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HexKeypad from '@/components/HexKeypad.vue';

const mountKeypad = (props: Record<string, unknown> = {}) => mount(HexKeypad, {
  props: {
    backspaceLabel: 'Delete',
    keypadLabel: 'Hex keypad',
    systemKeyboardLabel: 'System keyboard',
    spaceLabel: 'Space',
    ...props,
  },
});

describe('HexKeypad', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits hexadecimal digits and the optional space', async () => {
    const wrapper = mountKeypad();
    const buttons = wrapper.findAll('.hex-keypad__key');

    await buttons[0].trigger('click');
    await buttons[15].trigger('click');
    await buttons[16].trigger('click');

    expect(wrapper.emitted('insert')).toEqual([['1'], ['F'], [' ']]);
  });

  it('hides the keys when the system keyboard is enabled', () => {
    const wrapper = mountKeypad({ systemKeyboardEnabled: true });

    expect(wrapper.find('.hex-keypad__keys').exists()).toBe(false);
    expect(wrapper.text()).toContain('Hex keypad');
  });

  it('emits the keyboard mode toggle', async () => {
    const wrapper = mountKeypad();

    await wrapper.get('.hex-keypad__mode').trigger('click');

    expect(wrapper.emitted('toggle-system-keyboard')).toHaveLength(1);
  });

  it('emits repeated backspaces during a long press', async () => {
    vi.useFakeTimers();
    const wrapper = mountKeypad();
    const backspace = wrapper.get('[aria-label="Delete"]');

    await backspace.trigger('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    vi.advanceTimersByTime(405);
    await backspace.trigger('pointerup', { pointerId: 1 });

    expect(wrapper.emitted('backspace')).toHaveLength(2);
  });

  it('can omit the space key for fixed-width hexadecimal values', () => {
    const wrapper = mountKeypad({ showSpace: false });

    expect(wrapper.findAll('.hex-keypad__key')).toHaveLength(17);
    expect(wrapper.text()).not.toContain('Space');
    expect(wrapper.get('[aria-label="Delete"]').classes()).toContain('hex-keypad__key--full');
  });

  it('disables every action', () => {
    const wrapper = mountKeypad({ disabled: true });

    expect(wrapper.findAll('button').every(button => button.attributes('disabled') !== undefined))
      .toBe(true);
  });
});
