<template>
  <ion-page>
    <sensor-mobile-navigation active-page="tools" :localize="localize" />

    <ion-content :fullscreen="true" class="sensor-tools-content native-with-sensor-navigation">
      <main class="tools-container">
        <section>
          <details open>
            <summary class="section-summary">
              <ion-icon class="section-chevron" :icon="chevronForwardOutline" />
              <span class="section-title">{{ localize('@toolsDeviceStatus') }}</span>
            </summary>
            <ion-card class="tool-card">
            <ion-card-content>
              <div class="status-grid">
                <div class="status-item">
                  <span>{{ localize('@toolsBleName') }}</span>
                  <strong>{{ bleDeviceName }}</strong>
                </div>
                <div class="status-item">
                  <span>{{ localize('@toolsJoinStatus') }}</span>
                  <strong :class="{ 'value-ok': status?.joined, 'value-error': status && !status.joined }">
                    {{ joinLabel }}
                  </strong>
                </div>
                <div class="status-item">
                  <span>{{ localize('@toolsSensorTime') }}</span>
                  <strong>{{ formatDate(deviceStatus.sensorTime) }}</strong>
                </div>
                <div class="status-item">
                  <span>{{ localize('@toolsUptime') }}</span>
                  <strong>{{ formatDuration(deviceStatus.runningTimeSeconds) }}</strong>
                </div>
                <div class="status-item">
                  <span>{{ localize('@toolsOsaAuthentication') }}</span>
                  <strong :class="{ 'value-ok': deviceStatus.osaAuthenticated === true }">
                    {{ osaAuthenticationLabel }}
                  </strong>
                </div>
              </div>
              <div class="status-actions">
                <ion-button
                  size="small"
                  fill="clear"
                  :disabled="deviceStatusLoading || !ble.connected.value"
                  @click="refreshDeviceStatus"
                >
                  {{ deviceStatusLoading ? localize('@toolsRefreshing') : localize('@toolsRefreshStatus') }}
                </ion-button>
              </div>
            </ion-card-content>
            </ion-card>
          </details>
        </section>

        <section>
          <details open>
            <summary class="section-summary">
              <ion-icon class="section-chevron" :icon="chevronForwardOutline" />
              <span class="section-title">{{ localize('@toolsCampaignTitle') }}</span>
            </summary>
            <ion-card class="tool-card">
            <ion-card-content>
              <p class="card-description">{{ localize('@toolsCampaignDescription') }}</p>
              <div class="campaign-progress" :aria-live="campaignRunning ? 'polite' : undefined">
                <span>{{ campaignStatus }}</span>
                <span>{{ campaignSamples.length }}/{{ CAMPAIGN_SIZE }}</span>
              </div>
              <div class="action-row">
                <ion-button
                  v-if="!campaignRunning"
                  expand="block"
                  :disabled="!canRunTests"
                  @click="startCampaign"
                >
                  <ion-icon
                    slot="start"
                    :icon="deviceStatus.osaAuthenticated === true ? lockOpenOutline : lockClosedOutline"
                  />
                  {{ osaAuthenticating
                    ? localize('@toolsOsaAuthenticating')
                    : campaignSamples.length
                      ? localize('@toolsRestartCampaign')
                      : localize('@toolsStartCampaign') }}
                </ion-button>
                <ion-button v-else expand="block" color="medium" @click="cancelCampaign">
                  {{ localize('@toolsCancelCampaign') }}
                </ion-button>
              </div>
            </ion-card-content>
            </ion-card>

            <div v-if="campaignSamples.length" class="chart-grid">
            <sensor-history-card
              :label="localize('@toolsLinkMargin')"
              :subtitle="localize('@toolsFiveMeasureCampaign')"
              :empty-label="localize('@noHistoryData')"
              :points="marginHistory"
              unit="dB"
              accent="#2f9d68"
            />
            <sensor-history-card
              :label="localize('@toolsRssi')"
              :subtitle="localize('@toolsFiveMeasureCampaign')"
              :empty-label="localize('@noHistoryData')"
              :points="rssiHistory"
              unit="dBm"
              accent="#df6c3b"
            />
            <sensor-history-card
              :label="localize('@toolsSnr')"
              :subtitle="localize('@toolsFiveMeasureCampaign')"
              :empty-label="localize('@noHistoryData')"
              :points="snrHistory"
              unit="dB"
              :decimals="1"
              accent="#4f7bd9"
            />
            <div class="campaign-results">
              <div v-for="(sample, index) in campaignSamples" :key="`${sample.timestamp}-${index}`">
                <span>#{{ index + 1 }}</span>
                <div class="campaign-metrics">
                  <strong>{{ sample.marginDb }} dB</strong>
                  <span>{{ sample.gatewayCount }} {{ localize('@toolsGatewayShort') }}</span>
                  <span>RSSI {{ formatOptionalValue(sample.rssiDbm, 'dBm') }}</span>
                  <span>SNR {{ formatOptionalValue(sample.snrDb, 'dB', 1) }}</span>
                </div>
              </div>
            </div>
            </div>
          </details>
        </section>

        <section>
          <details open>
            <summary class="section-summary">
              <ion-icon class="section-chevron" :icon="chevronForwardOutline" />
              <span class="section-title">{{ localize('@toolsManualUplink') }}</span>
            </summary>
            <ion-card class="tool-card">
            <ion-card-content>
              <p class="card-description">{{ localize('@toolsManualFrameDescription') }}</p>
              <label class="field-label" for="tools-payload">{{ localize('@toolsHexPayload') }}</label>
              <textarea
                id="tools-payload"
                v-model="manualFrameHex"
                class="tool-input tool-textarea"
                placeholder="11 00 80 04 00 04"
                rows="3"
              ></textarea>

              <p v-if="manualFrameHex && !manualFrame" class="validation-error">
                {{ localize('@toolsInvalidPayload') }}
              </p>

              <ion-button expand="block" :disabled="!canSendManualFrame" @click="sendManualFrame">
                <ion-icon
                  slot="start"
                  :icon="deviceStatus.osaAuthenticated === true ? lockOpenOutline : lockClosedOutline"
                />
                {{ osaAuthenticating
                  ? localize('@toolsOsaAuthenticating')
                  : manualFrameSending
                    ? localize('@toolsSendingFrame')
                    : localize('@toolsSendFrame') }}
              </ion-button>

              <label class="field-label" for="tools-command-response">
                {{ localize('@toolsLastCommandResponse') }}
              </label>
              <textarea
                id="tools-command-response"
                class="tool-input tool-textarea"
                :value="lastCommandResponse"
                :placeholder="localize('@toolsNoCommandResponse')"
                rows="3"
                readonly
              ></textarea>
            </ion-card-content>
            </ion-card>
          </details>
        </section>

        <p v-if="feedback" class="feedback" :class="{ 'feedback--error': feedbackError }" aria-live="polite">
          {{ feedback }}
        </p>
      </main>
    </ion-content>

    <ble-debug-panel
      v-if="developerModeEnabled"
      v-model:visible="debugVisible"
      v-model:debugHex="debugHex"
      v-model:debugOtaAppKeyHex="debugOtaAppKeyHex"
      v-model:debugDevEuiHex="debugDevEuiHex"
      :logs="debugLogs"
      :connected="ble.connected.value"
      :subscribed="debugSubscribed"
      @start="startDebugSubscriptions"
      @stop="stopDebugSubscriptions"
      @clear="clearDebugLogs"
      @fetch-model-firmware="autoFetchModelFirmware"
      @write-fe62="writeToFe62"
      @write-ff01="writeToFf01"
      @write-ff02="writeToFf02"
      @write-lora-link-test="writeToLoraLinkTest"
      @read-fe61="readFe61"
      @read-ff01="readFf01"
      @read-fe21="readFe21InFe20"
      @read-lora-link="readLoraLinkInfo"
      @read-product-id="readProductId"
      @read-config-blob="readConfigurationBlob"
      @osa-challenge="runManualOsaChallenge"
      @osa-stored-challenge="runStoredOsaChallenge"
      @dump-services-only="dumpServicesOnly"
      @dump-services="dumpServices"
      @test-osa-storage="testSecureOsaStorage"
      @read-osa-storage="readStoredOsaKey"
      @delete-osa-storage="deleteStoredOsaKey"
      @purge-osa-storage="purgeExpiredOsaKeys"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import axios from 'axios';
import { IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonPage, onIonViewDidEnter } from '@ionic/vue';
import { chevronForwardOutline, lockClosedOutline, lockOpenOutline } from 'ionicons/icons';
import { useBle } from '@/composables/useBle';
import { useBleDebug } from '@/composables/useBleDebug';
import { useDeveloperMode } from '@/composables/useDeveloperMode';
import { useLanguage } from '@/composables/useLanguage';
import type { LanguageCode, Translations } from '@/types/localization';
import type { LoraLinkStatus } from '@/utils/BLE/loraLink';
import { readAdminDeviceStatus, type AdminDeviceStatus } from '@/utils/BLE/adminStatus';
import { presentAuthorizationDeniedAlert } from '@/utils/authorizationAlert';
import {
  parseAppFrameHex,
  readAppRx,
  startAppRxMonitoring,
  stopAppRxMonitoring,
  writeAppTx,
  type AppRxSubscription,
} from '@/utils/BLE/appFrames';
import { toSpacedHex } from '@/utils/BLE/blob';
import { playSensorPageTransition } from '@/utils/sensorPageTransition';
import SensorHistoryCard from '@/components/sensor/SensorHistoryCard.vue';
import SensorMobileNavigation from '@/components/sensor/SensorMobileNavigation.vue';
import BleDebugPanel from '@/components/ble/BleDebugPanel.vue';
import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

