<template>
  <ion-page>
    <ion-header class="ble-home-header-shell">
      <header class="ble-home-header">
        <img class="ble-home-logo" :src="logoSrc" alt="Watteco" />

        <div class="ble-home-identity">
          <strong>Watteco Neo (Beta)</strong>
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

          <div class="scan-actions">
            <ion-button
              @click="connecting ? cancelConnection() : toggleScan()"
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
            <ion-button
              class="auto-connect-button"
              fill="outline"
              :aria-label="localize('@bleAutoConnectSettings')"
              :aria-expanded="autoConnectPanelVisible"
              :disabled="ble.scanning.value || connecting || ble.pairing.value"
              @click="toggleAutoConnectPanel"
            >
              <ion-icon :icon="locateOutline" aria-hidden="true" />
            </ion-button>
          </div>

        </div>

        <section v-if="autoConnectPanelVisible" class="auto-connect-panel">
          <strong>{{ localize('@bleAutoConnectTitle') }}</strong>
          <label class="dev-eui-input-label" for="auto-connect-dev-eui">
            {{ localize('@bleDevEui') }}
          </label>
          <div class="dev-eui-input-row">
            <span class="dev-eui-prefix">70:B3:D5:E7:</span>
            <input
              id="auto-connect-dev-eui"
              :value="formattedDevEuiSuffix"
              class="dev-eui-suffix-input"
              type="text"
              inputmode="text"
              maxlength="23"
              autocomplete="off"
              autocapitalize="characters"
              placeholder="5F:12:34:56"
              :disabled="targetedWorkflowActive"
              @input="onDevEuiSuffixInput"
            />
            <ion-button
              class="qr-scan-button"
              fill="clear"
              :aria-label="localize('@bleQrScan')"
              :disabled="targetedWorkflowActive || qrScanInProgress || ble.scanning.value || connecting || ble.pairing.value"
              @click="scanSensorQrCode"
            >
              <ion-spinner v-if="qrScanInProgress" name="crescent" />
              <ion-icon v-else :icon="qrCodeOutline" aria-hidden="true" />
            </ion-button>
          </div>
          <p class="qr-scan-hint">{{ localize('@bleQrScanHint') }}</p>
          <ion-button
            expand="block"
            class="auto-connect-action"
            :color="targetedWorkflowActive ? 'medium' : 'primary'"
            :disabled="!validTargetBleName && !targetedWorkflowActive"
            @click="toggleTargetedConnection"
          >
            <ion-icon
              slot="start"
              :icon="targetedWorkflowActive ? closeOutline : locateOutline"
            />
            {{ localize(targetedWorkflowActive ? '@bleAutoConnectCancel' : '@bleAutoConnectStart') }}
          </ion-button>
          <p v-if="targetedWorkflowActive" class="auto-connect-waiting" role="status" aria-live="polite">
            <ion-spinner name="crescent" />
            <span>{{ localize('@bleAutoConnectWaiting') }}</span>
          </p>
        </section>

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

        <!-- Application devices -->
        <h2 v-if="!ble.connected.value && applicationDevices.length" class="device-group-title">
          {{ localize('@bleSensors') }}
        </h2>
        <ion-list v-if="!ble.connected.value && applicationDevices.length" class="device-list">
          <ion-item
            v-for="dev in applicationDevices"
            :key="dev.deviceId"
            button
            @click="onDeviceSelect(dev)"
            :disabled="connecting || ble.pairing.value"
          >
            <div slot="start" class="device-source-icon">
              <ion-icon :icon="bluetoothOutline" color="primary" aria-hidden="true" />
              <span
                v-if="kmsAccess.hasKmsPrivilege(dev.devEui)"
                class="kms-access-badge"
                role="img"
                :aria-label="localize('@kmsPrivilegedSensor')"
              >
                <ion-icon :icon="key" aria-hidden="true" />
              </span>
            </div>
            <ion-label>
              <h2>{{ dev.productName ?? ble.getDeviceName(dev) }}</h2>
              <p
                v-if="formatDevEui(dev.devEui)"
                class="device-eui"
                :class="{ 'device-eui--connecting': isDeviceConnecting(dev) }"
              >
                <span class="device-eui-label">DevEUI:&nbsp;</span>
                <LeadingEllipsisText
                  class="device-eui-value"
                  :text="formatDevEui(dev.devEui) ?? ''"
                />
              </p>
              <p v-else-if="dev.isSimulated">{{ localize('@bleSimulatedSensor') }}</p>
            </ion-label>
            <ion-spinner v-if="(connecting || ble.pairing.value) && connectingDeviceId === dev.deviceId" slot="end" name="crescent" />
          </ion-item>
        </ion-list>

        <!-- Recovery loaders stay available even when the application is erased. -->
        <h2 v-if="!ble.connected.value && otaLoaderDevices.length" class="device-group-title device-group-title--ota">
          {{ localize('@bleRecoveryLoaders') }}
        </h2>
        <ion-list v-if="!ble.connected.value && otaLoaderDevices.length" class="device-list device-list--ota">
          <ion-item
            v-for="dev in otaLoaderDevices"
            :key="dev.deviceId"
            button
            @click="onDeviceSelect(dev)"
            :disabled="connecting || ble.pairing.value"
          >
            <ion-icon :icon="cloudUploadOutline" slot="start" color="warning" />
            <ion-label>
              <h2>{{ ble.getDeviceName(dev) }}</h2>
              <p>{{ localize('@bleRecoveryLoaderHint') }}</p>
              <p v-if="formatDevEui(dev.devEui)" class="device-eui">
                <span class="device-eui-label">DevEUI:&nbsp;</span>
                <LeadingEllipsisText class="device-eui-value" :text="formatDevEui(dev.devEui) ?? ''" />
              </p>
            </ion-label>
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
          :role="visibleErrorMessage || qrScanMessage ? 'alert' : 'status'"
        >
          <ion-note :color="visibleErrorMessage || qrScanMessage ? 'danger' : undefined">
            {{ visibleStatusMessage }}
          </ion-note>
        </div>

      </div>
    </ion-content>
  <div v-if="developerModeEnabled" class="debug-stack">
    <section
      v-if="debugToolsVisible && wakeMenuVisible"
      class="wake-debug-menu"
      aria-label="BLE wake timings"
    >
      <div class="wake-debug-menu__header">
        <strong>Wake timings</strong>
        <ion-button size="small" fill="clear" @click="ble.clearWakeDiagnostics()">
          Clear
        </ion-button>
      </div>
      <p v-if="ble.wakeDiagnostics.value.length === 0" class="wake-debug-menu__empty">
        No sensor wake attempt yet.
      </p>
      <div v-else class="wake-debug-menu__entries">
        <article
          v-for="entry in ble.wakeDiagnostics.value"
          :key="`${entry.deviceId}:${entry.advertisementAt}`"
          class="wake-debug-entry"
        >
          <strong>{{ entry.deviceName }}</strong>
          <code>{{ entry.deviceId }}</code>
          <dl>
            <dt>Advertisement</dt>
            <dd>{{ formatWakeTimestamp(entry.advertisementAt) }}</dd>
            <dt>Connection start</dt>
            <dd>{{ formatWakeTimestamp(entry.connectionStartedAt) }}</dd>
            <dt>Link established</dt>
            <dd>{{ formatWakeTimestamp(entry.connectedAt) }} {{ formatWakeDelta(entry.advertisementAt, entry.connectedAt) }}</dd>
            <dt>Disconnect request</dt>
            <dd>{{ formatWakeTimestamp(entry.disconnectRequestedAt) }}</dd>
            <dt>Disconnected</dt>
            <dd>{{ formatWakeTimestamp(entry.disconnectedAt) }} {{ formatWakeDelta(entry.disconnectRequestedAt, entry.disconnectedAt) }}</dd>
          </dl>
          <p v-if="entry.error" class="wake-debug-entry__error">{{ entry.error }}</p>
        </article>
      </div>
    </section>
    <div v-show="debugToolsVisible" id="ble-connect-debug-actions" class="debug-actions">
      <ion-button
        size="small"
        fill="solid"
        color="medium"
        @click="wakeMenuVisible = !wakeMenuVisible"
        class="debug-corner-button"
      >
        Wake log<span v-if="ble.wakingSensor.value">…</span>
      </ion-button>
      <ion-button
        size="small"
        fill="solid"
        color="medium"
        @click="addSimulatedSensor(false)"
        class="debug-corner-button"
      >
        <ion-icon slot="start" :icon="addCircleOutline" />
        {{ localize('@bleAddSimulatedSensor') }}
      </ion-button>
      <ion-button
        size="small"
        fill="solid"
        color="medium"
        @click="addSimulatedSensor(true)"
        class="debug-corner-button"
      >
        <ion-icon slot="start" :icon="key" />
        {{ localize('@bleAddSimulatedKmsSensor') }}
      </ion-button>
      <ion-button size="small" fill="solid" color="medium" @click="proceed" class="debug-corner-button">
        {{ localize('@bleSkipDev') }}
      </ion-button>
    </div>
    <button
      type="button"
      class="debug-toggle"
      :class="{ 'debug-toggle--collapsed': !debugToolsVisible }"
      :aria-expanded="debugToolsVisible"
      aria-controls="ble-connect-debug-actions"
      :title="debugToolsVisible ? 'Hide debug tools' : 'Show debug tools'"
      @click="toggleDebugTools"
    >
      {{ debugToolsVisible ? 'Hide' : 'DEV' }}
    </button>
  </div>
  <div v-if="!ble.isNative.value" class="language-switcher">
    <LanguageSwitcher :current-language="currentLanguage" @update:language="changeLanguage" />
  </div>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonHeader, IonContent, IonButton, IonIcon, IonLabel, IonList,
  IonItem, IonNote, IonSpinner,
} from '@ionic/vue';
import {
  addCircleOutline,
  bluetoothOutline,
  closeOutline,
  cloudUploadOutline,
  locateOutline,
  qrCodeOutline,
  searchOutline,
  key,
  settingsOutline,
} from 'ionicons/icons';
import { useBle, type DeviceLike } from '@/composables/useBle';
import axios from 'axios';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import LeadingEllipsisText from '@/components/LeadingEllipsisText.vue';
import { useLanguage } from '@/composables/useLanguage';
import { useDeveloperMode } from '@/composables/useDeveloperMode';
import { useKmsAccess } from '@/composables/useKmsAccess';
import type { LanguageCode, Translations } from '@/types/localization';
import { createBundledTranslations } from '@/utils/localization';
import { extractDevEuiFromQrPayload } from '@/utils/lorawanQr';
import {
  deriveBleDeviceNameFromDevEuiSuffix,
  deriveDevEuiFromDeviceName,
  formatDevEui,
  formatDevEuiSuffix,
  getFormattedDevEuiSuffixCaret,
  isBleSensorName,
  normalizeDevEuiSuffixInput,
} from '@/utils/BLE/deviceIdentity';
import {
  recoveryDeviceFromOtaLoader,
  saveFirmwareRecoveryDevice,
} from '@/utils/BLE/firmwareUpdateRecovery';

