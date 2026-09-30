<template>
  <ion-card
    class="state-card"
    :class="{ 'state-card--wide': entries.length > 6 }"
    :aria-label="label"
  >
    <ion-card-content>
      <div class="state-heading">
        <span class="state-icon" aria-hidden="true">
          <ion-icon :icon="toggleOutline" />
        </span>
        <span class="state-title">{{ label }}</span>
      </div>

      <div class="state-list">
        <div
          v-for="entry in entries"
          :key="entry.measId"
          class="state-item"
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

const props = defineProps<{
  label: string;
  activeLabel: string;
  inactiveLabel: string;
  entries: Array<{
    measId: number;
    label: string;
    value: SensorStateValue;
  }>;
}>();

const normalizeState = (value: SensorStateValue): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string' || value.trim() === '') return null;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'on', 'active', 'open', 'high'].includes(normalized)) return true;
  if (['false', '0', 'off', 'inactive', 'closed', 'low'].includes(normalized)) return false;
  return null;
};

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
  border: 1px solid rgba(28, 35, 45, 0.08);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 3px 12px rgba(28, 35, 45, 0.08);
}

.state-card--wide {
  grid-column: 1 / -1;
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
  color: #626b75;
  font-size: 0.82rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state-list {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(28px, 1fr));
  gap: 14px 8px;
  margin-top: 12px;
}

.state-item {
  display: flex;
  min-width: 28px;
  align-items: center;
  flex-direction: column;
  gap: 9px;
}

.state-label {
  color: #303740;
  font-size: 0.75rem;
  font-weight: 600;
}

.state-indicator {
  width: 10px;
  height: 10px;
  border: 2px solid currentColor;
  background: transparent;
}

.state-indicator--active {
  border-color: #2dbb3f;
  background: #2dbb3f;
}

.state-indicator--inactive {
  border-color: #d71920;
}

.state-indicator--empty {
  border-color: #aeb4bb;
}
</style>
