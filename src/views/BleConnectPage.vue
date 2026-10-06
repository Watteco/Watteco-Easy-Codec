<template>
  <ion-page>
    <ion-header class="ble-home-header-shell">
      <header class="ble-home-header">
        <img class="ble-home-logo" :src="logoSrc" alt="Watteco" />

        <div class="ble-home-identity">
          <strong>Neo Connect</strong>
          <span class="ble-home-context">{{ localize('@bleConnectionTitle') }}</span>
        </div>

        <button
          type="button"
          class="ble-home-header-action"
          :aria-label="localize('@settings')"
          @click="router.push('/ble-settings')"
        >
          <ion-icon :icon="settingsOutline" aria-hidden="true" />
        </button>
      </header>
    </ion-header>

    <ion-content class="ble-connect-content" :fullscreen="true">
      <div class="ble-connect-container">

        <div v-if="ble.pairing.value" class="pairing-banner">
          <ion-spinner name="crescent" />
          <div>
            <strong>{{ localize('@blePairingInProgress') }}</strong>
            <p>{{ localize('@blePairingConfirmation') }}</p>
          </div>
        </div>

        <div
          v-if="!ble.connected.value"
          class="scan-panel"
          :class="{
            'scan-panel--raised': scanPanelRaised,
            'scan-panel--scanning': showScanningIndicator && displayedDevices.length === 0,
          }"
        >
          <div
            v-if="displayedDevices.length === 0"
            class="empty-state"
            :aria-hidden="scanPanelRaised"
          >
            <ion-icon :icon="bluetoothOutline" class="empty-icon" />
            <p>{{ localize('@bleScanPrompt') }}</p>
          </div>

          <ion-button
            @click="connecting ? cancelConnection() : toggleScan()"
            expand="block"
            :color="ble.scanning.value || connecting ? 'medium' : 'primary'"
            :disabled="ble.pairing.value && !connecting"
            class="scan-button"
          >
            <ion-icon
              slot="start"
              :icon="ble.scanning.value || connecting ? closeOutline : searchOutline"
            />
            {{ localize(connecting ? '@bleCancelConnection' : ble.scanning.value ? '@bleCancelScan' : '@bleScan') }}
          </ion-button>

          <div
            v-if="showScanningIndicator && displayedDevices.length === 0"
            class="scanning-state"
            role="status"
            aria-live="polite"
          >
            <div class="scan-orbit" aria-hidden="true">
              <div class="scan-orbit-center">
                <ion-icon :icon="bluetoothOutline" />
              </div>
            </div>
            <p>{{ localize('@bleScanning') }}</p>
          </div>
        </div>

        <!-- Device list -->
        <ion-list v-if="!ble.connected.value && displayedDevices.length" class="device-list">
          <ion-item
            v-for="dev in displayedDevices"
            :key="dev.deviceId"
            button
            @click="onDeviceSelect(dev)"
            :disabled="connecting || ble.pairing.value"
          >
            <ion-icon :icon="bluetoothOutline" slot="start" color="primary" />
            <ion-label>
              <h2>{{ ble.getDeviceName(dev) }}</h2>
              <p>{{ dev.isSimulated ? localize('@bleSimulatedSensor') : dev.deviceId }}</p>
            </ion-label>
            <ion-spinner v-if="(connecting || ble.pairing.value) && connectingDeviceId === dev.deviceId" slot="end" name="crescent" />
          </ion-item>
        </ion-list>

        <div
          v-if="showScanningIndicator && displayedDevices.length > 0"
          class="scanning-state scanning-state--compact"
          role="status"
          aria-live="polite"
        >
          <div class="scan-orbit" aria-hidden="true">
            <div class="scan-orbit-center">
              <ion-icon :icon="bluetoothOutline" />
            </div>
          </div>
          <p>{{ localize('@bleScanning') }}</p>
        </div>

        <div
          v-if="connecting"
          class="connection-waiting"
          role="status"
          aria-live="polite"
        >
          <ion-spinner name="crescent" />
          <p>{{ localize('@bleConnectionWaiting') }}</p>
        </div>

        <div
          v-if="visibleStatusMessage"
          class="status-msg"
          :role="visibleErrorMessage ? 'alert' : 'status'"
        >
          <ion-note :color="visibleErrorMessage ? 'danger' : undefined">
            {{ visibleStatusMessage }}
          </ion-note>
        </div>

      </div>
    </ion-content>
  <div v-if="developerModeEnabled" class="debug-corner">
    <ion-button
      size="small"
      fill="solid"
      color="medium"
      @click="addSimulatedSensor"
      class="debug-corner-button"
    >
      <ion-icon slot="start" :icon="addCircleOutline" />
      {{ localize('@bleAddSimulatedSensor') }}
    </ion-button>
    <ion-button size="small" fill="solid" color="medium" @click="proceed" class="debug-corner-button">
      {{ localize('@bleSkipDev') }}
    </ion-button>
  </div>
  <div v-if="!ble.isNative.value" class="language-switcher">
    <LanguageSwitcher :current-language="currentLanguage" @update:language="changeLanguage" />
  </div>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonHeader, IonContent, IonButton, IonIcon, IonLabel, IonList,
  IonItem, IonNote, IonSpinner,
} from '@ionic/vue';
import {
  addCircleOutline,
  bluetoothOutline,
  closeOutline,
  searchOutline,
  settingsOutline,
} from 'ionicons/icons';
import { useBle } from '@/composables/useBle';
import axios from 'axios';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import { useLanguage } from '@/composables/useLanguage';
import { useDeveloperMode } from '@/composables/useDeveloperMode';
import type { LanguageCode, Translations } from '@/types/localization';

