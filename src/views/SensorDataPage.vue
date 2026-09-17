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
        <section class="dashboard-section">
          <h2 class="section-title">{{ localize('@currentValues') }}</h2>
          <div class="sensor-grid">
            <sensor-metric-card
              :label="localize('@temperatureLabel')"
              :value="displayedValues.temperature"
              unit="°C"
              :icon="temperatureVisual.icon"
              :accent="temperatureVisual.accent"
              :decimals="1"
            />
            <sensor-metric-card
              :label="localize('@humidityLabel')"
              :value="displayedValues.humidity"
              unit="%"
              :icon="humidityVisual.icon"
              :accent="humidityVisual.accent"
              :decimals="1"
            />
            <sensor-metric-card
              :label="localize('@batteryLevelLabel')"
              :value="displayedValues.battery"
              unit="V"
              :icon="batteryVisual.icon"
              :accent="batteryVisual.accent"
              :decimals="3"
            />
            <sensor-metric-card
              :label="localize('@counterLabel')"
              :value="displayedValues.counter"
              unit=""
              :icon="counterVisual.icon"
              :accent="counterVisual.accent"
              :decimals="0"
            />
          </div>
        </section>

        <section class="dashboard-section">
          <h2 class="section-title">{{ localize('@historyLabel') }}</h2>
          <div class="sensor-grid">
            <sensor-history-card
              :label="localize('@temperatureHistoryLabel')"
              :subtitle="localize('@timestampedValuesLabel')"
              :empty-label="localize('@noHistoryData')"
              :points="displayedTemperatureHistory"
              unit="°C"
              :accent="temperatureVisual.accent"
              :decimals="1"
            />
            <sensor-history-card
              :label="localize('@humidityHistoryLabel')"
              :subtitle="localize('@timestampedValuesLabel')"
              :empty-label="localize('@noHistoryData')"
              :points="displayedHumidityHistory"
              unit="%"
              :accent="humidityVisual.accent"
              :decimals="1"
            />
          </div>
        </section>

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
      <ion-button size="small" fill="solid" color="medium" @click="demoDataEnabled = !demoDataEnabled">
        Demo data: {{ demoDataEnabled ? 'on' : 'off' }}
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
  IonContent,
  IonHeader,
  IonIcon,
  IonImg,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import {
  bluetoothOutline,
  refreshOutline,
  settingsOutline,
} from 'ionicons/icons';
import { useBle } from '@/composables/useBle';
import { useLanguage } from '@/composables/useLanguage';
import type { LanguageCode, Translations } from '@/types/localization';
import SensorHistoryCard from '@/components/sensor/SensorHistoryCard.vue';
import SensorMetricCard from '@/components/sensor/SensorMetricCard.vue';
import { getSensorVisual } from '@/utils/sensorVisuals';

import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

const router = useRouter();
const ble = useBle();
const bleDebugEnabledByEnv = import.meta.env.DEV || import.meta.env.VITE_ENABLE_BLE_DEBUG === 'true';
const { currentLanguage } = useLanguage();
const languages = ref<Record<LanguageCode, Translations>>({ en: {}, fr: {} });
const logoSrc = ref('');

const temperatureVisual = getSensorVisual('temperature#249');
const humidityVisual = getSensorVisual('humidity#49');
const batteryVisual = getSensorVisual('disposable_battery_voltage#39');
const counterVisual = getSensorVisual('index#54');

type SensorValues = {
  temperature: number | null;
  humidity: number | null;
  battery: number | null;
  counter: number | null;
};

type HistoryPoint = {
  timestamp: number;
  value: number;
};

const sensorValues = ref<SensorValues>({
  temperature: null,
  humidity: null,
  battery: null,
  counter: null,
});
const temperatureHistory = ref<HistoryPoint[]>([]);
const humidityHistory = ref<HistoryPoint[]>([]);
const demoDataEnabled = ref(false);
const demoEndTimestamp = Date.now();
const createDemoHistory = (values: number[]): HistoryPoint[] => values.map((value, index) => ({
  timestamp: demoEndTimestamp - (values.length - index - 1) * 5 * 60 * 1000,
  value,
}));
const demoTemperatureHistory = createDemoHistory([
  20.4, 20.8, 21.1, 21.7, 22.3, 22.1, 22.8, 23.2, 22.9, 23.5, 23.1, 22.7,
]);
const demoHumidityHistory = createDemoHistory([
  48.2, 49.1, 50.4, 49.8, 51.2, 52.6, 51.9, 50.7, 49.9, 50.5, 51.1, 50.8,
]);
const displayedValues = computed<SensorValues>(() => demoDataEnabled.value
  ? { temperature: 22.7, humidity: 50.8, battery: 3.597, counter: 1248 }
  : sensorValues.value);
const displayedTemperatureHistory = computed(() => demoDataEnabled.value
  ? demoTemperatureHistory
  : temperatureHistory.value);
const displayedHumidityHistory = computed(() => demoDataEnabled.value
  ? demoHumidityHistory
  : humidityHistory.value);

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

.dashboard-section + .dashboard-section {
  margin-top: 24px;
}

.section-title {
  margin: 0 4px 10px;
  color: #3e4650;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sensor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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

.connection-status strong {
  overflow: hidden;
  font-size: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
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