// Import language files
import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

const { currentLanguage, changeLanguage } = useLanguage();
const languages = ref<Record<LanguageCode, Translations>>(createBundledTranslations());

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
const kmsAccess = useKmsAccess();
const { developerModeEnabled } = useDeveloperMode();
const logoSrc = `${import.meta.env.BASE_URL}img/icon.png`;
const connecting = ref(false);
const connectingDeviceId = ref('');
const wakeMenuVisible = ref(false);
const debugToolsStorageKey = 'ble-connect-debug-tools-visible';
const debugToolsVisible = ref(sessionStorage.getItem(debugToolsStorageKey) === 'true');
const autoConnectPanelVisible = ref(false);
const autoConnectDevEuiStorageKey = 'easycodec.bleAutoConnectDevEuiSuffix';
const devEuiSuffix = ref(normalizeDevEuiSuffixInput(
  localStorage.getItem(autoConnectDevEuiStorageKey) ?? undefined,
));
const autoConnectEnabled = ref(false);
const targetedWorkflowActive = ref(false);
const qrScanInProgress = ref(false);
const qrScanMessage = ref('');
type DisplayDevice = DeviceLike & { isSimulated?: boolean };

const simulatedDevices = ref<DisplayDevice[]>([]);
const nextSimulatedSensorNumber = ref(123456);
const displayedDevices = computed<DisplayDevice[]>(() => {
  // BBS devices belong exclusively to the Startup and recovery workflow.
  const realDevices = ble.devices.value.filter(device => !device.isSpecialMode);
  const realDeviceNames = new Set(realDevices.map(device => device.name));
  const uniqueSimulatedDevices = simulatedDevices.value.filter(
    device => !realDeviceNames.has(device.name),
  );
  return [...realDevices, ...uniqueSimulatedDevices];
});
const applicationDevices = computed(() => displayedDevices.value.filter(device => !device.isOtaLoader));
const otaLoaderDevices = computed(() => displayedDevices.value.filter(device => device.isOtaLoader));
const showScanningIndicator = computed(() => ble.scanning.value);
const formattedDevEuiSuffix = computed(() => formatDevEuiSuffix(devEuiSuffix.value));
const targetBleName = computed(() => deriveBleDeviceNameFromDevEuiSuffix(devEuiSuffix.value));
const validTargetBleName = computed(() => isBleSensorName(targetBleName.value ?? undefined));
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
  qrScanMessage.value
  || visibleErrorMessage.value
  || (developerModeEnabled.value ? ble.statusMessage.value : '')
));

