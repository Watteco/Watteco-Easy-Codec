<template>
  <ion-page>
    <ion-header class="diagnostic-header">
      <ion-toolbar class="diagnostic-toolbar">
        <ion-buttons slot="start">
          <ion-back-button default-href="/ble-settings" />
        </ion-buttons>
        <ion-title>{{ localize('@diagnosticReport') }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <section class="diagnostic-section">
        <h2>{{ localize('@diagnosticLastSession') }}</h2>
        <ion-list v-if="lastSession" inset class="diagnostic-list">
          <ion-item>
            <ion-label>{{ localize('@diagnosticSessionDate') }}</ion-label>
            <ion-note slot="end">{{ formatSessionDate(lastSession.startedAt) }}</ion-note>
          </ion-item>
          <ion-item v-if="lastSensorDetails" class="sensor-details-item">
            <ion-label>
              <strong>{{ localize('@diagnosticSessionSensor') }}</strong>
              <span v-if="lastSensorDetails.identity" class="sensor-detail">
                <span>{{ localize(lastSensorDetails.identity.labelKey) }}</span>
                <ion-note>{{ lastSensorDetails.identity.value }}</ion-note>
              </span>
              <span v-if="lastSensorDetails.productName" class="sensor-detail">
                <span>{{ localize('@diagnosticSessionSensorType') }}</span>
                <ion-note>{{ lastSensorDetails.productName }}</ion-note>
              </span>
              <span v-if="lastSensorDetails.productReference" class="sensor-detail">
                <span>{{ localize('@diagnosticSessionProductId') }}</span>
                <ion-note>{{ lastSensorDetails.productReference }}</ion-note>
              </span>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>{{ localize('@diagnosticSessionErrors') }}</ion-label>
            <ion-note slot="end" :color="lastSession.errorCount > 0 ? 'danger' : 'medium'">
              {{ lastSession.errorCount }}
            </ion-note>
          </ion-item>
          <ion-item>
            <ion-label>{{ localize('@diagnosticSessionWarnings') }}</ion-label>
            <ion-note slot="end" :color="lastSession.warningCount > 0 ? 'warning' : 'medium'">
              {{ lastSession.warningCount }}
            </ion-note>
          </ion-item>
        </ion-list>
        <p v-else class="empty-session">{{ localize('@diagnosticNoSession') }}</p>
      </section>

      <section class="diagnostic-section">
        <h2>{{ localize('@diagnosticReportContents') }}</h2>
        <ion-list inset class="diagnostic-list">
          <ion-item>
            <ion-label>{{ localize('@diagnosticReportSessions') }}</ion-label>
            <ion-note slot="end">{{ reportTotals.sessionCount }}</ion-note>
          </ion-item>
          <ion-item>
            <ion-label>{{ localize('@diagnosticReportErrors') }}</ion-label>
            <ion-note slot="end">{{ reportTotals.errorCount }}</ion-note>
          </ion-item>
          <ion-item>
            <ion-label>{{ localize('@diagnosticReportWarnings') }}</ion-label>
            <ion-note slot="end">{{ reportTotals.warningCount }}</ion-note>
          </ion-item>
        </ion-list>
      </section>

      <section class="diagnostic-section">
        <h2>{{ localize('@diagnosticEnvironment') }}</h2>
        <ion-list inset class="diagnostic-list">
          <ion-item>
            <ion-label>{{ localize('@diagnosticPlatform') }}</ion-label>
            <ion-note slot="end">{{ platformName }}</ion-note>
          </ion-item>
          <ion-item>
            <ion-label>{{ localize('@diagnosticApplicationVersion') }}</ion-label>
            <ion-note slot="end">v{{ appVersion }}</ion-note>
          </ion-item>
        </ion-list>
      </section>

      <div class="diagnostic-notice">
        <ion-icon :icon="informationCircleOutline" aria-hidden="true" />
        <div>
          <p>{{ localize('@diagnosticPreviewNotice') }}</p>
          <p>{{ localize('@diagnosticFullReportNotice') }}</p>
          <p>{{ localize('@diagnosticPreviousSessionsNotice') }}</p>
        </div>
      </div>

      <ion-button
        expand="block"
        :disabled="diagnosticExportInProgress"
        @click="exportDiagnostics"
      >
        {{ diagnosticExportInProgress ? localize('@diagnosticExporting') : localize('@diagnosticExport') }}
      </ion-button>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader,
  IonIcon, IonItem, IonLabel, IonList, IonNote, IonPage, IonTitle, IonToolbar, toastController,
} from '@ionic/vue';
import { Capacitor } from '@capacitor/core';
import { informationCircleOutline } from 'ionicons/icons';
import axios from 'axios';
import { appVersion } from '@/utils/appVersion';
import { useLanguage } from '@/composables/useLanguage';
import { useBle } from '@/composables/useBle';
import { formatDevEui } from '@/utils/BLE/deviceIdentity';
import { getProductDisplayName } from '@/utils/productMeasurements';
import { exportDiagnosticReport } from '@/utils/diagnosticExport';
import { createDiagnosticLogger, getDiagnosticLogs } from '@/utils/diagnosticLogger';
import type { LanguageCode, Translations } from '@/types/localization';

