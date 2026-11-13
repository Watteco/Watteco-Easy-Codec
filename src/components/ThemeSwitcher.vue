<template>
  <div class="theme-switcher" role="group" :aria-label="label">
    <button
      v-for="option in themeOptions"
      :key="option.mode"
      type="button"
      class="theme-button"
      :class="{ active: themeMode === option.mode }"
      :aria-label="`${label}: ${optionLabels[option.mode]}`"
      :aria-pressed="themeMode === option.mode"
      :title="optionLabels[option.mode]"
      @click="$emit('update:themeMode', option.mode)"
    >
      <ion-icon :icon="option.icon" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { desktopOutline, moonOutline, sunnyOutline } from 'ionicons/icons';
import type { ThemeMode } from '@/composables/useTheme';

defineProps<{
  themeMode: ThemeMode;
  label: string;
  optionLabels: Record<ThemeMode, string>;
}>();

defineEmits<{
  (event: 'update:themeMode', mode: ThemeMode): void;
}>();

const themeOptions: Array<{ mode: ThemeMode; icon: string }> = [
  { mode: 'off', icon: sunnyOutline },
  { mode: 'on', icon: moonOutline },
  { mode: 'system', icon: desktopOutline },
];
</script>

<style scoped>
.theme-switcher {
  position: fixed;
  bottom: 16px;
  left: 16px;
  z-index: 1000;
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--ion-color-darkGrey);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.theme-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 22px;
  padding: 0;
  color: var(--ion-color-darkGrey-contrast);
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 2px;
  opacity: 0.6;
  transition: opacity 0.2s, transform 0.2s;
}

.theme-button:hover {
  opacity: 0.8;
  transform: scale(1.1);
}

.theme-button:focus-visible {
  outline: 2px solid var(--ion-color-darkGrey-contrast);
  outline-offset: 1px;
}

.theme-button.active {
  background: rgba(255, 255, 255, 0.1);
  opacity: 1;
}

.theme-button ion-icon {
  width: 18px;
  height: 18px;
}

@media (max-width: 600px) {
  .theme-switcher {
    bottom: 8px;
    left: 8px;
    padding: 2px;
  }

  .theme-button {
    width: 30px;
    height: 19px;
  }

  .theme-button ion-icon {
    width: 16px;
    height: 16px;
  }
}
</style>
