import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import EuiInput from '@/components/EuiInput.vue';

const mountInput = (props: Record<string, unknown> = {}) => mount(EuiInput, {
  props: {
    inputId: 'test-eui',
    label: 'EUI',
    ...props,
  },
});

describe('EuiInput', () => {
  it('formats a full EUI and emits its normalized value', async () => {
    const wrapper = mountInput();
    const input = wrapper.get('input');

    await input.setValue('01:23-45 67:89:ab:cd:ef');

    expect(wrapper.emitted('update:modelValue')).toEqual([['0123456789ABCDEF']]);
    expect((input.element as HTMLInputElement).value).toBe('01:23:45:67:89:AB:CD:EF');
  });

  it('renders the Watteco prefix separately and accepts a complete pasted DevEUI', async () => {
    const wrapper = mountInput({ fixedPrefix: '70B3D5E7' });
    const input = wrapper.get('input');

    expect(wrapper.get('.eui-input-field__prefix').text()).toBe('70:B3:D5:E7:');
    await input.setValue('70:B3:D5:E7:5F:00:67:63');

    expect(wrapper.emitted('update:modelValue')).toEqual([['5F006763']]);
    expect((input.element as HTMLInputElement).value).toBe('5F:00:67:63');
  });

  it('exposes insertion and backspace for the hexadecimal keypad', async () => {
    const wrapper = mountInput({ modelValue: '0123' });
    const input = wrapper.get('input').element as HTMLInputElement;
    input.setSelectionRange(input.value.length, input.value.length);

    wrapper.vm.insert('A');
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['0123A']);

    await wrapper.setProps({ modelValue: '0123A' });
    input.setSelectionRange(input.value.length, input.value.length);
    wrapper.vm.backspace();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['0123']);
  });

  it('disables the native field', () => {
    const wrapper = mountInput({ disabled: true });

    expect(wrapper.get('input').attributes('disabled')).toBeDefined();
  });
});

