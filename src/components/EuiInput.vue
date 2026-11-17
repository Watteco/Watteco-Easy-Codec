<template>
  <div class="eui-input-field">
    <label v-if="label" class="eui-input-field__label" :for="inputId">{{ label }}</label>
    <div class="eui-input-field__row">
      <span v-if="formattedPrefix" class="eui-input-field__prefix">
        {{ formattedPrefix }}:
      </span>
      <input
        :id="inputId"
        ref="inputElement"
        :value="formattedValue"
        class="eui-input-field__input"
        :class="{ 'eui-input-field__input--full': !formattedPrefix }"
        type="text"
        :inputmode="inputMode"
        :maxlength="maximumFormattedLength"
        autocomplete="off"
        autocapitalize="characters"
        autocorrect="off"
        spellcheck="false"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="handleInput"
      />
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import {
  formatEuiInput,
  formatEuiPrefix,
  getFormattedEuiInputCaret,
  normalizeEuiInput,
  type EuiInputOptions,
} from '@/utils/euiInput';

const props = withDefaults(defineProps<{
  modelValue?: string;
  inputId: string;
  label?: string;
  fixedPrefix?: string;
  byteLength?: number;
  placeholder?: string;
  disabled?: boolean;
  inputMode?: 'text' | 'none';
}>(), {
  modelValue: '',
  label: '',
  fixedPrefix: '',
  byteLength: 8,
  placeholder: '',
  disabled: false,
  inputMode: 'text',
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'input', value: string): void;
}>();

const inputElement = ref<HTMLInputElement | null>(null);
const options = computed<EuiInputOptions>(() => ({
  byteLength: props.byteLength,
  fixedPrefix: props.fixedPrefix,
}));
const formattedPrefix = computed(() => formatEuiPrefix(props.fixedPrefix));
const formattedValue = computed(() => formatEuiInput(props.modelValue, options.value));
const maximumFormattedLength = computed(() => Math.max(1, props.byteLength * 3 - 1));

function applyRawValue(rawValue: string, selectionStart: number | null): void {
  const caret = getFormattedEuiInputCaret(rawValue, selectionStart, options.value);
  const normalized = normalizeEuiInput(rawValue, options.value);
  emit('update:modelValue', normalized);
  emit('input', normalized);

  const input = inputElement.value;
  if (input) input.value = formatEuiInput(normalized, options.value);
  void nextTick(() => inputElement.value?.setSelectionRange(caret, caret));
}

function handleInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  applyRawValue(input.value, input.selectionStart);
}

function insert(text: string): void {
  if (props.disabled) return;
  const input = inputElement.value;
  const currentValue = formattedValue.value;
  const start = input?.selectionStart ?? currentValue.length;
  const end = input?.selectionEnd ?? start;
  const nextValue = `${currentValue.slice(0, start)}${text}${currentValue.slice(end)}`;
  applyRawValue(nextValue, start + text.length);
  void nextTick(() => inputElement.value?.focus({ preventScroll: true }));
}

function backspace(): void {
  if (props.disabled) return;
  const input = inputElement.value;
  const currentValue = formattedValue.value;
  const start = input?.selectionStart ?? currentValue.length;
  const end = input?.selectionEnd ?? start;

  if (start !== end) {
    applyRawValue(`${currentValue.slice(0, start)}${currentValue.slice(end)}`, start);
  } else {
    let deletionIndex = start - 1;
    while (deletionIndex >= 0 && !/[0-9A-F]/i.test(currentValue[deletionIndex])) {
      deletionIndex -= 1;
    }
    if (deletionIndex < 0) return;
    applyRawValue(
      `${currentValue.slice(0, deletionIndex)}${currentValue.slice(deletionIndex + 1)}`,
      deletionIndex,
    );
  }
  void nextTick(() => inputElement.value?.focus({ preventScroll: true }));
}

function focus(): void {
  inputElement.value?.focus({ preventScroll: true });
}

defineExpose({ insert, backspace, focus });
</script>

<style scoped>
.eui-input-field {
  display: grid;
  gap: var(--eui-input-gap, 5px);
  min-width: 0;
}

.eui-input-field__label {
  color: var(--eui-input-label-color, var(--ion-color-medium-shade));
  font-size: var(--eui-input-label-size, 0.76rem);
  font-weight: var(--eui-input-label-weight, 700);
  text-transform: uppercase;
}

.eui-input-field__row {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--eui-input-border-color, rgba(var(--ion-color-medium-rgb), 0.42));
  border-radius: var(--eui-input-border-radius, 8px);
  background: var(--eui-input-background, var(--app-page-background));
  font-family: monospace;
  font-size: var(--eui-input-font-size, clamp(0.86rem, 3.8vw, 1.02rem));
  font-weight: 700;
}

.eui-input-field__prefix {
  flex: 0 0 auto;
  padding: var(--eui-input-prefix-padding, 11px 0 11px 10px);
  color: var(--eui-input-prefix-color, var(--ion-color-medium-shade));
  white-space: nowrap;
}

.eui-input-field__input {
  box-sizing: border-box;
  min-width: 0;
  flex: 1 1 auto;
  padding: var(--eui-input-padding, 11px 8px 11px 0);
  border: 0;
  outline: 0;
  color: var(--eui-input-color, var(--ion-text-color));
  background: transparent;
  font: inherit;
  text-transform: uppercase;
}

.eui-input-field__input::placeholder {
  color: var(--ion-color-medium);
  opacity: 0.55;
}

.eui-input-field__input--full {
  padding-left: var(--eui-input-full-padding-start, 10px);
}

.eui-input-field__row:focus-within {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 2px rgba(var(--ion-color-primary-rgb), 0.14);
}
</style>

