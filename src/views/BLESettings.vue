<template>
  <ion-page>
    <ion-header class="settings-header">
      <ion-toolbar class="settings-toolbar">
        <ion-buttons slot="start">
          <ion-back-button default-href="/ble-connect" />
        </ion-buttons>
        <ion-title>{{ localize('@settings') }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item>
          <ion-select
            :label="localize('@language')"
            :value="currentLanguage"
            @ionChange="changeLanguage($event.detail.value)"
          >
            <ion-select-option value="fr">Français</ion-select-option>
            <ion-select-option value="en">English</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select
            :label="localize('@darkMode')"
            :value="themeMode"
            @ionChange="setThemeMode($event.detail.value)"
          >
            <ion-select-option value="off">{{ localize('@themeOff') }}</ion-select-option>
            <ion-select-option value="on">{{ localize('@themeOn') }}</ion-select-option>
            <ion-select-option value="system">{{ localize('@themeSystem') }}</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item
          :button="developerModeAvailable"
          :detail="false"
          @click="registerVersionTap"
        >
          <ion-label>{{ localize('@version') }}</ion-label>
          <ion-label slot="end" class="version-value">
            v{{ appVersion }}
            <ion-note v-if="developerModeEnabled" color="medium">
              {{ localize('@developerModeActive') }}
            </ion-note>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import {
  IonBackButton, IonButtons, IonContent, IonHeader,
  IonPage, IonTitle, IonToolbar, IonList, IonItem, IonSelect, IonSelectOption, IonLabel, IonNote,
} from '@ionic/vue';
import axios from 'axios';
import { appVersion } from '@/utils/appVersion';
import { useLanguage } from '@/composables/useLanguage';
import { useDeveloperMode } from '@/composables/useDeveloperMode';
import { useTheme } from '@/composables/useTheme';
import type { LanguageCode, Translations } from '@/types/localization';

import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

const { currentLanguage, changeLanguage } = useLanguage();
const { themeMode, setThemeMode } = useTheme();
const {
  developerModeAvailable,
  developerModeEnabled,
  toggleDeveloperMode,
} = useDeveloperMode();
const languages = ref<Record<LanguageCode, Translations>>({ en: {}, fr: {} });
let versionTapCount = 0;
let versionTapResetTimer: ReturnType<typeof setTimeout> | undefined;

const localize = (key: string): string => {
  if (!key.startsWith('@')) return key;
  return languages.value[currentLanguage.value][key.substring(1)] ?? key;
};

function registerVersionTap() {
  if (!developerModeAvailable) return;

  versionTapCount += 1;
  if (versionTapResetTimer) clearTimeout(versionTapResetTimer);

  if (versionTapCount === 5) {
    toggleDeveloperMode();
    versionTapCount = 0;
    return;
  }

  versionTapResetTimer = setTimeout(() => {
    versionTapCount = 0;
  }, 2000);
}

onMounted(async () => {
  try {
    const cacheBuster = `?v=${Date.now()}`;
    const [enResponse, frResponse] = await Promise.all([
      axios.get<Translations>(enUS + cacheBuster),
      axios.get<Translations>(frFR + cacheBuster),
    ]);
    languages.value.en = enResponse.data;
    languages.value.fr = frResponse.data;
  } catch (error) {
    console.error('Failed to load localization files', error);
  }
});

onUnmounted(() => {
  if (versionTapResetTimer) clearTimeout(versionTapResetTimer);
});
</script>

<style scoped>
.settings-header {
  box-shadow: none;
}

ion-content {
  --background: var(--app-page-background);
}

ion-list {
  background: transparent;
}

.settings-toolbar {
  --background: var(--ion-color-primary);
  --color: var(--ion-color-primary-contrast);
  --min-height: 82px;
  --padding-start: 8px;
  --padding-end: 12px;

  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
}

.settings-toolbar ion-back-button {
  width: 44px;
  height: 44px;
  --color: var(--ion-color-primary-contrast);
}

.settings-toolbar ion-title {
  font-size: 1.35rem;
}

.version-value {
  text-align: right;
}

.version-value ion-note {
  display: block;
  margin-top: 2px;
  font-size: 0.75rem;
}
</style>
