<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="ble.connected.value ? '/sensor-tools' : '/ble-connect'" />
        </ion-buttons>
        <ion-title>{{ localize('@toolsFirmwareUpdate') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="firmware-update-content ion-padding">
      <main class="firmware-update-container">
        <section class="target-summary">
          <div class="target-summary__icon">
            <ion-icon :icon="recoveryDevice?.loaderDeviceId ? cloudUploadOutline : bluetoothOutline" />
          </div>
          <div class="target-summary__copy">
            <span class="section-kicker">{{ localize('@firmwareUpdateTarget') }}</span>
            <strong>{{ targetName }}</strong>
            <span
              class="target-summary__mode"
              :class="{
                'target-summary__mode--connected': targetIsConnected,
                'target-summary__mode--recovery': targetIsRecoveryLoader,
              }"
            >
              <i aria-hidden="true" />
              {{ targetModeLabel }}
            </span>
          </div>
        </section>

        <section class="firmware-panel">
          <header class="firmware-panel__header">
            <div>
              <span class="section-kicker">{{ localize('@firmwareUpdatePreparation') }}</span>
              <h2>{{ localize('@firmwareUpdateFiles') }}</h2>
            </div>
            <ion-icon :icon="folderOpenOutline" aria-hidden="true" />
          </header>

          <div class="firmware-form">
            <label class="file-picker">
              <input type="file" accept=".bin,.hex,.ihex" @change="onFirmwareFile" />
              <span class="file-picker__icon">
                <ion-icon :icon="documentOutline" aria-hidden="true" />
              </span>
              <span class="file-picker__copy">
                <strong>{{ localize('@firmwareUpdateSelectFirmware') }}</strong>
                <small :class="{ 'file-picker__empty': !firmwareFileName }">
                  {{ firmwareFileName || localize('@firmwareUpdateChooseFile') }}
                </small>
              </span>
              <ion-icon
                class="file-picker__state"
                :class="{ 'file-picker__state--selected': firmwareFileName }"
                :icon="firmwareFileName ? checkmarkCircle : chevronForwardOutline"
                aria-hidden="true"
              />
            </label>

            <label class="file-picker">
              <input type="file" accept=".json,.sha256.json,application/json" @change="onMetadataFile" />
              <span class="file-picker__icon file-picker__icon--metadata">
                <ion-icon :icon="fingerPrintOutline" aria-hidden="true" />
              </span>
              <span class="file-picker__copy">
                <strong>{{ localize('@firmwareUpdateSelectMetadata') }}</strong>
                <small :class="{ 'file-picker__empty': !firmwareMetadataFileName }">
                  {{ firmwareMetadataFileName || localize('@firmwareUpdateChooseFile') }}
                </small>
              </span>
              <ion-icon
                class="file-picker__state"
                :class="{ 'file-picker__state--selected': firmwareMetadataFileName }"
                :icon="firmwareMetadataFileName ? checkmarkCircle : chevronForwardOutline"
                aria-hidden="true"
              />
            </label>

            <div class="firmware-actions">
              <ion-button
                class="start-update-button"
                expand="block"
                :disabled="!firmwareFileName || !firmwareMetadataFileName || firmwareUpdateRunning"
                @click="startFirmwareUpdate"
              >
                <ion-spinner v-if="firmwareUpdateRunning" slot="start" name="crescent" />
                <ion-icon v-else slot="start" :icon="cloudUploadOutline" />
                {{ localize(
                  firmwareUpdateRunning && firmwareUpdateProgress === 'validating'
                    ? '@firmwareUpdateValidating'
                    : '@firmwareUpdateStart'
                ) }}
              </ion-button>
            </div>

            <div v-if="firmwareUpdateError" class="update-error" role="alert">
              <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
              <div>
                <strong>{{ localize('@firmwareUpdateFailure') }}</strong>
                <p>{{ firmwareUpdateError }}</p>
              </div>
            </div>

            <div v-if="firmwareUpdateStatus || firmwareUpdateProgress" class="transfer-status" role="status">
              <div class="transfer-status__heading">
                <div>
                  <span class="section-kicker">{{ localize('@firmwareUpdateProgress') }}</span>
                  <strong>{{ phaseLabel }}</strong>
                </div>
                <strong class="transfer-status__percent">{{ updatePercent }}%</strong>
              </div>
              <ion-progress-bar :value="updatePercent / 100" />
              <div class="transfer-status__metrics">
                <span>{{ transferredLabel }}</span>
                <span v-if="firmwareTransferRateBps > 0">{{ formatRate(firmwareTransferRateBps) }}</span>
              </div>
            </div>
          </div>
        </section>

        <details class="update-log">
          <summary class="update-log__summary">
            <span class="update-log__title">
              <ion-icon :icon="chevronForwardOutline" aria-hidden="true" />
              {{ localize('@firmwareUpdateLogs') }}
            </span>
            <span class="update-log__count" :aria-label="logCountLabel">{{ debugLogs.length }}</span>
          </summary>
          <div class="update-log__body">
            <ion-button size="small" fill="clear" @click="clearDebugLogs">Clear</ion-button>
            <div class="update-log__lines" aria-live="polite">
              <p v-if="debugLogs.length === 0">{{ localize('@firmwareUpdateNoLogs') }}</p>
              <code v-for="(line, index) in debugLogs" :key="`${index}:${line}`">{{ line }}</code>
            </div>
          </div>
        </details>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonProgressBar,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import {
  bluetoothOutline,
  alertCircleOutline,
  checkmarkCircle,
  chevronForwardOutline,
  cloudUploadOutline,
  documentOutline,
  fingerPrintOutline,
  folderOpenOutline,
} from 'ionicons/icons';
import axios from 'axios';
import { useBle } from '@/composables/useBle';
import {
  updateDebugDevEuiFromDeviceName,
  useBleDebug,
} from '@/composables/useBleDebug';
import { useLanguage } from '@/composables/useLanguage';
import type { LanguageCode, Translations } from '@/types/localization';
import { loadFirmwareRecoveryDevice } from '@/utils/BLE/firmwareUpdateRecovery';
import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

const ble = useBle();
const enabled = ref(true);
const recoveryDevice = ref(loadFirmwareRecoveryDevice());
const { currentLanguage } = useLanguage();
const languages = ref<Record<LanguageCode, Translations>>({ en: {}, fr: {} });
const {
  debugLogs,
  firmwareFileName,
  firmwareMetadataFileName,
  firmwareUpdateRunning,
  firmwareUpdateProgress,
  firmwareUpdateError,
  firmwareUpdateStatus,
  firmwareTransferRateBps,
  clearDebugLogs,
  selectFirmwareFile,
  selectFirmwareMetadataFile,
  startFirmwareUpdate,
} = useBleDebug(ble, { enabled });

const targetIsRecoveryLoader = computed(() => (
  Boolean(recoveryDevice.value?.loaderDeviceId) && !ble.connectedDevice.value
));
const targetIsConnected = computed(() => (
  !targetIsRecoveryLoader.value && ble.connected.value
));
const targetName = computed(() => (
  targetIsRecoveryLoader.value
    ? recoveryDevice.value?.loaderName ?? recoveryDevice.value?.name ?? '—'
    : ble.connectedDevice.value?.name
      ?? ble.lastConnectedDevice.value?.name
      ?? recoveryDevice.value?.name
      ?? '—'
));
const targetModeLabel = computed(() => {
  if (targetIsRecoveryLoader.value) return localize('@firmwareUpdateRecoveryMode');
  return localize(targetIsConnected.value
    ? '@firmwareUpdateApplicationMode'
    : '@firmwareUpdateDisconnectedMode');
});
const updatePercent = computed(() => firmwareUpdateStatus.value?.percent ?? 0);
const transferredLabel = computed(() => {
  const status = firmwareUpdateStatus.value;
  if (!status?.total) return firmwareUpdateProgress.value;
  return `${formatBytes(status.transferred)} / ${formatBytes(status.total)}`;
});
const phaseLabel = computed(() => {
  const phase = firmwareUpdateStatus.value?.phase;
  if (!phase) return firmwareUpdateProgress.value;
  return localize(`@firmwareUpdatePhase${phase.split('-').map(part => (
    part.charAt(0).toUpperCase() + part.slice(1)
  )).join('')}`);
});
const logCountLabel = computed(() => (
  currentLanguage.value === 'fr'
    ? `${debugLogs.value.length} événement${debugLogs.value.length > 1 ? 's' : ''}`
    : `${debugLogs.value.length} event${debugLogs.value.length === 1 ? '' : 's'}`
));

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}

