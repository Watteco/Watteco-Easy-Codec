<template>
  <ion-page>
    <sensor-mobile-navigation
      active-page="data"
      :localize="localize"
      :status="bannerState"
      :device-name="bannerDeviceName"
      :battery-level="bannerBatteryLevel"
    />

    <ion-content :fullscreen="true" class="sensor-data-content native-with-sensor-navigation">
      <div class="sensor-data-container">
        <section v-if="currentCards.length" class="dashboard-section">
          <h2 class="section-title">{{ localize('@currentValues') }}</h2>
          <div class="sensor-grid">
            <template v-for="currentCard in currentCards" :key="currentCard.key">
              <sensor-metric-card
                v-if="currentCard.type === 'metric'"
                :label="currentCard.card.name"
                :official-label="currentCard.card.officialName"
                :value="currentCard.card.value"
                :unit="currentCard.card.unit"
                :icon="currentCard.card.visual.icon"
                :accent="currentCard.card.visual.accent"
                :decimals="currentCard.card.decimals"
                :compact="currentCard.card.compact"
              />
              <sensor-state-card
                v-else
                :label="stateCardLabel"
                :active-label="localize('@activeState')"
                :inactive-label="localize('@inactiveState')"
                :entries="stateEntries"
                :accent="stateCardVisual?.accent"
                :icon="stateCardVisual?.icon"
              />
            </template>
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
              :min-value="card.visual.historyMin"
              :max-value="card.visual.historyMax"
            />
          </div>
        </section>

      </div>
    </ion-content>

    <div v-if="developerModeEnabled" class="debug-corner">
      <div v-show="debugToolsVisible" id="sensor-debug-actions" class="debug-actions">
        <ion-button size="small" fill="solid" color="medium" @click="openDebugSensorPicker">
          Sensor: {{ ble.productReference.value ?? 'choose' }}
        </ion-button>
        <ion-button size="small" fill="solid" color="medium" @click="cycleBannerPreview">
          Banner: {{ bannerPreviewLabel }}
        </ion-button>
        <ion-button size="small" fill="solid" color="medium" @click="demoDataEnabled = !demoDataEnabled">
          Demo data: {{ demoDataEnabled ? 'on' : 'off' }}
        </ion-button>
        <ion-button size="small" fill="solid" color="medium" @click="openBleMeasurementLog">
          BLE values log
        </ion-button>
      </div>
      <button
        type="button"
        class="debug-toggle"
        :class="{ 'debug-toggle--collapsed': !debugToolsVisible }"
        :aria-expanded="debugToolsVisible"
        aria-controls="sensor-debug-actions"
        :title="debugToolsVisible ? 'Hide debug tools' : 'Show debug tools'"
        @click="toggleDebugTools"
      >
        {{ debugToolsVisible ? 'Hide' : 'DEV' }}
      </button>
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
  IonPage,
  alertController,
  onIonViewDidEnter,
} from '@ionic/vue';
import { useBle } from '@/composables/useBle';
import { useLanguage } from '@/composables/useLanguage';
import { useDeveloperMode } from '@/composables/useDeveloperMode';
import { useTheme } from '@/composables/useTheme';
import type { LanguageCode, Translations } from '@/types/localization';
import SensorHistoryCard from '@/components/sensor/SensorHistoryCard.vue';
import SensorMetricCard from '@/components/sensor/SensorMetricCard.vue';
import SensorMobileNavigation from '@/components/sensor/SensorMobileNavigation.vue';
import SensorStateCard from '@/components/sensor/SensorStateCard.vue';
import { getAvailableProductChoices, getProductMeasurements } from '@/utils/productMeasurements';
import {
  getSensorCardLabel,
  getSensorDisplayDecimals,
  getSensorVisual,
  hasSensorVisual,
} from '@/utils/sensorVisuals';
import { playSensorPageTransition } from '@/utils/sensorPageTransition';

import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

const router = useRouter();
const ble = useBle();
const { developerModeEnabled } = useDeveloperMode();
const { isDarkMode } = useTheme();
const { currentLanguage } = useLanguage();
const languages = ref<Record<LanguageCode, Translations>>({ en: {}, fr: {} });