// Import language files
import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

const { currentLanguage, changeLanguage } = useLanguage();
const languages = ref<Record<LanguageCode, Translations>>({ en: {}, fr: {} });

const generateCacheBuster = () => `?v=${new Date().getTime()}`;

const loadLocalizationFiles = async () => {
  try {
    const enResp = await axios.get<Translations>(enUS + generateCacheBuster());
    const frResp = await axios.get<Translations>(frFR + generateCacheBuster());
    languages.value.en = enResp.data;
    languages.value.fr = frResp.data;
  } catch (e) {
    console.error('Failed to load localization files', e);
  }
};

const localization = () => languages.value[currentLanguage.value] || {};

const localize = (key: string) => {
  if (!key.startsWith('@')) return key;
  const k = key.substring(1);
  const v = localization()[k];
  return v ?? key;
};

const ble = useBle();
const router = useRouter();
const { developerModeEnabled } = useDeveloperMode();
const logoSrc = `${import.meta.env.BASE_URL}img/icon.png`;
const connecting = ref(false);
const connectingDeviceId = ref('');
const simulatedDevices = ref<DeviceLike[]>([]);
const nextSimulatedSensorNumber = ref(123456);
const displayedDevices = computed<DeviceLike[]>(() => {
  const realDevices = [...ble.devices.value];
  const realDeviceNames = new Set(realDevices.map(device => device.name));
  const uniqueSimulatedDevices = simulatedDevices.value.filter(
    device => !realDeviceNames.has(device.name),
  );
  return [...realDevices, ...uniqueSimulatedDevices];
});
const showScanningIndicator = computed(() => ble.scanning.value);
const scanPanelRaised = computed(() => (
  ble.scanning.value || displayedDevices.value.length > 0
));
const visibleErrorMessage = computed(() => {
  const message = ble.statusMessage.value.toLowerCase();
  if (message.startsWith('scan failed') || message.startsWith('auto-scan failed')) {
    return localize('@bleScanFailed');
  }
  if (message.startsWith('connection failed')) return localize('@bleConnectionFailed');
  if (message.startsWith('pairing failed')) return localize('@blePairingFailed');
  if (message === 'ble not available' || message === 'ble not ready') {
    return localize('@bleUnavailable');
  }
  return '';
});
const visibleStatusMessage = computed(() => (
  visibleErrorMessage.value
  || (developerModeEnabled.value ? ble.statusMessage.value : '')
));

onMounted(async () => {
  await ble.initialize();
  await loadLocalizationFiles();
});

type DeviceLike = {
  deviceId: string;
  name?: string;
  uuids?: readonly string[];
  isSimulated?: boolean;
};

function addSimulatedSensor() {
  if (!developerModeEnabled.value) return;

  let name = `WS-${nextSimulatedSensorNumber.value}`;
  while (displayedDevices.value.some(device => device.name === name)) {
    nextSimulatedSensorNumber.value += 1;
    name = `WS-${nextSimulatedSensorNumber.value}`;
  }

  simulatedDevices.value.push({
    deviceId: `debug:${name}`,
    name,
    isSimulated: true,
  });
  nextSimulatedSensorNumber.value += 1;
}

async function toggleScan() {
  if (ble.scanning.value) {
    await ble.cancelScan();
    return;
  }
  await ble.startAutoScan();
}

async function onDeviceSelect(dev: DeviceLike) {
  if (dev.isSimulated) {
    await ble.cancelScan();
    proceed();
    return;
  }

  connecting.value = true;
  connectingDeviceId.value = dev.deviceId;
  try {
    await ble.connectToDevice(dev);
  } finally {
    connecting.value = false;
    connectingDeviceId.value = '';
  }
}

async function cancelConnection() {
  await ble.cancelConnect();
}

function proceed() {
  router.replace('/sensor-data');
}

// Auto-navigate to the sensor dashboard when BLE becomes connected
watch(() => ble.connected.value, (val) => {
  if (val) {
    router.replace('/sensor-data');
  }
}, { immediate: true, flush: 'sync' });
</script>

<style scoped>
.ble-connect-content {
  --background: var(--app-page-background);
}

.ble-connect-container {
  max-width: 500px;
  margin: 0 auto;
  padding: 24px 16px;
}

.scan-panel {
  position: relative;
  height: 292px;
  transition: height 320ms ease;
}

