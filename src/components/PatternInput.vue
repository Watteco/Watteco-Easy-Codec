<template>
  <div class="pattern-input">
    <div class="pattern-heading">
      <ion-label position="stacked">{{ label }}</ion-label>
      <button
        type="button"
        class="pattern-help"
        :aria-label="localize('@patternLegendHelp')"
        :aria-expanded="legendVisible"
        @click="legendVisible = !legendVisible"
      >
        <state-mapping-icon :inverted="inverted" aria-hidden="true" />
      </button>
    </div>

    <div v-if="legendVisible" class="pattern-legend">
      <span class="pattern-legend__item pattern-state--ignored">
        <span class="pattern-legend__marker pattern-legend__marker--ignored" aria-hidden="true" />
        {{ localize('@patternIgnored') }}
      </span>
      <span class="pattern-legend__item" :class="visualStateClass('zero')">
        <span
          class="pattern-legend__marker"
          :class="visualMarkerClass('zero')"
          aria-hidden="true"
        />
        {{ localize('@patternExpectedZero') }}
      </span>
      <span class="pattern-legend__item" :class="visualStateClass('one')">
        <span
          class="pattern-legend__marker"
          :class="visualMarkerClass('one')"
          aria-hidden="true"
        />
        {{ localize('@patternExpectedOne') }}
      </span>

      <div class="pattern-display-setting">
        <div class="pattern-display-setting__mapping" :aria-label="localize('@stateDisplayMappingLabel')">
          <span
            class="pattern-display-setting__swatch"
            :class="visualStateClass('one')"
            aria-hidden="true"
          >
            <span class="pattern-display-setting__indicator" />
          </span>
          <span>{{ localize('@highStateLabel') }}</span>
          <span
            class="pattern-display-setting__swatch"
            :class="visualStateClass('zero')"
            aria-hidden="true"
          >
            <span class="pattern-display-setting__indicator" />
          </span>
          <span>{{ localize('@lowStateLabel') }}</span>
        </div>
        <button type="button" class="pattern-display-setting__invert" @click="toggleInversion">
          {{ localize('@invertStateDisplayLabel') }}
        </button>
      </div>
    </div>

    <div class="pattern-grid" role="group" :aria-label="label">
      <button
        v-for="(state, bitIndex) in states"
        :key="bitIndex"
        type="button"
        class="pattern-bit"
        :class="[`pattern-state--${state}`, visualStateClass(state)]"
        :aria-label="bitAriaLabel(bitIndex, state)"
        :title="bitAriaLabel(bitIndex, state)"
        @click="cycleState(bitIndex)"
      >
        <span class="pattern-bit__input">{{ bitIndex + 1 }}</span>
        <span
          class="pattern-bit__indicator"
          :class="{ 'pattern-bit__indicator--placeholder': state === 'ignored' }"
          aria-hidden="true"
        />
      </button>
    </div>

    <p v-if="encoded.gap === 0" :class="allowEmpty ? 'pattern-empty' : 'pattern-warning'" role="status">
      {{ localize(allowEmpty ? '@patternPeriodicOnly' : '@patternNoInputWarning') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import StateMappingIcon from '@/components/sensor/StateMappingIcon.vue';
import { useBle } from '@/composables/useBle';
import { useStateVisualPreference } from '@/composables/useStateVisualPreference';
import {
  decodeBinaryPattern,
  encodeBinaryPattern,
  normalizeBinaryPatternBitCount,
  type BinaryPatternState,
} from '@/utils/binaryPattern';

const props = defineProps<{
  label?: string;
  value?: string;
  bitCount?: number | string;
  allowEmpty?: boolean;
  groupName?: string | number;
  paramName?: string | number;
  stateVisualPreferenceKey?: string;
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
const legendVisible = ref(false);
const encoded = computed(() => encodeBinaryPattern(states.value));
const ble = useBle();
const stateVisualPreferenceKey = computed(() => (
  props.stateVisualPreferenceKey
  ?? ble.connectedDevice.value?.deviceId
  ?? ble.lastConnectedDevice.value?.deviceId
  ?? ble.productReference.value
  ?? 'default'
));
const { inverted, toggleInversion } = useStateVisualPreference(() => stateVisualPreferenceKey.value);

const isVisuallyActive = (state: BinaryPatternState): boolean => (
  state !== 'ignored' && (state === 'one') !== inverted.value
);
const visualStateClass = (state: BinaryPatternState): string => {
  if (state === 'ignored') return '';
  return isVisuallyActive(state) ? 'pattern-visual--active' : 'pattern-visual--inactive';
};
const visualMarkerClass = (state: Exclude<BinaryPatternState, 'ignored'>): string => (
  isVisuallyActive(state)
    ? 'pattern-legend__marker--active'
    : 'pattern-legend__marker--inactive'
);

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

.pattern-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pattern-help {
  display: grid;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
  place-items: center;
}

.pattern-help:active {
  background: var(--app-surface-subtle);
}

.pattern-help:focus-visible {
  outline: 3px solid rgba(var(--ion-color-primary-rgb), 0.3);
  outline-offset: 2px;
}

.pattern-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

.pattern-display-setting {
  display: grid;
  width: 100%;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--app-border);
}

.pattern-display-setting__mapping {
  display: grid;
  grid-template-columns: 28px auto;
  align-items: center;
  gap: 5px 8px;
  color: var(--app-text);
  font-size: 0.72rem;
  font-weight: 650;
}

.pattern-display-setting__swatch {
  display: grid;
  width: 28px;
  height: 22px;
  box-sizing: border-box;
  place-items: center;
  border: 1px solid;
  border-radius: 7px;
  transition: border-color 180ms ease, background-color 180ms ease;
}

.pattern-display-setting__indicator {
  width: 7px;
  height: 7px;
  box-sizing: border-box;
  border: 1.5px solid currentColor;
  border-radius: 50%;
  transition: background-color 180ms ease, box-shadow 180ms ease;
}

.pattern-display-setting__invert {
  min-height: 38px;
  padding: 7px 10px;
  border: 1px solid var(--app-border-strong);
  border-radius: 10px;
  background: var(--app-surface-subtle);
  color: var(--app-text-secondary);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
}

.pattern-legend {
  padding: 9px;
  border: 1px solid var(--app-border-strong);
  border-radius: 12px;
  background: var(--app-surface);
  box-shadow: 0 2px 8px rgba(28, 35, 45, 0.08);
}

.pattern-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}

.pattern-legend__marker {
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
}

.pattern-legend__marker--inactive,
.pattern-legend__marker--active {
  border: 2px solid currentColor;
  border-radius: 50%;
}

.pattern-legend__marker--active {
  background: currentColor;
  box-shadow: 0 0 0 3px rgba(82, 151, 103, 0.13);
}

.pattern-legend__marker--ignored::after {
  position: absolute;
  top: 5px;
  left: 0;
  width: 13px;
  height: 2px;
  border-radius: 999px;
  background: #b9565c;
  content: '';
  transform: rotate(-45deg);
}

.pattern-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(68px, 1fr));
  gap: 8px;
  width: 100%;
}