import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

const { currentLanguage } = useLanguage();
const ble = useBle();
const diagnosticLogger = createDiagnosticLogger('settings');
const languages = ref<Record<LanguageCode, Translations>>({ en: {}, fr: {} });
const diagnosticExportInProgress = ref(false);
const diagnosticLogs = getDiagnosticLogs();

const reportTotals = {
  sessionCount: diagnosticLogs.filter(entry => (
    entry.scope === 'ble'
    && entry.message === 'BLE connection workflow started'
  )).length,
  errorCount: diagnosticLogs.filter(entry => entry.level === 'error').length,
  warningCount: diagnosticLogs.filter(entry => entry.level === 'warn').length,
};

const platformName = computed(() => {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return 'Android';
  if (platform === 'ios') return 'iOS';
  return 'Web';
});

const lastSensorDetails = computed(() => {
  const device = ble.lastConnectedDevice.value;
  const devEui = formatDevEui(device?.devEui);
  const identity = devEui
    ? { labelKey: '@diagnosticSessionDevEui', value: devEui }
    : device?.name
      ? { labelKey: '@diagnosticSessionBleName', value: device.name }
      : undefined;
  const productReference = ble.productReference.value ?? device?.productReference;
  const productName = device?.productName ?? getProductDisplayName(productReference);
  if (!identity && !productReference) return undefined;
  return { identity, productName, productReference };
});

const lastSession = computed(() => {
  const startIndex = diagnosticLogs.findLastIndex(entry => (
    entry.scope === 'ble'
    && entry.message === 'BLE connection workflow started'
  ));
  if (startIndex < 0) return undefined;

  const terminalMessages = new Set([
    'BLE disconnection completed',
    'BLE device disconnected unexpectedly',
    'BLE connection workflow timed out',
    'BLE connection workflow canceled',
  ]);
  const relativeEndIndex = diagnosticLogs.slice(startIndex).findIndex((entry, index) => (
    index > 0
    && entry.scope === 'ble'
    && terminalMessages.has(entry.message)
  ));
  const endIndex = relativeEndIndex < 0
    ? diagnosticLogs.length
    : startIndex + relativeEndIndex + 1;
  const sessionLogs = diagnosticLogs.slice(startIndex, endIndex);
  return {
    startedAt: diagnosticLogs[startIndex].timestamp,
    errorCount: sessionLogs.filter(entry => entry.level === 'error').length,
    warningCount: sessionLogs.filter(entry => entry.level === 'warn').length,
  };
});

const localize = (key: string): string => {
  if (!key.startsWith('@')) return key;
  return languages.value[currentLanguage.value][key.substring(1)] ?? key;
};

