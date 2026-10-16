<template>
  <ion-page class="ble-finder-page">
    <ion-header translucent>
      <ion-toolbar class="ble-finder-toolbar">
        <ion-buttons slot="start">
          <ion-back-button default-href="/sensor-data" :text="''" />
        </ion-buttons>
        <ion-title>{{ localize('@bleFinderTitle') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ble-finder-content">
      <div
        class="ble-temperature-vignette"
        :class="{
          'ble-temperature-vignette--cold': extremeTemperature === 'cold',
          'ble-temperature-vignette--hot': extremeTemperature === 'hot',
        }"
        aria-hidden="true"
      ></div>

      <main class="ble-finder-shell">
        <p class="ble-finder-device">{{ sensorName }}</p>
        <p class="ble-finder-hint">{{ localize('@bleFinderHint') }}</p>

        <section class="ble-reading" aria-live="polite">
          <strong>{{ proximityLabel }}</strong>
          <span class="ble-reading-rssi">{{ rssiLabel }}</span>
          <span class="ble-reading-strength">
            {{ localize('@bleFinderRelativeStrength') }} · {{ signalPercent }}%
          </span>
        </section>

        <div
          class="ble-gauge-stage"
          :class="{ 'ble-gauge-stage--freezing': isFreezing }"
          :style="gaugeStyle"
          :aria-label="signalLabel"
          role="meter"
          aria-valuemin="-100"
          aria-valuemax="-50"
          :aria-valuenow="ble.bleRssi.value ?? undefined"
        >
          <div class="ble-gauge-track">
            <div class="ble-gauge-fill" aria-hidden="true"></div>
            <div v-if="hasSignal" class="ble-gauge-marker" aria-hidden="true">
              <span></span>
            </div>
          </div>

          <div class="ble-gauge-ticks" aria-hidden="true">
            <span v-for="tick in gaugeTicks" :key="tick">{{ tick }}</span>
          </div>

          <div class="ble-gauge-temperature" aria-hidden="true">
            <span>❄ {{ localize('@bleFinderCold') }}</span>
            <span>{{ localize('@bleFinderHot') }} 🔥</span>
          </div>
        </div>

        <p class="ble-finder-note">{{ localize('@bleFinderApproximation') }}</p>

        <div class="ble-temperature-emoji" :aria-label="proximityLabel" role="img">
          <span aria-hidden="true">{{ currentTemperatureEmoji }}</span>
        </div>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, type StyleValue } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { useBle } from '@/composables/useBle';
import { useLanguage } from '@/composables/useLanguage';
import type { LanguageCode, Translations } from '@/types/localization';
import { getBleSignalPercent } from '@/utils/BLE/rssi';

import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

const GAUGE_MIN_RSSI = -100;
const GAUGE_MAX_RSSI = -50;
const FREEZING_RSSI = -88;
const EXTREME_COLD_RSSI = -92;
const EXTREME_HOT_RSSI = -57;
const gaugeTicks = [-100, -90, -80, -70, -60, -50];
const temperatureEmojis = ['🧊', '🥶', '😨', '🙂', '😊', '🥵', '🔥'] as const;

const router = useRouter();
const ble = useBle();
const { currentLanguage } = useLanguage();
const languages = ref<Record<LanguageCode, Translations>>({ en: {}, fr: {} });

const localize = (key: string): string => {
  if (!key.startsWith('@')) return key;
  return languages.value[currentLanguage.value][key.substring(1)] ?? key;
};