type CampaignSample = {
  timestamp: number;
  marginDb: number;
  gatewayCount: number;
  rssiDbm: number | null;
  snrDb: number | null;
};

const CAMPAIGN_SIZE = 5;
const LINK_CHECK_TIMEOUT_MS = 45_000;
const INTER_TEST_DELAY_MS = 5_000;
const ble = useBle();
const { developerModeEnabled } = useDeveloperMode();
const {
  debugVisible,
  debugLogs,
  debugSubscribed,
  debugHex,
  debugOtaAppKeyHex,
  debugDevEuiHex,
  clearDebugLogs,
  startDebugSubscriptions,
  stopDebugSubscriptions,
  writeToFe62,
  writeToFf01,
  writeToFf02,
  writeToLoraLinkTest,
  readFe61,
  readFf01,
  readFe21InFe20,
  readLoraLinkInfo,
  readConfigurationBlob,
  runOsaChallengeFe20,
  runStoredOsaChallengeFe20,
  dumpServices,
  dumpServicesOnly,
  readProductId,
  autoFetchModelFirmware,
  testSecureOsaStorage,
  readStoredOsaKey,
  deleteStoredOsaKey,
  purgeExpiredOsaKeys,
} = useBleDebug(ble, { enabled: developerModeEnabled });
const { currentLanguage } = useLanguage();
const languages = ref<Record<LanguageCode, Translations>>({ en: {}, fr: {} });
const campaignSamples = ref<CampaignSample[]>([]);
const campaignRunning = ref(false);
const campaignMessage = ref('');
const feedback = ref('');
const feedbackError = ref(false);
const deviceStatus = ref<AdminDeviceStatus>({
  sensorTime: null,
  runningTimeSeconds: null,
  osaAuthenticated: null,
});
const deviceStatusLoading = ref(false);
const osaAuthenticating = ref(false);
const manualFrameHex = ref('11 00 80 04 00 04');
const lastCommandResponse = ref('');
const manualFrameSending = ref(false);
const awaitingManualResponse = ref(false);
let appRxSubscription: AppRxSubscription | undefined;
let campaignCancelled = false;

const status = computed(() => ble.loraLinkStatus.value);
const bleDeviceName = computed(() => {
  const device = ble.connectedDevice.value ?? ble.lastConnectedDevice.value;
  return device ? ble.getDeviceName(device) : '—';
});
const canRunTests = computed(() => (
  ble.connected.value
  && ble.loraLinkTestAvailable.value === true
  && status.value?.joined === true
  && !osaAuthenticating.value
));
const joinLabel = computed(() => status.value
  ? localize(status.value.joined ? '@loraWanJoined' : '@loraWanNotJoined')
  : localize('@loraWanStatusUnknown'));
