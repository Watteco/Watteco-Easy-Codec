<template>
  <button
    v-if="updateAvailable"
    type="button"
    class="web-update-button"
    :title="localize('webUpdateAvailable')"
    @click="applyWebUpdate"
  >
    <ion-icon :icon="refreshOutline" aria-hidden="true" />
    <span>{{ localize('webUpdateAction') }}</span>
    <small v-if="availableVersion">v{{ availableVersion }}</small>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { refreshOutline } from 'ionicons/icons';
import { useLanguage } from '@/composables/useLanguage';
import { useWebUpdate } from '@/composables/useWebUpdate';
import { createBundledTranslations } from '@/utils/localization';

const languages = createBundledTranslations();
const { currentLanguage } = useLanguage();
const { updateAvailable, availableVersion, applyWebUpdate } = useWebUpdate();
const translations = computed(() => languages[currentLanguage.value]);
const localize = (key: string) => translations.value[key] ?? key;
</script>

<style scoped>
.web-update-button {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 44px;
  padding: 9px 15px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.12);
  box-shadow: none;
  color: #fff;
  font: 600 14px/1.2 Arial, sans-serif;
  cursor: pointer;
  appearance: none;
  touch-action: manipulation;
}

.web-update-button:hover {
  background: rgba(255, 255, 255, 0.22);
}

.web-update-button:active {
  background: rgba(255, 255, 255, 0.32);
}

.web-update-button:focus-visible {
  outline: 3px solid #17365d;
  outline-offset: 2px;
}

.web-update-button ion-icon {
  flex: 0 0 auto;
  font-size: 19px;
}

.web-update-button > * {
  pointer-events: none;
}

.web-update-button small {
  opacity: 0.86;
  font-size: 11px;
}

@media (max-width: 520px) {
  .web-update-button {
    padding-inline: 11px;
  }

  .web-update-button small {
    display: none;
  }
}
</style>