function formatRate(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return `${Math.round(bytesPerSecond)} B/s`;
  return `${(bytesPerSecond / 1024).toFixed(1)} kB/s`;
}

function localize(key: string): string {
  if (!key.startsWith('@')) return key;
  return languages.value[currentLanguage.value]?.[key.slice(1)] ?? key;
}

function onFirmwareFile(event: Event): void {
  selectFirmwareFile((event.target as HTMLInputElement).files?.[0] ?? null);
}

function onMetadataFile(event: Event): void {
  selectFirmwareMetadataFile((event.target as HTMLInputElement).files?.[0] ?? null);
}

onMounted(async () => {
  const cacheBuster = `?v=${Date.now()}`;
  const [enResponse, frResponse] = await Promise.all([
    axios.get<Translations>(enUS + cacheBuster),
    axios.get<Translations>(frFR + cacheBuster),
  ]);
  languages.value.en = enResponse.data;
  languages.value.fr = frResponse.data;
  await ble.initialize();
  updateDebugDevEuiFromDeviceName(
    recoveryDevice.value?.loaderName
    ?? ble.connectedDevice.value?.name
    ?? recoveryDevice.value?.name,
  );
});
</script>

<style scoped>
.firmware-update-content {
  --background: var(--app-page-background);
}

.firmware-update-container {
  display: grid;
  gap: 14px;
  max-width: 720px;
  margin: 0 auto;
}