watch(devEuiSuffix, (suffix) => {
  localStorage.setItem(autoConnectDevEuiStorageKey, suffix);
}, { flush: 'sync' });

onMounted(async () => {
  await ble.initialize();
  await loadLocalizationFiles();
});

function addSimulatedSensor(withKmsAccess: boolean) {
  if (!developerModeEnabled.value) return;

  let name = `WS5F${nextSimulatedSensorNumber.value}`;
  while (displayedDevices.value.some(device => device.name === name)) {
    nextSimulatedSensorNumber.value += 1;
    name = `WS5F${nextSimulatedSensorNumber.value}`;
  }

  const devEui = deriveDevEuiFromDeviceName(name) ?? undefined;
  simulatedDevices.value.push({
    deviceId: `debug:${name}`,
    name,
    advertisedProductId: '50-70-260-001',
    productReference: '50-70-260',
    productName: "Pulse Sens'O Neo",
    devEui,
    isSimulated: true,
  });
  if (withKmsAccess) kmsAccess.addPrivilegedDevEui(devEui);
  nextSimulatedSensorNumber.value += 1;
}

function toggleDebugTools() {
  debugToolsVisible.value = !debugToolsVisible.value;
  sessionStorage.setItem(debugToolsStorageKey, String(debugToolsVisible.value));
}