const campaignStatus = computed(() => campaignMessage.value || (
  campaignSamples.value.length === CAMPAIGN_SIZE
    ? localize('@toolsCampaignComplete')
    : localize('@toolsCampaignReady')
));
const osaAuthenticationLabel = computed(() => {
  if (deviceStatus.value.osaAuthenticated === null) return localize('@toolsStatusUnknown');
  return localize(deviceStatus.value.osaAuthenticated
    ? '@toolsOsaAuthenticated'
    : '@toolsOsaNotAuthenticated');
});
const marginHistory = computed(() => campaignSamples.value
  .map(sample => ({ timestamp: sample.timestamp, value: sample.marginDb })));
const rssiHistory = computed(() => campaignSamples.value.flatMap(sample => (
  sample.rssiDbm === null ? [] : [{ timestamp: sample.timestamp, value: sample.rssiDbm }]
)));
const snrHistory = computed(() => campaignSamples.value.flatMap(sample => (
  sample.snrDb === null ? [] : [{ timestamp: sample.timestamp, value: sample.snrDb }]
)));
const manualFrame = computed(() => parseAppFrameHex(manualFrameHex.value));
const canSendManualFrame = computed(() => (
  ble.connected.value
  && manualFrame.value !== null
  && !manualFrameSending.value
  && !osaAuthenticating.value
));

function localize(key: string): string {
  if (!key.startsWith('@')) return key;
  return languages.value[currentLanguage.value][key.substring(1)] ?? key;
}

function formatDate(value: number | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'medium' }).format(value);
}