.scan-panel--raised {
  height: 56px;
}

.scan-panel--scanning {
  height: 238px;
}

.scan-button {
  position: absolute;
  top: 230px;
  right: 0;
  left: 0;
  z-index: 1;
  margin: 0;
  transition: top 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.scan-panel--raised .scan-button {
  top: 0;
}

.scanning-state {
  position: absolute;
  top: 88px;
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--ion-color-medium-shade);
  animation: scanning-state-enter 320ms ease-out both;
}

.scanning-state p {
  margin: 14px 0 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.scan-orbit {
  position: relative;
  display: grid;
  width: 96px;
  height: 96px;
  place-items: center;
  border: 2px solid rgba(var(--ion-color-primary-rgb), 0.18);
  border-radius: 50%;
}

.scan-orbit::before {
  position: absolute;
  inset: -2px;
  border: 3px solid transparent;
  border-top-color: var(--ion-color-primary);
  border-right-color: rgba(var(--ion-color-primary-rgb), 0.28);
  border-radius: 50%;
  content: '';
  animation: scan-orbit-rotate 1s linear infinite;
}

.scan-orbit-center {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 50%;
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
}

.scan-orbit-center ion-icon {
  font-size: 28px;
}

.scanning-state--compact {
  position: static;
  flex-direction: row;
  justify-content: center;
  gap: 10px;
  margin: -4px 0 20px;
}

.scanning-state--compact .scan-orbit {
  width: 30px;
  height: 30px;
  border-width: 1px;
}

.scanning-state--compact .scan-orbit::before {
  inset: -1px;
  border-width: 2px;
}

.scanning-state--compact .scan-orbit-center {
  width: 26px;
  height: 26px;
  background: transparent;
}

.scanning-state--compact .scan-orbit-center ion-icon {
  font-size: 17px;
}

.scanning-state--compact p {
  margin: 0;
  font-size: 0.84rem;
}

@keyframes scan-orbit-rotate {
  to {
    transform: rotate(360deg);
  }
}

@keyframes scanning-state-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.device-list {
  background: transparent;
  padding-top: 4px;
  margin-bottom: 16px;
}

.pairing-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(var(--ion-color-warning-rgb), 0.12);
  color: var(--ion-color-warning-shade);
  border: 1px solid rgba(var(--ion-color-warning-rgb), 0.24);
  border-radius: 10px;
  padding: 12px 14px;
  margin: 14px 0;
}

.pairing-banner p {
  margin: 3px 0 0;
  font-size: 0.85rem;
}

.device-list ion-item {
  --background: var(--app-surface);
  border-radius: 8px;
  margin-bottom: 6px;
  --padding-start: 12px;
}

.device-list ion-item h2 {
  font-weight: 600;
}

.device-list ion-item p {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.empty-state {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  text-align: center;
  padding: 40px 16px;
  color: var(--ion-color-medium);
  opacity: 1;
  transform: translateY(0);
  transition: opacity 180ms ease, transform 260ms ease;
}

.scan-panel--raised .empty-state {
  pointer-events: none;
  opacity: 0;
  transform: translateY(-16px);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 12px;
  opacity: 0.4;
}

.status-msg {
  text-align: center;
  margin-top: 16px;
  font-size: 0.85em;
  color: var(--ion-color-medium);
}

.connection-waiting {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 4px 0 16px;
  color: var(--ion-color-medium-shade);
  text-align: center;
}

.connection-waiting ion-spinner {
  flex: 0 0 auto;
}

.connection-waiting p {
  margin: 0;
  font-size: 0.9rem;
}

.debug-corner {
  position: fixed;
  left: 12px;
  bottom: 12px;
  z-index: 1100;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.debug-corner-button {
  margin: 0;
  --padding-start: 8px;
  --padding-end: 8px;
}

.ble-home-header-shell {
  box-shadow: none;
}

.ble-home-header {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: calc(82px + env(safe-area-inset-top));
  padding: calc(10px + env(safe-area-inset-top)) 12px 10px;
  color: var(--ion-color-primary-contrast);
  background: var(--ion-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
}

.ble-home-logo {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border: 1px solid #fff;
  border-radius: 9px;
}

.ble-home-identity {
  display: grid;
  min-width: 0;
  line-height: 1.15;
}

.ble-home-identity strong {
  overflow: hidden;
  font-size: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ble-home-context {
  margin-top: 2px;
  font-size: 0.78rem;
  font-weight: 600;
  opacity: 0.82;
}

.ble-home-header-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  color: inherit;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 50%;
}

.ble-home-header-action ion-icon {
  width: 22px;
  height: 22px;
}

.ble-home-header-action:active {
  background: rgba(255, 255, 255, 0.28);
  transform: scale(0.96);
}

.ble-home-header-action:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .scan-panel,
  .scan-button,
  .empty-state,
  .scanning-state {
    transition-duration: 1ms;
  }

  .scanning-state,
  .scan-orbit::before {
    animation: none;
  }
}
</style>
