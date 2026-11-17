<template>
  <div class="occurrence-input">
    <ion-label position="stacked">{{ label }}</ion-label>

    <div class="occurrence-grid">
      <label class="occurrence-field occurrence-field--trigger">
        <span class="occurrence-field__title">{{ localize('@patternMatchesLabel') }}</span>
        <ion-input
          type="number"
          inputmode="numeric"
          :aria-label="localize('@patternMatchesLabel')"
          :value="occurrences.high"
          :min="min"
          :max="max"
          @ionInput="updateOccurrence('high', $event)"
        />
      </label>

      <label class="occurrence-field occurrence-field--release">
        <span class="occurrence-field__title">{{ localize('@patternDoesNotMatchLabel') }}</span>
        <ion-input
          type="number"
          inputmode="numeric"
          :aria-label="localize('@patternDoesNotMatchLabel')"
          :value="occurrences.low"
          :min="min"
          :max="max"
          @ionInput="updateOccurrence('low', $event)"
        />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';

const props = withDefaults(defineProps<{
  label?: string;
  value?: string;
  min?: number | string;
  max?: number | string;
  groupName?: string | number;
  paramName?: string | number;
  localize: (key: string) => string;
}>(), {
  min: 1,
  max: 65535,
});

const emit = defineEmits<{
  (event: 'update:value', payload: {
    newValue: string;
    groupName?: string | number;
    paramName?: string | number;
  }): void;
}>();

const normalizedMin = () => Number(props.min) || 1;
const normalizedMax = () => Number(props.max) || 65535;
const normalizeValue = (value: unknown): number => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return normalizedMin();
  return Math.min(normalizedMax(), Math.max(normalizedMin(), parsed));
};
const parseOccurrences = (value?: string) => {
  const [high, low] = String(value ?? '').trim().split(/\s+/);
  return {
    high: normalizeValue(high),
    low: normalizeValue(low ?? high),
  };
};

const occurrences = reactive(parseOccurrences(props.value));

const updateOccurrence = (side: 'high' | 'low', event: CustomEvent<{ value: string | null }>) => {
  const rawValue = event.detail.value;
  if (rawValue === null || rawValue === '') return;

  occurrences[side] = normalizeValue(rawValue);
  emit('update:value', {
    newValue: `${occurrences.high} ${occurrences.low}`,
    groupName: props.groupName,
    paramName: props.paramName,
  });
};

watch(
  () => props.value,
  value => Object.assign(occurrences, parseOccurrences(value)),
);
</script>

<style scoped>
.occurrence-input {
  display: grid;
  gap: 10px;
  width: 100%;
}

.occurrence-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.occurrence-field {
  display: grid;
  align-content: start;
  gap: 5px;
  min-width: 0;
  padding: 9px;
  border: 1px solid;
  border-radius: 10px;
}

.occurrence-field--trigger {
  border-color: rgba(82, 151, 103, 0.2);
  background: rgba(82, 151, 103, 0.08);
}

.occurrence-field--release {
  border-color: rgba(76, 137, 174, 0.2);
  background: rgba(76, 137, 174, 0.08);
}

.occurrence-field__title {
  color: var(--app-text);
  font-size: 0.72rem;
  font-weight: 750;
  line-height: 1.15;
  white-space: nowrap;
}

.occurrence-field ion-input {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  border: 1px solid var(--app-border-strong);
  border-radius: 8px;
  background: var(--app-surface);
  color: var(--app-text);
  font-weight: 800;
  text-align: center;
  --padding-start: 7px;
  --padding-end: 7px;
}

</style>
