import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TimeSlider from '@/components/TimeSlider.vue';

const mountSlider = (props: Record<string, unknown> = {}) => mount(TimeSlider, {
  props: {
    label: 'Period',
    min: 1,
    max: 60,
    value: '10',
    step: 1,
    allowSeconds: true,
    groupName: 'group',
    paramName: 'period',
    ...props,
  },
  global: {
    stubs: {
      IonLabel: true,
      IonRange: true,
      IonChip: true,
      IonInput: true,
    },
    config: {
      compilerOptions: {
        isCustomElement: (tag: string) => tag.startsWith('ion-'),
      },
    },
  },
});

describe('TimeSlider', () => {
  it('maps the lower slider positions to seconds before minutes', () => {
    const wrapper = mountSlider();
    const vm = wrapper.vm as any;

    expect(vm.durationOptions[0]).toEqual({ unit: 'seconds', value: 1 });
    expect(vm.durationOptions[58]).toEqual({ unit: 'seconds', value: 59 });
    expect(vm.durationOptions[59]).toEqual({ unit: 'minutes', value: 1 });

    vm.onRangeChange({ detail: { value: 9 } });
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toMatchObject({ newValue: '10s' });
  });

  it('keeps the slider in minutes unless seconds are explicitly enabled', () => {
    const wrapper = mountSlider({ allowSeconds: false });
    const vm = wrapper.vm as any;

    expect(vm.durationOptions[0]).toEqual({ unit: 'minutes', value: 1 });
    expect(vm.durationOptions.some((option: { unit: string }) => option.unit === 'seconds')).toBe(false);
  });

  it('keeps legacy numeric values in minutes', () => {
    const wrapper = mountSlider({ value: '10' });
    const vm = wrapper.vm as any;

    expect(vm.displayValue).toBe('0h10');
    expect(vm.durationOptions[vm.currentIndex]).toEqual({ unit: 'minutes', value: 10 });
  });

  it('accepts a seconds suffix in the text input', () => {
    const wrapper = mountSlider();
    const vm = wrapper.vm as any;

    vm.timeInputValue = '10s';
    vm.finishEditing();

    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toMatchObject({ newValue: '10s' });
    expect(vm.displayValue).toBe('10 s');
  });

  it('keeps a typed minute value that is between slider steps', () => {
    const wrapper = mountSlider({ max: 120, value: '20', step: 20, allowSeconds: false });
    const vm = wrapper.vm as any;

    vm.timeInputValue = '14m';
    vm.finishEditing();

    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toMatchObject({ newValue: '14' });
    expect(vm.displayValue).toBe('0h14');
    expect(vm.durationOptions).toContainEqual({ unit: 'minutes', value: 14 });
  });

  it('keeps a loaded minute value that is between slider steps', () => {
    const wrapper = mountSlider({ max: 120, value: '72', step: 20, allowSeconds: false });
    const vm = wrapper.vm as any;

    expect(vm.displayValue).toBe('1h12');
    expect(vm.durationOptions[vm.currentIndex]).toEqual({ unit: 'minutes', value: 72 });
  });

  it('limits a dependent slider to a parent value expressed in seconds', () => {
    const wrapper = mountSlider({ value: '20s', maxDuration: '30s' });
    const vm = wrapper.vm as any;

    expect(vm.durationOptions.at(-1)).toEqual({ unit: 'seconds', value: 30 });
    expect(vm.rangeMax).toBe(29);
  });

  it('does not add a seconds zone to HHMM fields', () => {
    const wrapper = mountSlider({ min: 0, max: 1439, value: '600', step: 5, outputFormat: 'HHMM' });
    const vm = wrapper.vm as any;

    expect(vm.durationOptions.every((option: { unit: string }) => option.unit === 'minutes')).toBe(true);
    expect(vm.displayValue).toBe('10h00');
  });
});