.pattern-bit {
  position: relative;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 7px;
  min-height: 62px;
  padding: 8px 6px;
  border: 1px solid;
  border-radius: 12px;
  font: inherit;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(28, 35, 45, 0.06);
  transition: transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease;
  overflow: hidden;
}

.pattern-bit:focus-visible {
  outline: 3px solid rgba(var(--ion-color-primary-rgb), 0.4);
  outline-offset: 2px;
}

@media (hover: hover) and (pointer: fine) {
  .pattern-bit:hover {
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(28, 35, 45, 0.09);
  }
}

.pattern-bit__input {
  font-size: 0.86rem;
  font-weight: 750;
  color: var(--app-text);
}

.pattern-bit__indicator {
  width: 9px;
  height: 9px;
  border: 2px solid currentColor;
  border-radius: 50%;
  background: currentColor;
}

.pattern-state--ignored {
  border-color: rgba(185, 86, 92, 0.24);
  background: rgba(185, 86, 92, 0.025);
  color: #737981;
}

.pattern-bit__indicator--placeholder {
  visibility: hidden;
}

.pattern-bit.pattern-state--ignored::after {
  position: absolute;
  top: 50%;
  left: -8%;
  width: 116%;
  height: 2px;
  border-radius: 999px;
  background: #b9565c;
  content: '';
  transform: rotate(-38deg);
}

.pattern-visual--inactive {
  border-color: rgba(151, 145, 137, 0.16);
  background: rgba(151, 145, 137, 0.07);
  color: #969189;
}

.pattern-visual--inactive .pattern-bit__indicator,
.pattern-visual--inactive .pattern-display-setting__indicator {
  background: transparent;
  box-shadow: none;
}

.pattern-visual--active {
  border-color: rgba(82, 151, 103, 0.2);
  background: rgba(82, 151, 103, 0.1);
  color: #477f58;
}

.pattern-visual--active .pattern-bit__indicator,
.pattern-visual--active .pattern-display-setting__indicator {
  background: currentColor;
  box-shadow: 0 0 0 4px rgba(82, 151, 103, 0.13);
}

.pattern-warning {
  margin: 0;
  color: #a23a45;
  font-size: 0.76rem;
  font-weight: 700;
}

.pattern-empty {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: 0.74rem;
  font-weight: 650;
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