onIonViewDidEnter(() => {
  playSensorPageTransition('data', '.sensor-data-content');
});

type HistoryPoint = {
  timestamp: number;
  value: number;
};

type SensorValue = boolean | number | string | null;

const productMeasurements = computed(() => getProductMeasurements(ble.productReference.value));
const measurementValues = computed<Record<number, SensorValue>>(() => {
  const values: Record<number, SensorValue> = {};
  for (const measurement of productMeasurements.value) {
    const value = ble.measurementValues.value[measurement.id];
    if (value !== undefined) values[measurement.measId] = value;
  }
  return values;
});
const demoDataEnabled = ref(false);
const debugToolsStorageKey = 'sensor-debug-tools-visible';
const debugToolsVisible = ref(sessionStorage.getItem(debugToolsStorageKey) === 'true');
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
const demoBatteryHistory = createDemoHistory([
  96, 95, 95, 94, 93, 92, 91, 91, 90, 89, 88, 87,
]);
const sensorCards = computed(() => productMeasurements.value
  .filter(measurement => hasSensorVisual(measurement.measId))
  .map(measurement => ({
    ...measurement,
    visual: getSensorVisual(measurement.measId, isDarkMode.value),
  }))
  .filter(card => card.visual.category !== 'state'));
const batteryCardCount = computed(() => sensorCards.value
  .filter(card => card.visual.category === 'battery')
  .length);
const bannerBatteryLevel = computed(() => (
  demoDataEnabled.value && batteryCardCount.value === 1 ? 87 : undefined
));

const getDemoValue = (measId: number, category?: string): number | null => {
  if (category === 'battery') return 87;
  if (measId >= 54 && measId <= 64) return 1248 + ((measId - 54) * 137);
  if ([49, 50, 51].includes(measId)) return 50.8;
  if ([8, ...Array.from({ length: 18 }, (_, index) => 249 + index)].includes(measId)) return 22.7;
  return null;
};

const displayedCards = computed(() => sensorCards.value.map((card) => {
  const isBattery = card.visual.category === 'battery';
  const batteryLevel = ble.measurementValues.value.battery_level_percent;
  const measuredValue = isBattery
    ? (typeof batteryLevel === 'number' ? batteryLevel : null)
    : measurementValues.value[card.measId] ?? null;
  return {
    ...card,
    officialName: card.name,
    name: getSensorCardLabel(card.id, card.name, card.visual, localize),
    unit: isBattery ? '%' : card.unit,
    decimals: isBattery ? 0 : getSensorDisplayDecimals(card.decimals, card.visual),
    compact: isBattery && batteryCardCount.value === 1,
    value: demoDataEnabled.value
      ? getDemoValue(card.measId, card.visual.category)
      : typeof measuredValue === 'boolean'
        ? (measuredValue ? localize('@activeState') : localize('@inactiveState'))
        : measuredValue,
  };
}));

const stateEntries = computed(() => productMeasurements.value
  .map((measurement) => {
    const visual = getSensorVisual(measurement.measId, isDarkMode.value);
    if (visual.category !== 'state') return null;

    const match = measurement.id.match(/^pin_state(?:_(\d+))?$/);
    const inputNumber = match?.[1] ? Number(match[1]) : null;
    return {
      measId: measurement.measId,
      visual,
      inputNumber,
      label: inputNumber === null
        ? localize('@InputLabel')
        : String(inputNumber),
      value: demoDataEnabled.value
        ? (inputNumber ?? 1) % 2 === 1
        : measurementValues.value[measurement.measId] ?? null,
    };
  })
  .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  .sort((left, right) => (left.inputNumber ?? 0) - (right.inputNumber ?? 0)));

