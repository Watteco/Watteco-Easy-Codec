<template>
  <div class="pattern-input">
    <ion-label position="stacked">{{ label }}</ion-label>

    <div class="pattern-legend" aria-hidden="true">
      <span class="pattern-legend__item pattern-state--ignored">X {{ localize('@patternIgnored') }}</span>
      <span class="pattern-legend__item pattern-state--zero">0 {{ localize('@patternExpectedZero') }}</span>
      <span class="pattern-legend__item pattern-state--one">1 {{ localize('@patternExpectedOne') }}</span>
    </div>

    <div class="pattern-grid" role="group" :aria-label="label">
      <button
        v-for="(state, bitIndex) in states"
        :key="bitIndex"
        type="button"
        class="pattern-bit"
        :class="`pattern-state--${state}`"
        :aria-label="bitAriaLabel(bitIndex, state)"
        :title="bitAriaLabel(bitIndex, state)"
        @click="cycleState(bitIndex)"
      >
        <span class="pattern-bit__input">{{ localize('@InputLabel') }} {{ bitIndex + 1 }}</span>
        <span class="pattern-bit__value">
          <strong class="pattern-bit__state">{{ stateSymbol(state) }}</strong>
          <span class="pattern-bit__indicator" aria-hidden="true" />
        </span>
      </button>
    </div>

    <div class="pattern-result">
      <code>{{ patternSummary }}</code>
      <span>Val&nbsp;0x{{ valHex }}</span>
      <span>Gap&nbsp;0x{{ gapHex }}</span>
    </div>

    <p v-if="encoded.gap === 0" class="pattern-warning" role="status">
      {{ localize('@patternNoInputWarning') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  decodeBinaryPattern,
  encodeBinaryPattern,
  formatBinaryPattern,
  formatBinaryPatternWord,
  normalizeBinaryPatternBitCount,
  type BinaryPatternState,
} from '@/utils/binaryPattern';

const props = defineProps<{
  label?: string;
  value?: string;
  bitCount?: number | string;
  groupName?: string | number;
  paramName?: string | number;
  localize: (key: string) => string;
}>();

const emit = defineEmits<{
  (event: 'update:value', payload: {
    newValue: string;
    groupName?: string | number;
    paramName?: string | number;
  }): void;
}>();

const normalizedBitCount = computed(() => normalizeBinaryPatternBitCount(props.bitCount ?? 1));
const states = ref<BinaryPatternState[]>(decodeBinaryPattern(props.value, normalizedBitCount.value));
const encoded = computed(() => encodeBinaryPattern(states.value));
const patternSummary = computed(() => formatBinaryPattern(states.value));
const valHex = computed(() => formatBinaryPatternWord(encoded.value.val));
const gapHex = computed(() => formatBinaryPatternWord(encoded.value.gap));

const stateSymbol = (state: BinaryPatternState): string => ({
  ignored: 'X',
  zero: '0',
  one: '1',
})[state];

const stateLabel = (state: BinaryPatternState): string => ({
  ignored: props.localize('@patternIgnored'),
  zero: props.localize('@patternExpectedZero'),
  one: props.localize('@patternExpectedOne'),
})[state];

const bitAriaLabel = (bitIndex: number, state: BinaryPatternState): string => (
  `${props.localize('@InputLabel')} ${bitIndex + 1}: ${stateLabel(state)}`
);

const cycleState = (bitIndex: number) => {
  const nextState: Record<BinaryPatternState, BinaryPatternState> = {
    ignored: 'zero',
    zero: 'one',
    one: 'ignored',
  };
  states.value[bitIndex] = nextState[states.value[bitIndex]];
  states.value = [...states.value];
  emit('update:value', {
    newValue: encoded.value.value,
    groupName: props.groupName,
    paramName: props.paramName,
  });
};

watch(
  [() => props.value, normalizedBitCount],
  ([value, bitCount]) => {
    states.value = decodeBinaryPattern(value, bitCount);
  },
);
</script>

<style scoped>
.pattern-input {
  display: grid;
  gap: 12px;
  width: 100%;
}

.pattern-legend,
.pattern-result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

.pattern-legend__item {
  padding: 4px 8px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}

.pattern-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(68px, 1fr));
  gap: 8px;
  width: 100%;
}

.pattern-bit {
  display: grid;
  gap: 3px;
  min-height: 62px;
  padding: 8px 6px;
  border: 1px solid;
  border-radius: 12px;
  font: inherit;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(28, 35, 45, 0.06);
  transition: transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease;
}

.pattern-bit:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(28, 35, 45, 0.09);
}

.pattern-bit:focus-visible {
  outline: 3px solid rgba(var(--ion-color-primary-rgb), 0.4);
  outline-offset: 2px;
}

.pattern-bit__input {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--app-text);
}

.pattern-bit__value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.pattern-bit__state {
  font-size: 1.2rem;
  line-height: 1;
}

.pattern-bit__indicator {
  width: 9px;
  height: 9px;
  border: 2px solid currentColor;
  border-radius: 50%;
  background: currentColor;
}

.pattern-state--ignored {
  border-color: rgba(151, 145, 137, 0.18);
  background: rgba(151, 145, 137, 0.08);
  color: #737981;
}

.pattern-state--ignored .pattern-bit__indicator {
  background: transparent;
  box-shadow: none;
}

.pattern-state--zero {
  border-color: rgba(76, 137, 174, 0.2);
  background: rgba(76, 137, 174, 0.1);
  color: #437e9f;
}

.pattern-state--zero .pattern-bit__indicator {
  box-shadow: 0 0 0 4px rgba(76, 137, 174, 0.13);
}

.pattern-state--one {
  border-color: rgba(82, 151, 103, 0.2);
  background: rgba(82, 151, 103, 0.1);
  color: #477f58;
}

.pattern-state--one .pattern-bit__indicator {
  box-shadow: 0 0 0 4px rgba(82, 151, 103, 0.13);
}

.pattern-result {
  color: var(--app-text-secondary);
  font-size: 0.76rem;
}

.pattern-result code {
  padding: 5px 8px;
  border: 1px solid var(--app-border-strong);
  border-radius: 7px;
  background: var(--app-surface-subtle);
  color: var(--app-text);
  font-size: 0.86rem;
  font-weight: 800;
}

.pattern-warning {
  margin: 0;
  color: #a23a45;
  font-size: 0.76rem;
  font-weight: 700;
}

@media (max-width: 600px) {
  .pattern-grid {
    grid-template-columns: repeat(auto-fit, minmax(58px, 1fr));
    gap: 6px;
  }

  .pattern-bit {
    min-height: 56px;
    padding: 7px 4px;
  }
}
</style>
