<template>
  <ion-card
    class="metric-card"
    :class="{
      'metric-card--compact': compact,
      'metric-card--editable': editable,
      'metric-card--disabled': disabled || updating,
    }"
    :style="{ '--metric-accent': accent }"
    :role="editable ? 'button' : undefined"
    :tabindex="editable && !disabled && !updating ? 0 : undefined"
    :aria-label="editable ? editLabel : undefined"
    :aria-disabled="editable && (disabled || updating) ? 'true' : undefined"
    @click="requestEdit"
    @keydown.enter.prevent="requestEdit"
    @keydown.space.prevent="requestEdit"
  >
    <ion-card-content>
      <div class="metric-heading">
        <span class="metric-icon" aria-hidden="true">
          <ion-icon :icon="icon" />
        </span>
        <span
          class="metric-label"
          :title="officialLabel || label"
          :aria-label="officialLabel || label"
        >{{ label }}</span>
      </div>

      <div class="metric-value" :class="{ 'metric-value--empty': value === null }">
        <span :class="valueLengthClass" :title="formattedValue">{{ formattedValue }}</span>
        <small v-if="unit">{{ unit }}</small>
      </div>
      <span v-if="editable" class="metric-edit-indicator" aria-hidden="true">
        <ion-spinner v-if="updating" name="crescent" />
        <ion-icon v-else :icon="pencilOutline" />
      </span>

    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonCard, IonCardContent, IonIcon, IonSpinner } from '@ionic/vue';
import { pencilOutline } from 'ionicons/icons';

const props = withDefaults(defineProps<{
  label: string;
  officialLabel?: string;
  value: number | string | null;
  unit?: string;
  icon: string;
  accent?: string;
  decimals?: number;
  compact?: boolean;
  editable?: boolean;
  disabled?: boolean;
  updating?: boolean;
  editLabel?: string;
}>(), {
  unit: '',
  officialLabel: '',
  accent: '#7867B8',
  decimals: 0,
  compact: false,
  editable: false,
  disabled: false,
  updating: false,
  editLabel: 'Edit',
});

const emit = defineEmits<{
  (event: 'edit'): void;
}>();

const requestEdit = () => {
  if (!props.editable || props.disabled || props.updating) return;
  emit('edit');
};

const formattedValue = computed(() => {
  if (props.value === null) return '—';
  if (typeof props.value === 'number') {
    return props.value.toLocaleString(undefined, {
      minimumFractionDigits: props.decimals,
      maximumFractionDigits: props.decimals,
    });
  }
  return props.value;
});

const valueLengthClass = computed(() => {
  const integerDigits = typeof props.value === 'number' && Number.isInteger(props.value)
    ? Math.abs(props.value).toString().length
    : 0;
  if (props.editable && integerDigits >= 10) return 'metric-value__number--counter-max';
  if (props.editable && integerDigits >= 7) return 'metric-value__number--counter-long';
  if (props.editable && integerDigits >= 4) return 'metric-value__number--counter-medium';

  const length = formattedValue.value.length;
  if (length >= 11) return 'metric-value__number--very-long';
  if (length >= 8) return 'metric-value__number--long';
  return '';
});
</script>

<style scoped>
.metric-card {
  --metric-accent-soft: color-mix(in srgb, var(--metric-accent) 13%, transparent);
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 100px;
  flex-direction: column;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-surface);
  box-shadow: var(--app-card-shadow);
  container-type: inline-size;
}

.metric-card::before {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 4px;
  background: var(--metric-accent);
  content: '';
}

.metric-card--compact {
  grid-column: 1 / -1;
  min-height: 72px;
}

.metric-card ion-card-content {
  display: flex;
  min-height: 100px;
  flex: 1;
  flex-direction: column;
  justify-content: flex-start;
  padding: 12px 14px;
}

.metric-card--compact ion-card-content {
  min-height: 72px;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  padding-right: 18px;
}

.metric-card--compact .metric-heading {
  flex: 1 1 auto;
}

.metric-card--compact .metric-value {
  flex: 0 0 auto;
  margin-block: 0;
  margin-inline-start: 0;
}

.metric-card--compact .metric-value span {
  font-size: 1.65rem;
}

.metric-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.metric-card--editable:not(.metric-card--disabled) {
  cursor: pointer;
}

.metric-card--editable:not(.metric-card--disabled):active {
  transform: scale(0.985);
}

.metric-card--editable:focus-visible {
  outline: 2px solid var(--metric-accent);
  outline-offset: 2px;
}

.metric-edit-indicator {
  position: absolute;
  right: 11px;
  bottom: 10px;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 7px;
  color: var(--metric-accent);
  background: var(--metric-accent-soft);
  font-size: 13px;
}

.metric-card--disabled .metric-edit-indicator {
  opacity: 0.45;
}

.metric-edit-indicator ion-spinner {
  width: 12px;
  height: 12px;
}

.metric-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  place-items: center;
  border-radius: 10px;
  background: var(--metric-accent-soft);
  color: var(--metric-accent);
  font-size: 19px;
}

.metric-label {
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-value {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-block: auto;
  margin-inline-start: 3px;
  color: var(--app-text);
  line-height: 1;
}

.metric-value span {
  min-width: 0;
  overflow: hidden;
  font-size: clamp(1.75rem, 7vw, 2.4rem);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: -0.04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-value span.metric-value__number--long {
  font-size: clamp(1.15rem, 4.6vw, 1.7rem);
  letter-spacing: -0.05em;
}

.metric-value span.metric-value__number--very-long {
  font-size: clamp(0.95rem, 4vw, 1.4rem);
  letter-spacing: -0.055em;
}

.metric-value span.metric-value__number--counter-medium {
  font-size: clamp(0.9rem, 7vw, 2.4rem);
  font-size: clamp(0.9rem, 15cqi, 2.4rem);
  letter-spacing: -0.05em;
}

.metric-value span.metric-value__number--counter-long {
  font-size: clamp(0.75rem, 5vw, 2.4rem);
  font-size: clamp(0.75rem, 10cqi, 2.4rem);
  letter-spacing: -0.055em;
}

.metric-value span.metric-value__number--counter-max {
  font-size: clamp(0.68rem, 4vw, 2.4rem);
  font-size: clamp(0.68rem, 8cqi, 2.4rem);
  letter-spacing: -0.06em;
}

.metric-value small {
  color: var(--app-text-muted);
  font-size: 0.88rem;
  font-weight: 600;
}

.metric-value--empty {
  color: var(--app-text-faint);
}

.metric-card--editable .metric-value {
  padding-inline-end: 28px;
}

.metric-card--editable .metric-value span {
  overflow: visible;
  text-overflow: clip;
}

</style>
