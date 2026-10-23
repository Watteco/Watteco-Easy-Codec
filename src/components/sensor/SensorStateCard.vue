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
        <button
          type="button"
          class="state-settings-button"
          :aria-label="settingsLabel"
          @click="settingsOpen = true"
        >
          <state-mapping-icon :inverted="inverted" aria-hidden="true" />
        </button>
      </div>

      <div class="state-list">
        <div
          v-for="entry in entries"
          :key="entry.measId"
          class="state-item"
          :class="{
            'state-item--active': getVisualState(entry.value) === true,
            'state-item--inactive': getVisualState(entry.value) === false,
            'state-item--empty': normalizeState(entry.value) === null,
          }"
          :aria-label="`${entry.label}: ${formatState(entry.value)}`"
          :title="`${entry.label}: ${formatState(entry.value)}`"
        >
          <span v-if="entries.length > 1" class="state-label">{{ entry.label }}</span>
          <span
            class="state-indicator"
            :class="{
              'state-indicator--active': getVisualState(entry.value) === true,
              'state-indicator--inactive': getVisualState(entry.value) === false,
              'state-indicator--empty': normalizeState(entry.value) === null,
            }"
            aria-hidden="true"
          />
        </div>
      </div>
    </ion-card-content>
  </ion-card>

  <ion-modal
    class="state-settings-modal"
    :style="{ '--state-accent': accent }"
    :is-open="settingsOpen"
    :initial-breakpoint="0.55"
    :breakpoints="[0, 0.55]"
    @did-dismiss="settingsOpen = false"
  >
    <div class="state-settings">
      <div class="state-settings__header">
        <h2>{{ settingsTitle }}</h2>
        <button
          type="button"
          class="state-settings__close"
          :aria-label="closeLabel"
          @click="settingsOpen = false"
        >
          <ion-icon :icon="closeOutline" aria-hidden="true" />
        </button>
      </div>

      <div class="state-settings__mapping" :aria-label="mappingLabel">
        <div class="state-settings__row">
          <span
            class="state-settings__preview"
            :class="inverted ? 'state-settings__preview--inactive' : 'state-settings__preview--active'"
            aria-hidden="true"
          >
            <span
              class="state-indicator"
              :class="inverted ? 'state-indicator--inactive' : 'state-indicator--active'"
            />
          </span>
          <span class="state-settings__value">{{ highLabel }}</span>
        </div>
        <div class="state-settings__row">
          <span
            class="state-settings__preview"
            :class="inverted ? 'state-settings__preview--active' : 'state-settings__preview--inactive'"
            aria-hidden="true"
          >
            <span
              class="state-indicator"
              :class="inverted ? 'state-indicator--active' : 'state-indicator--inactive'"
            />
          </span>
          <span class="state-settings__value">{{ lowLabel }}</span>
        </div>
      </div>

      <button type="button" class="state-settings__invert" @click="toggleInversion">
        <ion-icon :icon="swapVerticalOutline" aria-hidden="true" />
        <span>{{ invertLabel }}</span>
      </button>
      <p class="state-settings__note">{{ settingsNote }}</p>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonCard, IonCardContent, IonIcon, IonModal } from '@ionic/vue';
import { closeOutline, swapVerticalOutline, toggleOutline } from 'ionicons/icons';
import StateMappingIcon from '@/components/sensor/StateMappingIcon.vue';
import { useStateVisualPreference } from '@/composables/useStateVisualPreference';

type SensorStateValue = boolean | number | string | null;

const props = withDefaults(defineProps<{
  label: string;
  activeLabel: string;
  inactiveLabel: string;
  settingsLabel: string;
  settingsTitle: string;
  mappingLabel: string;
  invertLabel: string;
  settingsNote: string;
  closeLabel: string;
  highLabel?: string;
  lowLabel?: string;
  preferenceKey?: string;
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
  highLabel: 'High (1)',
  lowLabel: 'Low (0)',
  preferenceKey: 'default',
});

const settingsOpen = ref(false);
const { inverted, toggleInversion } = useStateVisualPreference(() => props.preferenceKey);

const normalizeState = (value: SensorStateValue): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string' || value.trim() === '') return null;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'on', 'active', 'open', 'high'].includes(normalized)) return true;
  if (['false', '0', 'off', 'inactive', 'closed', 'low'].includes(normalized)) return false;
  return null;
};

const getVisualState = (value: SensorStateValue): boolean | null => {
  const state = normalizeState(value);
  return state === null ? null : inverted.value ? !state : state;
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
  flex: 1;
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state-settings-button,
.state-settings__close {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--app-text-secondary);
  font-size: 18px;
}

.state-settings-button {
  margin-right: -12px;
  transform: translateY(-10px);
}

.state-settings-button .state-mapping-icon {
  flex: 0 0 auto;
}

.state-settings__close {
  color: var(--app-text);
  font-size: 22px;
}

.state-settings-button:active,
.state-settings__close:active {
  background: var(--app-surface-subtle);
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

.state-settings-modal {
  --border-radius: 20px 20px 0 0;
}

.state-settings {
  padding: 8px 20px max(24px, env(safe-area-inset-bottom));
  color: var(--app-text);
}

.state-settings__header {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.state-settings__header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
}

.state-settings__mapping {
  display: grid;
  gap: 10px;
  margin: 14px 0 18px;
}

.state-settings__row {
  display: grid;
  grid-template-columns: 88px 1fr;
  align-items: center;
  gap: 16px;
}

.state-settings__preview {
  display: grid;
  min-height: 62px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 14px;
  transition: border-color 180ms ease, background-color 180ms ease;
}

.state-settings__preview .state-indicator {
  transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
}

.state-settings__preview--active {
  border-color: rgba(82, 151, 103, 0.16);
  background: rgba(82, 151, 103, 0.09);
}

.state-settings__preview--inactive {
  border-color: rgba(151, 145, 137, 0.12);
  background: rgba(151, 145, 137, 0.07);
}

.state-settings__value {
  font-size: 0.95rem;
  font-weight: 600;
}

.state-settings__invert {
  display: flex;
  width: 100%;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 10px 16px;
  border: 1px solid color-mix(in srgb, var(--state-accent) 30%, var(--app-border));
  border-radius: 13px;
  background: color-mix(in srgb, var(--state-accent) 10%, var(--app-surface));
  color: var(--state-accent);
  font: inherit;
  font-weight: 650;
}

.state-settings__invert ion-icon {
  font-size: 20px;
}

.state-settings__note {
  margin: 12px 2px 0;
  color: var(--app-text-secondary);
  font-size: 0.78rem;
  line-height: 1.4;
}
</style>