.target-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-surface);
  box-shadow: var(--app-card-shadow);
}

.target-summary__icon {
  display: grid;
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  color: var(--ion-color-warning-shade);
  background: rgba(var(--ion-color-warning-rgb), 0.14);
}

.target-summary__icon ion-icon {
  font-size: 26px;
}

.target-summary__copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.target-summary__copy > strong {
  color: var(--app-text);
  font-size: 1.08rem;
  overflow-wrap: anywhere;
}

.section-kicker {
  color: var(--app-text-muted);
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.target-summary__mode {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--app-text-secondary);
  font-size: 0.78rem;
}

.target-summary__mode i {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--ion-color-medium);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-medium-rgb), 0.12);
}

.target-summary__mode--connected i {
  background: var(--ion-color-success);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-success-rgb), 0.13);
}

.target-summary__mode--recovery i {
  background: var(--ion-color-warning);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-warning-rgb), 0.14);
}

.firmware-panel {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-surface);
  box-shadow: var(--app-card-shadow);
}

.firmware-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 17px 18px 14px;
  border-bottom: 1px solid var(--app-border);
}

.firmware-panel__header h2 {
  margin: 3px 0 0;
  color: var(--app-text);
  font-size: 1.05rem;
}

.firmware-panel__header > ion-icon {
  color: var(--ion-color-primary);
  font-size: 24px;
}

.firmware-form {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 16px 18px 18px;
}

.file-picker {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
  padding: 12px;
  overflow: hidden;
  border: 1px solid var(--app-border-strong);
  border-radius: 12px;
  color: var(--app-text);
  background: var(--app-surface-subtle);
  cursor: pointer;
  transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}