const stateCardVisual = computed(() => stateEntries.value[0]?.visual);
const stateCardLabel = computed(() => localize(
  stateEntries.value.length === 1
    ? '@SingleStateLabel'
    : stateCardVisual.value?.labelKey ?? '@PulseStateLabel',
));
const currentCards = computed(() => [
  ...displayedCards.value
    .filter(card => batteryCardCount.value !== 1 || card.visual.category !== 'battery')
    .map(card => ({
      type: 'metric' as const,
      key: `metric-${card.measId}`,
      priority: card.visual.priority ?? 0,
      card,
    })),
  ...(stateEntries.value.length ? [{
    type: 'state' as const,
    key: 'state',
    priority: stateCardVisual.value?.priority ?? 0,
  }] : []),
].sort((left, right) => right.priority - left.priority));

const historyCards = computed(() => displayedCards.value
  .filter(card => card.visual.history)
  .map((card) => {
    const historyKey = card.visual.category === 'battery'
      ? 'battery_level_percent'
      : card.id;
    return {
      ...card,
      history: demoDataEnabled.value
        ? card.visual.category === 'battery'
          ? demoBatteryHistory
          : [49, 50, 51].includes(card.measId)
            ? demoHumidityHistory
            : demoTemperatureHistory
        : ble.measurementHistory.value[historyKey] ?? [],
    };
  })
  .sort((left, right) => (right.visual.priority ?? 0) - (left.visual.priority ?? 0)));

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
  if (bannerPreview.value === 'connected' && !ble.connectedDevice.value) return 'WS123456';
  if (bannerPreview.value === 'reconnect' && !ble.lastConnectedDevice.value) return 'WS123456';
  const device = ble.connectedDevice.value ?? ble.lastConnectedDevice.value;
  return device ? ble.getDeviceName(device) : undefined;
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

const openBleMeasurementLog = async () => {
  const currentValues = Object.entries(ble.measurementValues.value)
    .filter(([measurementId]) => measurementId !== 'battery_level_percent')
    .map(([measurementId, value]) => `${measurementId}: ${String(value)}`);
  const lines = ble.eventsLog.value
    .filter(line => line.includes('[MEAS') && !line.includes('00002a19'))
    .slice(0, 80);
  const message = [
    'Current app values:',
    ...(currentValues.length ? currentValues : ['No counter/state values']),
    '',
    'Recent counter/state BLE changes:',
    ...(lines.length ? lines : ['No counter/state BLE changes']),
  ].join('\n');
  const alert = await alertController.create({
    header: 'BLE measurement log',
    message,
    cssClass: 'ble-measurement-log-alert',
    buttons: ['OK'],
  });
  await alert.present();
};

const localize = (key: string): string => {
  if (!key.startsWith('@')) return key;
  return languages.value[currentLanguage.value][key.substring(1)] ?? key;
};

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

const openConfiguration = () => {
  router.push('/tabs/downlink');
};

const cycleBannerPreview = () => {
  bannerPreviewIndex.value = (bannerPreviewIndex.value + 1) % bannerPreviewStates.length;
};

const toggleDebugTools = () => {
  debugToolsVisible.value = !debugToolsVisible.value;
  sessionStorage.setItem(debugToolsStorageKey, String(debugToolsVisible.value));
};
</script>

<style scoped>
.sensor-data-content {
  --background: var(--app-page-background);
}

.native-with-sensor-navigation {
  --padding-top: calc(82px + env(safe-area-inset-top));
  --padding-bottom: calc(62px + env(safe-area-inset-bottom));
}

.sensor-data-container {
  width: min(100%, 720px);
  margin: 0 auto;
  padding: 20px 12px;
}

.dashboard-section + .dashboard-section {
  margin-top: 24px;
}

.section-title {
  margin: 0 4px 10px;
  color: var(--app-text-secondary);
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sensor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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

.debug-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.debug-toggle {
  min-width: 52px;
  margin: 4px 4px 0;
  padding: 5px 10px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 999px;
  color: #fff;
  background: rgba(73, 78, 86, 0.9);
  box-shadow: 0 2px 5px rgba(28, 35, 45, 0.2);
  cursor: pointer;
  font-size: 0.68rem;
  font-family: inherit;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.debug-toggle--collapsed {
  min-width: 44px;
  opacity: 0.72;
}

:global(.ble-measurement-log-alert .alert-message) {
  max-height: 50vh;
  overflow: auto;
  text-align: left;
  white-space: pre-wrap;
}

</style>