const hasSignal = computed(() => ble.bleRssi.value !== null);
const signalPercent = computed(() => {
  if (ble.bleRssi.value === null) return 0;
  return getBleSignalPercent(ble.bleRssi.value, GAUGE_MIN_RSSI, GAUGE_MAX_RSSI);
});
const gaugeStyle = computed<StyleValue>(() => ({
  '--signal-percent': `${signalPercent.value}%`,
}));
const isFreezing = computed(() => (
  ble.bleRssi.value !== null && ble.bleRssi.value <= FREEZING_RSSI
));
const temperatureEmojiIndex = computed(() => {
  if (!hasSignal.value) return -1;
  return Math.round((signalPercent.value / 100) * (temperatureEmojis.length - 1));
});
const currentTemperatureEmoji = computed(() => (
  temperatureEmojiIndex.value < 0 ? '📡' : temperatureEmojis[temperatureEmojiIndex.value]
));
const extremeTemperature = computed<'cold' | 'hot' | null>(() => {
  const rssi = ble.bleRssi.value;
  if (rssi === null) return null;
  if (rssi <= EXTREME_COLD_RSSI) return 'cold';
  if (rssi >= EXTREME_HOT_RSSI) return 'hot';
  return null;
});
const sensorName = computed(() => {
  const device = ble.connectedDevice.value;
  return device ? ble.getDeviceName(device) : localize('@sensor');
});
const proximityLabel = computed(() => {
  const rssi = ble.bleRssi.value;
  if (rssi === null) return localize('@bleFinderSearching');
  if (rssi >= -60) return localize('@bleFinderVeryClose');
  if (rssi >= -72) return localize('@bleFinderClose');
  if (rssi >= -85) return localize('@bleFinderNearby');
  return localize('@bleFinderFar');
});
const rssiLabel = computed(() => (
  ble.bleRssi.value === null ? '— dBm' : `${ble.bleRssi.value} dBm`
));
const signalLabel = computed(() => (
  ble.bleRssi.value === null
    ? localize('@bleSignalUnavailable')
    : `${localize('@bleSignalStrength')}: ${ble.bleRssi.value} dBm, ${signalPercent.value}%`
));

watch(
  () => ble.connected.value,
  connected => {
    if (!connected) void router.replace('/sensor-data');
  },
);

onMounted(async () => {
  if (!ble.connected.value) {
    await router.replace('/sensor-data');
    return;
  }

  try {
    const cacheBuster = `?v=${Date.now()}`;
    const [enResponse, frResponse] = await Promise.all([
      axios.get<Translations>(enUS + cacheBuster),
      axios.get<Translations>(frFR + cacheBuster),
    ]);
    languages.value.en = enResponse.data;
    languages.value.fr = frResponse.data;
  } catch (error) {
    console.error('Failed to load BLE finder localization:', error);
  }
});
</script>

<style scoped>
.ble-finder-page {
  color: #f4f8ff;
  background: #07101d;
}

.ble-temperature-vignette {
  position: fixed;
  z-index: 0;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 700ms ease;
}

.ble-temperature-vignette--cold,
.ble-temperature-vignette--hot {
  opacity: 1;
  animation: vignette-breathe 1.8s ease-in-out infinite alternate;
}

.ble-temperature-vignette--cold {
  background: radial-gradient(ellipse at center, transparent 34%, rgba(17, 89, 255, 0.14) 61%, rgba(26, 105, 255, 0.72) 100%);
  box-shadow: inset 0 0 90px 25px rgba(45, 124, 255, 0.58);
}

.ble-temperature-vignette--hot {
  background: radial-gradient(ellipse at center, transparent 34%, rgba(255, 76, 35, 0.14) 61%, rgba(255, 55, 22, 0.7) 100%);
  box-shadow: inset 0 0 90px 25px rgba(255, 73, 35, 0.56);
}

.ble-finder-toolbar {
  --background: #0c1828;
  --border-color: rgba(130, 184, 255, 0.2);
  --color: #f4f8ff;
}

.ble-finder-content {
  --background: radial-gradient(circle at 50% 38%, #172c42 0%, #0a1725 44%, #050b13 100%);
}

.ble-finder-shell {
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100%;
  padding: 34px 22px calc(28px + env(safe-area-inset-bottom));
  text-align: center;
}

.ble-finder-device {
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  color: #8fc5ff;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.ble-finder-hint {
  max-width: 30rem;
  margin: 8px 0 32px;
  color: rgba(244, 248, 255, 0.72);
  font-size: 0.95rem;
  line-height: 1.4;
}

.ble-reading {
  display: grid;
  justify-items: center;
}

.ble-reading strong {
  color: #fff;
  font-size: clamp(1.7rem, 8vw, 2.5rem);
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.14);
}