.file-picker:active {
  transform: scale(0.99);
}

.file-picker:focus-within {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.1);
}

.file-picker input[type='file'] {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.file-picker__icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 10px;
  color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  font-size: 21px;
}

.file-picker__icon--metadata {
  color: var(--ion-color-tertiary, #5260ff);
  background: rgba(var(--ion-color-tertiary-rgb, 82, 96, 255), 0.1);
}

.file-picker__copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.file-picker__copy strong,
.file-picker__copy small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.file-picker__copy strong {
  font-size: 0.84rem;
}

.file-picker__copy small {
  color: var(--app-text-secondary);
  font-size: 0.73rem;
}

.file-picker__copy .file-picker__empty {
  color: var(--app-text-muted);
}

.file-picker__state {
  color: var(--app-text-muted);
  font-size: 20px;
}

.file-picker__state--selected {
  color: var(--ion-color-success);
  font-size: 22px;
}

.firmware-actions {
  display: grid;
  margin-top: 4px;
}

.firmware-actions ion-button {
  min-height: 44px;
  margin: 0;
  font-size: 0.78rem;
  font-weight: 750;
}

.start-update-button {
  --box-shadow: 0 5px 12px rgba(var(--ion-color-primary-rgb), 0.22);
}

.update-error {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(var(--ion-color-danger-rgb), 0.22);
  border-radius: 12px;
  color: var(--ion-color-danger-shade);
  background: rgba(var(--ion-color-danger-rgb), 0.07);
}

.update-error > ion-icon {
  margin-top: 1px;
  font-size: 20px;
}

.update-error strong {
  font-size: 0.82rem;
}

.update-error p {
  margin: 3px 0 0;
  color: var(--app-text-secondary);
  font-size: 0.74rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

@media (max-width: 420px) {
  .firmware-update-content {
    --padding-start: 10px;
    --padding-end: 10px;
  }

  .target-summary {
    padding: 15px;
  }

  .firmware-panel__header {
    padding-inline: 15px;
  }

  .firmware-form {
    padding: 14px 15px 16px;
  }

}

.transfer-status {
  display: grid;
  gap: 12px;
  margin-top: 6px;
  padding: 14px;
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.14);
  border-radius: 12px;
  background: rgba(var(--ion-color-primary-rgb), 0.06);
}

.transfer-status__heading,
.transfer-status__metrics {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.transfer-status__heading > div {
  display: grid;
  gap: 3px;
}

.transfer-status__heading strong {
  color: var(--app-text);
  font-size: 0.88rem;
}

.transfer-status__heading .transfer-status__percent {
  color: var(--ion-color-primary);
  font-size: 1.2rem;
  font-variant-numeric: tabular-nums;
}

.transfer-status ion-progress-bar {
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
}

.transfer-status__metrics {
  color: var(--app-text-muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.update-log {
  margin: 0 4px;
}

.update-log__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 4px;
  cursor: pointer;
  font-size: 1.05rem;
  font-weight: 700;
  list-style: none;
}

.update-log__summary::-webkit-details-marker {
  display: none;
}

.update-log__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.update-log__title ion-icon {
  transition: transform 180ms ease;
}

.update-log[open] .update-log__title ion-icon {
  transform: rotate(90deg);
}

.update-log__count {
  min-width: 1.75rem;
  padding: 3px 8px;
  border-radius: 999px;
  color: var(--ion-color-primary-contrast);
  background: var(--ion-color-primary);
  font-size: 0.78rem;
  line-height: 1.2;
  text-align: center;
}

.update-log__body {
  display: grid;
  justify-items: end;
  padding-bottom: 8px;
}

.update-log__lines {
  display: grid;
  gap: 6px;
  max-height: 340px;
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  overflow: auto;
  border-radius: 10px;
  color: #e8eef7;
  background: #17202c;
}

.update-log__lines code {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
