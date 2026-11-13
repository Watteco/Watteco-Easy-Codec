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
    expect(vm.inputPlaceholder).toBe('0h10');
  });

  it('only suggests seconds when they are accepted', () => {
    const wrapper = mountSlider({ allowSeconds: true });

    expect((wrapper.vm as any).inputPlaceholder).toBe('10s / 0h10');
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

  it('uses progressively larger minute steps for long durations', () => {
    const wrapper = mountSlider({ max: 1440, value: '60', allowSeconds: false });
    const options = (wrapper.vm as any).durationOptions;

    expect(options).toContainEqual({ unit: 'minutes', value: 59 });
    expect(options).toContainEqual({ unit: 'minutes', value: 60 });
    expect(options).not.toContainEqual({ unit: 'minutes', value: 61 });
    expect(options).toContainEqual({ unit: 'minutes', value: 65 });
    expect(options).toContainEqual({ unit: 'minutes', value: 360 });
    expect(options).not.toContainEqual({ unit: 'minutes', value: 365 });
    expect(options).toContainEqual({ unit: 'minutes', value: 375 });
    expect(options).toContainEqual({ unit: 'minutes', value: 750 });
    expect(options).toContainEqual({ unit: 'minutes', value: 1440 });
  });

  it('accepts a custom minute step profile', () => {
    const wrapper = mountSlider({
      max: 120,
      value: '70',
      allowSeconds: false,
      timeSteps: [[0, 10], [70, 30]],
    });
    const options = (wrapper.vm as any).durationOptions;

    expect(options).toContainEqual({ unit: 'minutes', value: 60 });
    expect(options).toContainEqual({ unit: 'minutes', value: 70 });
    expect(options).not.toContainEqual({ unit: 'minutes', value: 80 });
    expect(options).toContainEqual({ unit: 'minutes', value: 100 });
    expect(options).toContainEqual({ unit: 'minutes', value: 120 });
  });

  it('keeps the configured step as the minimum granularity', () => {
    const wrapper = mountSlider({ max: 150, value: '60', step: 20, allowSeconds: false });
    const minuteValues = (wrapper.vm as any).durationOptions
      .filter((option: { unit: string }) => option.unit === 'minutes')
      .map((option: { value: number }) => option.value);

    expect(minuteValues).toEqual([1, 20, 40, 60, 80, 100, 120, 140, 150]);
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
    expect(vm.inputPlaceholder).toBe('HHMM');
  });
});
