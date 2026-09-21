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
              v-for="card in displayedCards"
              :key="card.measId"
              :label="card.name"
              :value="card.value"
              :unit="card.unit"
              :icon="card.visual.icon"
              :accent="card.visual.accent"
              :decimals="card.decimals"
            />
          </div>
        </section>

        <section v-if="historyCards.length" class="dashboard-section">
          <h2 class="section-title">{{ localize('@historyLabel') }}</h2>
          <div class="sensor-grid">
            <sensor-history-card
              v-for="card in historyCards"
              :key="`history-${card.measId}`"
              :label="card.name"
              :subtitle="localize('@timestampedValuesLabel')"
              :empty-label="localize('@noHistoryData')"
              :points="card.history"
              :unit="card.unit"
              :accent="card.visual.accent"
              :decimals="card.decimals"
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
      <ion-button size="small" fill="solid" color="medium" @click="openDebugSensorPicker">
        Sensor: {{ ble.productReference.value ?? 'choose' }}
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
  alertController,
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
import { getAvailableProductChoices, getProductMeasurements } from '@/utils/productMeasurements';
import { getSensorVisual, hasSensorVisual } from '@/utils/sensorVisuals';

import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

const router = useRouter();
const ble = useBle();
const bleDebugEnabledByEnv = import.meta.env.DEV || import.meta.env.VITE_ENABLE_BLE_DEBUG === 'true';
const { currentLanguage } = useLanguage();
const languages = ref<Record<LanguageCode, Translations>>({ en: {}, fr: {} });
const logoSrc = ref('');

type HistoryPoint = {
  timestamp: number;
  value: number;
};

const measurementValues = ref<Record<number, number | string | null>>({});
const measurementHistory = ref<Record<number, HistoryPoint[]>>({});
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
const productMeasurements = computed(() => getProductMeasurements(ble.productReference.value));
const sensorCards = computed(() => productMeasurements.value
  .filter(measurement => hasSensorVisual(measurement.measId))
  .map(measurement => ({
    ...measurement,
    visual: getSensorVisual(measurement.measId),
  })));

const getDemoValue = (measId: number): number | null => {
  if (measId >= 54 && measId <= 64) return 1248 + ((measId - 54) * 137);
  if ([30, 31, 39, 230].includes(measId)) return 3.597;
  if ([49, 50, 51].includes(measId)) return 50.8;
  if ([8, ...Array.from({ length: 18 }, (_, index) => 249 + index)].includes(measId)) return 22.7;
  return null;
};

const displayedCards = computed(() => sensorCards.value.map(card => ({
  ...card,
  value: demoDataEnabled.value
    ? getDemoValue(card.measId)
    : measurementValues.value[card.measId] ?? null,
})));

const historyCards = computed(() => displayedCards.value
  .filter(card => card.visual.history)
  .map(card => ({
    ...card,
    history: demoDataEnabled.value
      ? ([49, 50, 51].includes(card.measId) ? demoHumidityHistory : demoTemperatureHistory)
      : measurementHistory.value[card.measId] ?? [],
  })));

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

const openDebugSensorPicker = async () => {
  const alert = await alertController.create({
    header: 'Choose a debug sensor',
    inputs: getAvailableProductChoices().map(product => ({
      type: 'radio',
      label: product.label,
      value: product.reference,
      checked: product.reference === ble.productReference.value,
    })),
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Choose',
        handler: (reference: string) => {
          ble.setProductReference(reference);
        },
      },
    ],
  });
  await alert.present();
};

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