.ble-reading-rssi {
  margin-top: 7px;
  color: #fff;
  font-size: clamp(1.2rem, 5vw, 1.55rem);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.ble-reading-strength {
  margin-top: 3px;
  color: rgba(244, 248, 255, 0.58);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  text-transform: uppercase;
}

.ble-gauge-stage {
  width: min(86vw, 560px);
  margin-top: 36px;
  transform-origin: center;
}

.ble-gauge-track {
  position: relative;
  height: 70px;
  overflow: visible;
  border: 2px solid rgba(255, 255, 255, 0.24);
  border-radius: 22px;
  background: linear-gradient(90deg, rgba(77, 176, 255, 0.12), rgba(86, 236, 184, 0.12) 48%, rgba(255, 210, 79, 0.12) 72%, rgba(255, 100, 65, 0.12));
  box-shadow: inset 0 3px 16px rgba(0, 0, 0, 0.42), 0 12px 34px rgba(0, 0, 0, 0.24);
}

.ble-gauge-fill {
  position: absolute;
  inset: 6px;
  border-radius: 15px;
  background: linear-gradient(90deg, #54b8ff, #55e5bc 48%, #ffd354 72%, #ff6348);
  box-shadow: 0 0 22px rgba(85, 205, 255, 0.35);
  clip-path: inset(0 calc(100% - var(--signal-percent)) 0 0 round 15px);
  transition: clip-path 650ms ease-out;
}

.ble-gauge-marker {
  position: absolute;
  top: -10px;
  bottom: -10px;
  left: var(--signal-percent);
  width: 4px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 0 14px rgba(255, 255, 255, 0.9);
  transform: translateX(-50%);
  transition: left 650ms ease-out;
}

.ble-gauge-marker span {
  position: absolute;
  top: -7px;
  left: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 14px rgba(255, 255, 255, 0.9);
  transform: translateX(-50%);
}

.ble-gauge-ticks {
  display: flex;
  justify-content: space-between;
  padding: 9px 1px 0;
  color: rgba(244, 248, 255, 0.48);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.ble-gauge-temperature {
  display: flex;
  justify-content: space-between;
  margin-top: 15px;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ble-gauge-temperature span:first-child { color: #75c8ff; }
.ble-gauge-temperature span:last-child { color: #ff886f; }

.ble-gauge-stage--freezing {
  animation: gauge-shiver 150ms ease-in-out infinite alternate;
}

.ble-finder-note {
  max-width: 28rem;
  margin: 32px 0 0;
  color: rgba(244, 248, 255, 0.48);
  font-size: 0.78rem;
}

.ble-temperature-emoji {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 150px;
  width: 100%;
  min-height: 110px;
  margin-top: auto;
  padding: clamp(18px, 4vh, 36px) 0 8px;
}

.ble-temperature-emoji span {
  font-size: clamp(4rem, 22vw, 7rem);
  line-height: 1;
  filter: drop-shadow(0 18px 28px rgba(0, 0, 0, 0.32));
  transition: filter 500ms ease, transform 500ms ease;
}

@keyframes gauge-shiver {
  0% { transform: translate3d(-1px, 0, 0) rotate(-0.15deg); }
  45% { transform: translate3d(1px, -1px, 0) rotate(0.1deg); }
  100% { transform: translate3d(0, 1px, 0) rotate(0.18deg); }
}

@keyframes vignette-breathe {
  from { filter: saturate(0.9); }
  to { filter: saturate(1.3); }
}

@media (prefers-reduced-motion: reduce) {
  .ble-gauge-fill,
  .ble-gauge-marker {
    transition: none;
  }

  .ble-gauge-stage--freezing {
    animation: none;
  }

  .ble-temperature-vignette--cold,
  .ble-temperature-vignette--hot {
    animation: none;
  }
}

@media (max-height: 700px) {
  .ble-finder-shell { padding-top: 20px; }
  .ble-finder-hint { margin-bottom: 18px; }
  .ble-gauge-stage { margin-top: 24px; }
  .ble-finder-note { margin-top: 20px; }
  .ble-temperature-emoji {
    min-height: 90px;
    padding-top: 14px;
  }

  .ble-temperature-emoji span { font-size: clamp(3.75rem, 16vh, 5.5rem); }
}
</style>