function formatSessionDate(timestamp: string): string {
  const locale = currentLanguage.value === 'fr' ? 'fr-FR' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

async function exportDiagnostics() {
  if (diagnosticExportInProgress.value) return;
  diagnosticExportInProgress.value = true;
  diagnosticLogger.info('Diagnostic export requested');
  try {
    const filename = await exportDiagnosticReport({
      ble: {
        initialized: ble.bleInitialized.value,
        scanning: ble.scanning.value,
        connected: ble.connected.value,
        connectionPhase: ble.connectionPhase.value,
        statusMessage: ble.statusMessage.value,
        connectedDevice: ble.connectedDevice.value,
        lastConnectedDevice: ble.lastConnectedDevice.value,
        productReference: ble.productReference.value,
        loraWanJoined: ble.loraWanJoined.value,
        loraLinkAvailable: ble.loraLinkAvailable.value,
        loraLinkTestAvailable: ble.loraLinkTestAvailable.value,
        loraLinkStatus: ble.loraLinkStatus.value,
        rssi: ble.bleRssi.value,
        signalLevel: ble.bleSignalLevel.value,
        recentEvents: ble.eventsLog.value,
        recentReceivedFrames: ble.receivedFrames.value,
        configurationFrames: ble.configurationFrameLogs.value,
        counterFrames: ble.counterFrameLogs.value,
        wakeDiagnostics: ble.wakeDiagnostics.value,
      },
    });
    diagnosticLogger.info('Diagnostic export completed', { filename });
    const toast = await toastController.create({
      message: localize('@diagnosticExportSuccess'),
      color: 'success',
      duration: 2500,
      position: 'bottom',
    });
    await toast.present();
  } catch (error) {
    if (/share canceled/i.test(String((error as { message?: unknown })?.message ?? error))) {
      diagnosticLogger.info('Diagnostic share canceled');
      return;
    }
    diagnosticLogger.error('Diagnostic export failed', { error });
    const toast = await toastController.create({
      message: localize('@diagnosticExportFailure'),
      color: 'danger',
      duration: 3000,
      position: 'bottom',
    });
    await toast.present();
  } finally {
    diagnosticExportInProgress.value = false;
  }
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
</script>

<style scoped>
.diagnostic-header {
  box-shadow: none;
}

ion-content {
  --background: var(--app-page-background);
}

.diagnostic-toolbar {
  --background: var(--ion-color-primary);
  --color: var(--ion-color-primary-contrast);
  --min-height: 82px;
  --padding-start: 8px;
  --padding-end: 12px;

  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
}

.diagnostic-toolbar ion-back-button {
  width: 44px;
  height: 44px;
  --color: var(--ion-color-primary-contrast);
}

.diagnostic-toolbar ion-title {
  font-size: 1.35rem;
}

.diagnostic-section {
  margin-bottom: 22px;
}

.diagnostic-section h2 {
  margin: 2px 4px 8px;
  color: var(--ion-color-dark);
  font-size: 1rem;
  font-weight: 600;
}

.diagnostic-list {
  margin: 0;
  border-radius: 10px;
}

.diagnostic-list ion-item:last-child {
  --border-width: 0;
}

.diagnostic-list ion-note {
  max-width: 55%;
  text-align: right;
}

.diagnostic-list > ion-item > ion-label {
  color: var(--ion-color-medium-shade);
  font-size: 0.9rem;
}

.diagnostic-list > ion-item > ion-note {
  font-size: 1rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.diagnostic-list > ion-item > ion-note:not(.ion-color) {
  color: var(--ion-text-color);
}

.sensor-details-item ion-label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
  margin-bottom: 14px;
  color: var(--ion-text-color);
  font-size: 1rem;
}

.sensor-detail {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-left: 14px;
  align-items: baseline;
}

.sensor-detail > span {
  color: var(--ion-color-medium-shade);
  font-size: 0.8rem;
}

.sensor-detail ion-note {
  max-width: none;
  color: var(--ion-text-color);
  font-size: 1rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.empty-session {
  margin: 0;
  padding: 16px;
  border-radius: 10px;
  background: var(--ion-item-background, var(--ion-background-color));
  color: var(--ion-color-medium);
}

.diagnostic-notice {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  padding: 14px;
  border-radius: 10px;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-text-color);
}

.diagnostic-notice ion-icon {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--ion-color-primary);
  font-size: 1.4rem;
}

.diagnostic-notice p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.diagnostic-notice p + p {
  margin-top: 8px;
  color: var(--ion-color-medium-shade);
}
</style>