function isDeviceConnecting(device: DisplayDevice): boolean {
  return (connecting.value || ble.pairing.value)
    && connectingDeviceId.value === device.deviceId;
}

function formatWakeTimestamp(timestamp?: number): string {
  if (timestamp === undefined) return '—';
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString([], { hour12: false })}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

function formatWakeDelta(start?: number, end?: number): string {
  if (start === undefined || end === undefined) return '';
  return `(+${end - start} ms)`;
}

async function toggleScan() {
  if (ble.scanning.value) {
    autoConnectEnabled.value = false;
    await ble.cancelScan();
    return;
  }
  await ble.startAutoScan();
}

function toggleAutoConnectPanel() {
  autoConnectPanelVisible.value = !autoConnectPanelVisible.value;
}

function onDevEuiSuffixInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const rawValue = input.value;
  const caret = getFormattedDevEuiSuffixCaret(rawValue, input.selectionStart);
  devEuiSuffix.value = normalizeDevEuiSuffixInput(rawValue);
  qrScanMessage.value = '';
  input.value = formattedDevEuiSuffix.value;
  void nextTick(() => input.setSelectionRange(caret, caret));
}

async function scanSensorQrCode() {
  if (qrScanInProgress.value || targetedWorkflowActive.value) return;

  qrScanMessage.value = '';
  qrScanInProgress.value = true;
  try {
    const {
      CapacitorBarcodeScanner,
      CapacitorBarcodeScannerCameraDirection,
      CapacitorBarcodeScannerScanOrientation,
      CapacitorBarcodeScannerTypeHint,
    } = await import('@capacitor/barcode-scanner');
    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      scanInstructions: localize('@bleQrScanInstructions'),
      scanButton: false,
      cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
      scanOrientation: CapacitorBarcodeScannerScanOrientation.ADAPTIVE,
    });
    if (!result.ScanResult) return;

    const devEui = extractDevEuiFromQrPayload(result.ScanResult);
    const suffix = normalizeDevEuiSuffixInput(devEui ?? undefined);
    if (!devEui || !suffix) {
      qrScanMessage.value = localize('@bleQrInvalid');
      return;
    }

    devEuiSuffix.value = suffix;
    qrScanInProgress.value = false;
    await nextTick();
    await toggleTargetedConnection();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/cancel/i.test(message)) qrScanMessage.value = localize('@bleQrScanFailed');
  } finally {
    qrScanInProgress.value = false;
  }
}