function formatDuration(value: number | null): string {
  if (value === null) return '—';
  const days = Math.floor(value / 86_400);
  const hours = Math.floor((value % 86_400) / 3_600);
  const minutes = Math.floor((value % 3_600) / 60);
  if (days) return `${days} ${localize('@toolsDayShort')} ${hours} h ${minutes} min`;
  if (hours) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function formatOptionalValue(value: number | null, unit: string, decimals = 0): string {
  if (value === null) return '—';
  return `${value.toFixed(decimals)} ${unit}`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitForFreshLinkCheck(previousTimestamp: number | undefined): Promise<LoraLinkStatus> {
  const deadline = Date.now() + LINK_CHECK_TIMEOUT_MS;
  while (!campaignCancelled && Date.now() < deadline) {
    await delay(2_000);
    if (campaignCancelled) throw new Error(localize('@toolsCampaignCancelled'));
    const nextStatus = await ble.refreshLoraLinkStatus();
    const nextTimestamp = nextStatus.linkCheck?.timestamp;
    if (nextTimestamp && nextTimestamp !== previousTimestamp) return nextStatus;
  }
  throw new Error(localize('@toolsCampaignTimeout'));
}

async function refreshDeviceStatus(): Promise<void> {
  const deviceId = ble.connectedDevice.value?.deviceId;
  if (!ble.connected.value || !deviceId || deviceStatusLoading.value) return;
  deviceStatusLoading.value = true;
  try {
    deviceStatus.value = await readAdminDeviceStatus(deviceId, line => console.debug(line));
    if (deviceStatus.value.osaAuthenticated) {
      try {
        await ensureAppRxSubscription();
      } catch (error: any) {
        console.debug(`[APP RX] Monitoring unavailable: ${error?.message ?? error}`);
      }
    }
  } catch (error: any) {
    console.error('Failed to read administration status', error);
  } finally {
    deviceStatusLoading.value = false;
  }
}

function receiveAppFrame(frame: Uint8Array): void {
  lastCommandResponse.value = toSpacedHex(frame).toUpperCase();
  if (awaitingManualResponse.value) {
    awaitingManualResponse.value = false;
    feedbackError.value = false;
    feedback.value = localize('@toolsFrameResponseReceived');
  }
}

async function runManualOsaChallenge(): Promise<void> {
  await authenticateWithDebugCredentials(true);
}

async function authenticateWithDebugCredentials(force = false): Promise<boolean> {
  if (!force && deviceStatus.value.osaAuthenticated === true) return true;
  if (osaAuthenticating.value || !ble.connected.value) return false;
  osaAuthenticating.value = true;
  feedback.value = '';
  feedbackError.value = false;
  try {
    const authenticated = await runOsaChallengeFe20();
    await refreshDeviceStatusAfterChallenge();
    if (authenticated && deviceStatus.value.osaAuthenticated === true) return true;
    feedbackError.value = true;
    feedback.value = localize('@toolsOsaUnauthorized');
    await presentAuthorizationDeniedAlert(localize);
    return false;
  } catch (error: any) {
    console.debug(`[OSA] Authentication failed: ${error?.message ?? error}`);
    feedbackError.value = true;
    feedback.value = localize('@toolsOsaUnauthorized');
    await presentAuthorizationDeniedAlert(localize);
    return false;
  } finally {
    osaAuthenticating.value = false;
  }
}

async function runStoredOsaChallenge(): Promise<void> {
  if (osaAuthenticating.value || !ble.connected.value) return;
  osaAuthenticating.value = true;
  try {
    await runStoredOsaChallengeFe20();
    await refreshDeviceStatusAfterChallenge();
  } finally {
    osaAuthenticating.value = false;
  }
}

async function refreshDeviceStatusAfterChallenge(): Promise<void> {
  while (deviceStatusLoading.value) await delay(50);
  await refreshDeviceStatus();
}

async function ensureAppRxSubscription(): Promise<AppRxSubscription> {
  const deviceId = ble.connectedDevice.value?.deviceId;
  if (!ble.connected.value || !deviceId) throw new Error(localize('@noSensorConnected'));
  if (appRxSubscription?.deviceId === deviceId) return appRxSubscription;

  await stopAppRxMonitoring(appRxSubscription, line => console.debug(line));
  appRxSubscription = await startAppRxMonitoring(
    deviceId,
    receiveAppFrame,
    line => console.debug(line),
  );
  return appRxSubscription;
}

async function sendManualFrame(): Promise<void> {
  const deviceId = ble.connectedDevice.value?.deviceId;
  const frame = manualFrame.value;
  if (!canSendManualFrame.value || !deviceId || !frame) return;
  if (!await authenticateWithDebugCredentials()) return;

  manualFrameSending.value = true;
  awaitingManualResponse.value = true;
  lastCommandResponse.value = '';
  feedback.value = localize('@toolsFrameWaitingResponse');
  feedbackError.value = false;
  try {
    const subscription = await ensureAppRxSubscription();
    await writeAppTx(deviceId, frame, line => console.debug(line));

    if (!subscription.notifications) {
      await delay(500);
      receiveAppFrame(await readAppRx(deviceId, subscription));
    }
  } catch (error: any) {
    awaitingManualResponse.value = false;
    feedbackError.value = true;
    feedback.value = error?.message ?? String(error);
  } finally {
    manualFrameSending.value = false;
  }
}

async function startCampaign() {
  if (!canRunTests.value || campaignRunning.value) return;
  if (!await authenticateWithDebugCredentials()) return;
  campaignCancelled = false;
  campaignRunning.value = true;
  campaignSamples.value = [];
  feedback.value = '';
  feedbackError.value = false;

  try {
    for (let index = 0; index < CAMPAIGN_SIZE; index += 1) {
      if (campaignCancelled) break;
      campaignMessage.value = localize('@toolsCampaignMeasurement')
        .replace('{current}', String(index + 1))
        .replace('{total}', String(CAMPAIGN_SIZE));
      const previousLinkCheckTimestamp = ble.loraLinkStatus.value?.linkCheck?.timestamp;
      const previousRxSequence = ble.loraLinkStatus.value?.rx?.sequence;
      await ble.sendLoraLinkTest({
        linkCheck: true,
        sendUplink: true,
        fport: 199,
      });
      const response = await waitForFreshLinkCheck(previousLinkCheckTimestamp);
      const linkCheck = response.linkCheck;
      if (!linkCheck) throw new Error(localize('@toolsCampaignTimeout'));
      const freshRx = response.rx
        && response.rx.sequence !== previousRxSequence
        && Math.abs(response.rx.timestamp - linkCheck.timestamp) <= 2_000
        ? response.rx
        : null;
      campaignSamples.value = [...campaignSamples.value, {
        timestamp: linkCheck.timestamp,
        marginDb: linkCheck.marginDb,
        gatewayCount: linkCheck.gatewayCount,
        rssiDbm: freshRx?.rssiDbm ?? null,
        snrDb: freshRx?.snrDb ?? null,
      }];
      if (index < CAMPAIGN_SIZE - 1) await delay(INTER_TEST_DELAY_MS);
    }
    campaignMessage.value = campaignCancelled
      ? localize('@toolsCampaignCancelled')
      : localize('@toolsCampaignComplete');
  } catch (error: any) {
    if (!campaignCancelled) {
      feedbackError.value = true;
      feedback.value = error?.message ?? String(error);
      campaignMessage.value = localize('@toolsCampaignStopped');
    }
  } finally {
    campaignRunning.value = false;
  }
}

function cancelCampaign() {
  campaignCancelled = true;
}

onIonViewDidEnter(() => {
  playSensorPageTransition('tools', '.sensor-tools-content');
  void refreshDeviceStatus();
});

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

onBeforeUnmount(() => {
  cancelCampaign();
  void stopAppRxMonitoring(appRxSubscription, line => console.debug(line));
});
</script>

<style scoped>
.sensor-tools-content {
  --background: var(--app-page-background);
}

.native-with-sensor-navigation {
  --padding-top: calc(82px + env(safe-area-inset-top));
  --padding-bottom: calc(62px + env(safe-area-inset-bottom));
}

.tools-container {
  width: min(100%, 720px);
  margin: 0 auto;
  padding: 20px 12px 30px;
}

.tools-container section + section {
  margin-top: 24px;
}

.section-title {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: 0.9rem;
  font-weight: 700;
}

.section-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 4px 10px;
  cursor: pointer;
  list-style: none;
}

.section-summary::-webkit-details-marker { display: none; }
.section-chevron {
  flex: 0 0 auto;
  color: var(--ion-color-primary);
  font-size: 1rem;
  transition: transform 160ms ease;
}

details[open] > .section-summary .section-chevron { transform: rotate(90deg); }
.section-summary:focus-visible {
  border-radius: 6px;
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 3px;
}

.tool-card {
  margin: 0;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-surface);
  box-shadow: var(--app-card-shadow);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 12px;
}

