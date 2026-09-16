<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-img id="watteco-logo" :src="logoSrc" />
        <ion-title size="large" id="watteco-title">
          {{ localize('@sensorDataTitle') }}
        </ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="sensor-data-content">
      <div class="sensor-data-container">
        <ion-card class="data-placeholder">
          <ion-card-content>
            <ion-icon :icon="analyticsOutline" class="placeholder-icon" />
            <h2>{{ localize('@sensorDataComingSoon') }}</h2>
            <p>{{ localize('@sensorDataComingSoonDescription') }}</p>
          </ion-card-content>
        </ion-card>

      </div>
    </ion-content>

    <div
      class="connection-banner"
      :class="{ 'connection-banner--disconnected': bannerState !== 'connected' }"
    >
      <div class="connection-status">
        <ion-icon :icon="bluetoothOutline" class="connection-icon" />
        <strong>
          {{ bannerState === 'connected'
            ? localize('@bleConnectedTo') + ' ' + bannerDeviceName
            : localize('@bleNotConnected') }}
        </strong>
      </div>

      <ion-button
        v-if="bannerState === 'reconnect'"
        size="small"
        color="primary"
        class="banner-action"
        :disabled="ble.reconnecting.value || ble.pairing.value"
        @click="reconnect"
      >
        <ion-spinner v-if="ble.reconnecting.value" slot="start" name="crescent" />
        <ion-icon v-else slot="start" :icon="refreshOutline" />
        {{ ble.reconnecting.value ? localize('@bleReconnecting') : localize('@bleReconnect') }}
      </ion-button>

      <ion-button
        v-else-if="bannerState === 'choose'"
        size="small"
        color="primary"
        class="banner-action"
        @click="chooseSensor"
      >
        {{ localize('@chooseSensor') }}
      </ion-button>

      <ion-button
        v-else
        fill="clear"
        color="medium"
        class="config-icon-button"
        :aria-label="localize('@openSensorConfiguration')"
        @click="openConfiguration"
      >
        <ion-icon slot="icon-only" :icon="settingsOutline" />
      </ion-button>
    </div>

    <div v-if="bleDebugEnabledByEnv" class="debug-corner">
      <ion-button size="small" fill="solid" color="medium" @click="openConfiguration">
        Open config (dev)
      </ion-button>
      <ion-button size="small" fill="solid" color="medium" @click="cycleBannerPreview">
        Banner: {{ bannerPreviewLabel }}
      </ion-button>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonImg,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { analyticsOutline, bluetoothOutline, refreshOutline, settingsOutline } from 'ionicons/icons';
import { useBle } from '@/composables/useBle';
import { useLanguage } from '@/composables/useLanguage';
import type { LanguageCode, Translations } from '@/types/localization';

import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

const router = useRouter();
const ble = useBle();
const bleDebugEnabledByEnv = import.meta.env.DEV || import.meta.env.VITE_ENABLE_BLE_DEBUG === 'true';
const { currentLanguage } = useLanguage();
const languages = ref<Record<LanguageCode, Translations>>({ en: {}, fr: {} });
const logoSrc = ref('');

type BannerState = 'connected' | 'reconnect' | 'choose';
type BannerPreview = 'actual' | BannerState;

const bannerPreviewStates: BannerPreview[] = ['actual', 'connected', 'reconnect', 'choose'];
const bannerPreviewIndex = ref(0);
const bannerPreview = computed(() => bannerPreviewStates[bannerPreviewIndex.value]);
const actualBannerState = computed<BannerState>(() => {
  if (ble.connected.value) return 'connected';
  return ble.lastConnectedDevice.value ? 'reconnect' : 'choose';
});
const bannerState = computed<BannerState>(() => (
  bannerPreview.value === 'actual' ? actualBannerState.value : bannerPreview.value
));
const bannerDeviceName = computed(() => {
  if (bannerPreview.value === 'connected' && !ble.connectedDevice.value) return 'WS-DEMO';
  return ble.connectedDevice.value ? ble.getDeviceName(ble.connectedDevice.value) : 'WS-DEMO';
});
const bannerPreviewLabel = computed(() => ({
  actual: 'real',
  connected: 'connected',
  reconnect: 'reconnect',
  choose: 'choose',
}[bannerPreview.value]));

const localize = (key: string): string => {
  if (!key.startsWith('@')) return key;
  return languages.value[currentLanguage.value][key.substring(1)] ?? key;
};

onMounted(async () => {
  logoSrc.value = `${import.meta.env.BASE_URL}img/LOGO-WATTECO_v2021_wbg_ctr.png`;

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

const reconnect = async () => {
  await ble.reconnectToLastDevice();
};

const chooseSensor = () => {
  router.replace('/ble-connect');
};

const openConfiguration = () => {
  router.push('/tabs/downlink');
};

const cycleBannerPreview = () => {
  bannerPreviewIndex.value = (bannerPreviewIndex.value + 1) % bannerPreviewStates.length;
};
</script>

<style scoped>
.sensor-data-content {
  --background: #fff7ee;
}

.sensor-data-container {
  width: min(100%, 720px);
  margin: 0 auto;
  padding: 20px 12px 88px;
}

.connection-banner {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 52px;
  padding: 6px 12px calc(6px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(0, 0, 0, 0.14);
  background: var(--ion-background-color, #fff7ee);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.12);
}

.connection-banner--disconnected {
  background: var(--ion-color-warning);
}

.connection-status {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.data-placeholder h2 {
  margin: 0;
  font-weight: 600;
}

.connection-status strong {
  overflow: hidden;
  font-size: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-placeholder p {
  margin: 8px 0 0;
}

.connection-icon {
  flex: 0 0 auto;
  font-size: 24px;
}

.banner-action {
  flex: 0 0 auto;
  margin: 0;
  min-height: 32px;
  --padding-start: 10px;
  --padding-end: 10px;
  font-weight: 600;
}

.config-icon-button {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  margin: 0;
  --padding-start: 6px;
  --padding-end: 6px;
}

.config-icon-button ion-icon {
  font-size: 24px;
}

.debug-corner {
  position: fixed;
  left: 12px;
  bottom: calc(64px + env(safe-area-inset-bottom));
  z-index: 1100;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.data-placeholder {
  min-height: 260px;
  margin: 0 0 20px;
}

.data-placeholder ion-card-content {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.placeholder-icon {
  margin-bottom: 16px;
  color: var(--ion-color-primary);
  font-size: 54px;
}

#watteco-logo {
  width: 150px;
  height: auto;
  position: absolute;
  top: 15px;
  left: 15px;
}

#watteco-title {
  position: relative;
  left: 170px;
  font-size: 1.5rem;
  font-weight: bold;
}

@media (max-width: 600px) {
  #watteco-title {
    left: 90px;
    font-size: 1.1rem;
  }

  #watteco-logo {
    width: 70px;
    top: 18px;
    left: 10px;
  }
}
</style>