async function toggleTargetedConnection() {
  if (targetedWorkflowActive.value) {
    autoConnectEnabled.value = false;
    if (connecting.value) await cancelConnection();
    else await ble.cancelScan();
    return;
  }

  const deviceName = targetBleName.value;
  if (!deviceName || !validTargetBleName.value) return;

  autoConnectEnabled.value = true;
  targetedWorkflowActive.value = true;
  try {
    const device = await ble.startTargetedScan(deviceName);
    if (device && autoConnectEnabled.value) await onDeviceSelect(device);
  } finally {
    targetedWorkflowActive.value = false;
    autoConnectEnabled.value = false;
  }
}

async function onDeviceSelect(dev: DisplayDevice) {
  if (dev.isSpecialMode) return;

  if (dev.isSimulated) {
    await ble.cancelScan();
    ble.setProductReference(dev.productReference);
    proceed();
    return;
  }

  if (dev.isOtaLoader) {
    const recoveryDevice = recoveryDeviceFromOtaLoader(dev);
    if (!recoveryDevice) return;
    await ble.cancelScan();
    saveFirmwareRecoveryDevice(recoveryDevice);
    await router.push('/firmware-update');
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

// Show the sensor dashboard as soon as GATT is connected. The dashboard keeps
// its controls locked while service discovery and subscriptions are prepared.
watch(() => ble.connectionPhase.value, (phase) => {
  if (phase === 'discovering' || phase === 'ready') {
    const specialModeConnection = ble.connectedDevice.value?.isSpecialMode;
    if (specialModeConnection && phase !== 'ready') return;
    router.replace(
      specialModeConnection ? '/special-mode' : '/sensor-data',
    );
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

.scan-actions {
  position: absolute;
  top: 230px;
  right: 0;
  left: 0;
  z-index: 1;
  display: flex;
  gap: 8px;
  transition: top 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.scan-panel--raised .scan-actions {
  top: 0;
}

.scan-button {
  flex: 1 1 auto;
  margin: 0;
}

.auto-connect-button {
  flex: 0 0 48px;
  width: 48px;
  margin: 0;
  --padding-start: 0;
  --padding-end: 0;
}

.auto-connect-button ion-icon {
  font-size: 21px;
}

.auto-connect-panel {
  padding: 14px;
  margin: 8px 0 4px;
  background: var(--app-surface);
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.24);
  border-radius: 10px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

.auto-connect-panel > strong {
  display: block;
  margin-bottom: 12px;
  color: var(--ion-color-primary-shade);
}

.qr-scan-button {
  flex: 0 0 38px;
  width: 38px;
  min-width: 0;
  height: 38px;
  min-height: 0;
  margin: 0;
  font-size: 1.4rem;
  --padding-start: 0;
  --padding-end: 0;
}

.qr-scan-hint {
  margin: 7px 0 12px;
  color: var(--ion-color-medium-shade);
  font-size: 0.8rem;
  line-height: 1.3;
}

.dev-eui-input-label {
  display: block;
  margin-bottom: 5px;
  color: var(--ion-color-medium-shade);
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
}

.dev-eui-input-row {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  font-family: monospace;
  font-size: clamp(0.86rem, 3.8vw, 1.02rem);
  font-weight: 700;
  background: var(--app-page-background);
  border: 1px solid rgba(var(--ion-color-medium-rgb), 0.42);
  border-radius: 8px;
}

.dev-eui-prefix {
  flex: 0 0 auto;
  padding: 11px 0 11px 10px;
  color: var(--ion-color-medium-shade);
  white-space: nowrap;
}

.dev-eui-suffix-input {
  box-sizing: border-box;
  min-width: 0;
  flex: 1 1 auto;
  padding: 11px 8px 11px 0;
  color: var(--ion-text-color);
  font: inherit;
  background: transparent;
  border: 0;
  outline: 0;
  text-transform: uppercase;
}

.dev-eui-suffix-input::placeholder {
  color: var(--ion-color-medium);
  opacity: 0.55;
}

.dev-eui-input-row:focus-within {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 2px rgba(var(--ion-color-primary-rgb), 0.14);
}

.auto-connect-action {
  margin: 12px 0 0;
}

.auto-connect-waiting {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 12px 0 0;
  color: var(--ion-color-primary-shade);
  font-size: 0.86rem;
}

.auto-connect-waiting ion-spinner {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
}

.scanning-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0 32px;
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
  padding: 0;
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

.device-group-title {
  margin: 8px 4px 6px;
  color: var(--ion-color-medium);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.device-group-title--ota {
  color: var(--ion-color-warning-shade);
}

.device-list--ota ion-item {
  --background: rgba(var(--ion-color-warning-rgb), 0.08);
  border: 1px solid rgba(var(--ion-color-warning-rgb), 0.24);
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

.device-source-icon {
  position: relative;
  display: grid;
  width: 28px;
  height: 34px;
  margin-right: 16px;
  color: var(--ion-color-primary);
  font-size: 24px;
  place-items: center;
}

.kms-access-badge {
  position: absolute;
  right: -5px;
  bottom: 0;
  display: grid;
  width: 17px;
  height: 17px;
  border: 2px solid var(--app-surface);
  border-radius: 50%;
  background: var(--ion-color-success, #2f9e44);
  color: #fff;
  font-size: 9px;
  place-items: center;
}

.device-list ion-label { min-width: 0; }

.device-list ion-item p {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.device-list ion-item .device-eui {
  display: flex;
  min-width: 0;
}

.device-eui-label {
  flex: 0 0 auto;
}

.device-eui-value {
  flex: 1 1 auto;
  min-width: 0;
}

.device-list ion-item .device-eui--connecting {
  overflow: hidden;
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
  white-space: pre-line;
}

.debug-stack {
  position: fixed;
  right: 12px;
  left: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom));
  z-index: 1100;
  display: flex;
  max-height: calc(100vh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.debug-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.debug-corner-button {
  margin: 0;
  --padding-start: 8px;
  --padding-end: 8px;
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
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.debug-toggle--collapsed {
  min-width: 44px;
  opacity: 0.72;
}

.wake-debug-menu {
  box-sizing: border-box;
  width: 100%;
  max-width: 620px;
  min-height: 0;
  max-height: min(62vh, 520px);
  padding: 10px;
  overflow: hidden;
  color: var(--ion-text-color);
  background: var(--app-surface);
  border: 1px solid rgba(var(--ion-color-medium-rgb), 0.4);
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.24);
}

.wake-debug-menu__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wake-debug-menu__header ion-button {
  margin: 0;
}

.wake-debug-menu__empty {
  margin: 8px 2px;
  color: var(--ion-color-medium);
}

.wake-debug-menu__entries {
  max-height: calc(min(62vh, 520px) - 48px);
  overflow: auto;
}

.wake-debug-entry {
  padding: 9px 2px;
  border-top: 1px solid rgba(var(--ion-color-medium-rgb), 0.24);
}

.wake-debug-entry > strong,
.wake-debug-entry > code {
  display: block;
}

.wake-debug-entry > code {
  margin-top: 2px;
  overflow: hidden;
  color: var(--ion-color-medium);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wake-debug-entry dl {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 3px 10px;
  margin: 7px 0 0;
  font-size: 0.75rem;
}

.wake-debug-entry dt,
.wake-debug-entry dd {
  margin: 0;
}

.wake-debug-entry dd {
  font-family: monospace;
  text-align: right;
}

.wake-debug-entry__error {
  margin: 7px 0 0;
  color: var(--ion-color-danger);
  font-size: 0.75rem;
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
  font-size: 1.2rem;
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
  .scan-actions,
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
