<template>
  <ion-card
    class="state-card"
    :class="{
      'state-card--compact': entries.length <= 3,
      'state-card--single': entries.length === 1,
      'state-card--wide': entries.length > 3,
    }"
    :style="{
      '--state-columns': getColumnCount(entries.length),
      '--state-accent': accent,
    }"
    :aria-label="label"
  >
    <ion-card-content>
      <div class="state-heading">
        <span class="state-icon" aria-hidden="true">
          <ion-icon :icon="icon" />
        </span>
        <span class="state-title">{{ label }}</span>
      </div>

      <div class="state-list">
        <div
          v-for="entry in entries"
          :key="entry.measId"
          class="state-item"
          :class="{
            'state-item--active': normalizeState(entry.value) === true,
            'state-item--inactive': normalizeState(entry.value) === false,
            'state-item--empty': normalizeState(entry.value) === null,
          }"
          :aria-label="`${entry.label}: ${formatState(entry.value)}`"
          :title="`${entry.label}: ${formatState(entry.value)}`"
        >
          <span class="state-label">{{ entry.label }}</span>
          <span
            class="state-indicator"
            :class="{
              'state-indicator--active': normalizeState(entry.value) === true,
              'state-indicator--inactive': normalizeState(entry.value) === false,
              'state-indicator--empty': normalizeState(entry.value) === null,
            }"
            aria-hidden="true"
          />
        </div>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { IonCard, IonCardContent, IonIcon } from '@ionic/vue';
import { toggleOutline } from 'ionicons/icons';

type SensorStateValue = boolean | number | string | null;

const props = withDefaults(defineProps<{
  label: string;
  activeLabel: string;
  inactiveLabel: string;
  accent?: string;
  icon?: string;
  entries: Array<{
    measId: number;
    label: string;
    value: SensorStateValue;
  }>;
}>(), {
  accent: '#DB6F2B',
  icon: toggleOutline,
});

const normalizeState = (value: SensorStateValue): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string' || value.trim() === '') return null;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'on', 'active', 'open', 'high'].includes(normalized)) return true;
  if (['false', '0', 'off', 'inactive', 'closed', 'low'].includes(normalized)) return false;
  return null;
};

const getColumnCount = (entryCount: number): number => (
  Math.max(1, entryCount > 6 ? Math.ceil(entryCount / 2) : entryCount)
);

const formatState = (value: SensorStateValue): string => {
  const state = normalizeState(value);
  if (state === true) return props.activeLabel;
  if (state === false) return props.inactiveLabel;
  return value === null || value === '' ? '—' : String(value);
};
</script>

<style scoped>
.state-card {
  --state-accent: #db6f2b;
  position: relative;
  min-width: 0;
  min-height: 132px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-surface);
  box-shadow: var(--app-card-shadow);
}

.state-card--wide {
  grid-column: 1 / -1;
}

.state-card--compact {
  min-height: 108px;
}

.state-card::before {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 4px;
  background: var(--state-accent);
  content: '';
}

.state-card ion-card-content {
  display: flex;
  min-height: 132px;
  flex-direction: column;
  justify-content: flex-start;
  padding: 14px;
}

.state-card--compact ion-card-content {
  min-height: 108px;
  padding: 10px 14px;
}

.state-heading {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.state-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  place-items: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--state-accent) 13%, transparent);
  color: var(--state-accent);
  font-size: 19px;
}

.state-title {
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state-list {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(var(--state-columns), minmax(38px, 1fr));
  gap: 8px 6px;
  margin-top: 12px;
}

.state-card--single .state-list {
  align-items: center;
}

.state-card--compact .state-list {
  gap: 6px;
  margin-top: 8px;
}

.state-item {
  display: flex;
  min-width: 38px;
  align-items: center;
  flex-direction: column;
  gap: 7px;
  padding: 7px 4px 8px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--app-surface-subtle);
}

.state-card--single .state-item {
  min-height: 44px;
  flex-direction: row;
  justify-content: center;
  gap: 10px;
  padding: 6px 12px;
}

.state-card--compact:not(.state-card--single) .state-item {
  gap: 5px;
  padding: 5px 4px 6px;
}

.state-item--active {
  border-color: rgba(82, 151, 103, 0.16);
  background: rgba(82, 151, 103, 0.09);
}

.state-item--inactive {
  border-color: rgba(151, 145, 137, 0.12);
  background: rgba(151, 145, 137, 0.07);
}

.state-item--empty {
  border-color: rgba(174, 180, 187, 0.12);
  background: rgba(174, 180, 187, 0.06);
}

.state-label {
  color: var(--app-text);
  font-size: 0.75rem;
  font-weight: 600;
}

.state-indicator {
  width: 9px;
  height: 9px;
  border: 2px solid currentColor;
  border-radius: 50%;
  background: transparent;
}

.state-indicator--active {
  border-color: #529767;
  background: #529767;
  box-shadow: 0 0 0 4px rgba(82, 151, 103, 0.12);
}

.state-indicator--inactive {
  border-color: #aaa49d;
  background: var(--app-surface);
}

.state-indicator--empty {
  border-color: #aeb4bb;
  border-style: dashed;
}
</style>