.status-item {
  display: grid;
  gap: 3px;
}

.status-item--wide {
  grid-column: 1 / -1;
}

.status-item span,
.field-label {
  color: var(--app-text-muted);
  font-size: 0.74rem;
  font-weight: 600;
}

.status-item strong {
  color: var(--app-text);
  font-size: 1rem;
}

.status-item .value-ok { color: var(--ion-color-success); }
.status-item .value-error,
.validation-error { color: var(--ion-color-danger); }

.empty-state,
.card-description,
.feedback {
  color: var(--app-text-muted);
  font-size: 0.84rem;
}

.card-description { margin: 0 0 14px; }

.campaign-progress,
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--app-text);
}

.campaign-progress { margin-bottom: 12px; font-weight: 700; }
.action-row ion-button { width: 100%; }

.chart-grid {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.campaign-results {
  display: grid;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-border);
}

.campaign-results > div {
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 10px;
  padding: 10px 12px;
  color: var(--app-text-muted);
  background: var(--app-surface);
  font-size: 0.8rem;
}

.campaign-results strong { color: var(--app-text); }
.campaign-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 10px;
}

.status-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin: 10px 0 -8px;
}

.field-label {
  display: block;
  margin: 12px 0 6px;
}

.field-label:first-child { margin-top: 0; }

.tool-input {
  box-sizing: border-box;
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--app-border-strong);
  border-radius: 10px;
  color: var(--app-text);
  background: var(--app-page-background);
  font: inherit;
}

.tool-textarea { resize: vertical; font-family: monospace; }
.toggle-row { margin: 14px 0; }
.validation-error { margin: 8px 0 0; font-size: 0.76rem; }
.feedback { margin: 18px 4px 0; text-align: center; }
.feedback--error { color: var(--ion-color-danger); }
</style>
