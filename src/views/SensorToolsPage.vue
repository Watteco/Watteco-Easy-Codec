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
                  <span>{{ localize('@toolsOsaAuthentication') }}</span>
                  <strong :class="{ 'value-ok': deviceStatus.osaAuthenticated === true }">
                    {{ osaAuthenticationLabel }}
                  </strong>
                </div>
                <div class="status-item">
                  <span>{{ localize('@toolsJoinStatus') }}</span>
                  <strong :class="{ 'value-ok': status?.joined, 'value-error': status && !status.joined }">
                    {{ joinLabel }}
                  </strong>
                </div>
                <div v-if="status?.heartbeatMinSeconds != null" class="status-item">
                  <span>{{ localize('@toolsHeartbeat') }}</span>
                  <strong>{{ formatDuration(status?.heartbeatMinSeconds ?? null) }}</strong>
                </div>
                <div class="status-item">
                  <span>{{ localize('@toolsUptime') }}</span>
                  <strong>{{ formatDuration(deviceStatus.runningTimeSeconds) }}</strong>
                </div>
                <div class="status-item">
                  <span>{{ localize('@toolsFirmwareVersion') }}</span>
                  <strong :class="{
                    'value-auth-required': deviceInformationRequiresAuthentication,
                    'value-not-provided': deviceInformationIsNotProvided(deviceStatus.firmwareVersion),
                  }">
                    {{ formatDeviceInformation(deviceStatus.firmwareVersion) }}
                  </strong>
                </div>
                <div class="status-item">
                  <span>{{ localize('@toolsManufacturer') }}</span>
                  <strong :class="{
                    'value-auth-required': deviceInformationRequiresAuthentication,
                    'value-not-provided': deviceInformationIsNotProvided(deviceStatus.manufacturer),
                  }">
                    {{ formatDeviceInformation(deviceStatus.manufacturer) }}
                  </strong>
                </div>
                <div class="status-item">
                  <span>{{ localize('@toolsPcbVersion') }}</span>
                  <strong :class="{
                    'value-auth-required': deviceInformationRequiresAuthentication,
                    'value-not-provided': deviceInformationIsNotProvided(deviceStatus.pcbVersion),
                  }">
                    {{ formatDeviceInformation(deviceStatus.pcbVersion) }}
                  </strong>
                </div>
                <div v-if="sensorTimeIsPlausible" class="status-item status-item--sensor-time">
                  <span>{{ localize('@toolsSensorTime') }}</span>
                  <strong>{{ formatDate(deviceStatus.sensorTime) }}</strong>
                </div>
                <div v-if="developerModeEnabled" class="status-item status-item--firmware">
                  <span>{{ localize('@toolsFirmwareLongName') }}</span>
                  <strong>{{ deviceStatus.firmwareLongName || '—' }}</strong>
                </div>
              </div>
              <div class="status-actions">
                <ion-button
                  v-if="deviceStatus.osaAuthenticated !== true"
                  size="small"
                  fill="clear"
                  :disabled="osaAuthenticating || deviceStatusLoading || deviceInformationLoading || !ble.connected.value"
                  @click="authenticateForDeviceInformation"
                >
                  {{ osaAuthenticating ? localize('@toolsOsaAuthenticating') : localize('@toolsAuthenticate') }}
                </ion-button>
                <ion-button
                  class="status-refresh-button"
                  size="small"
                  fill="clear"
                  :disabled="deviceStatusLoading || deviceInformationLoading || !ble.connected.value"
                  @click="refreshDeviceStatus"
                >
                  {{ deviceStatusLoading || deviceInformationLoading
                    ? localize('@toolsRefreshing')
                    : localize('@toolsRefreshStatus') }}
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
              <span class="section-title">{{ localize('@toolsDeviceCommands') }}</span>
            </summary>
            <ion-card class="tool-card">
              <ion-card-content>
                <div class="command-list">
                  <div class="rejoin-command">
                    <div class="split-command">
                      <ion-button
                        class="split-command__action"
                        expand="block"
                        :disabled="!canSendRejoin"
                        @click="sendRejoin"
                      >
                        <ion-icon slot="start" :icon="lockIcon" />
                        {{ commandSending === 'rejoin'
                          ? localize('@toolsSendingCommand')
                          : localize('@toolsLoraRejoin') }}
                      </ion-button>
                      <ion-button
                        class="split-command__toggle"
                        :aria-label="localize('@toolsToggleRejoinDelay')"
                        :aria-expanded="rejoinOptionsVisible"
                        aria-controls="tools-rejoin-options"
                        @click="rejoinOptionsVisible = !rejoinOptionsVisible"
                      >
                        <ion-icon
                          :class="{ 'split-command__chevron--open': rejoinOptionsVisible }"
                          :icon="chevronDownOutline"
                        />
                      </ion-button>
                    </div>
                    <div
                      v-show="rejoinOptionsVisible"
                      id="tools-rejoin-options"
                      class="rejoin-options"
                    >
                      <label class="field-label" for="tools-rejoin-delay">
                        {{ localize('@toolsRejoinDelay') }}
                      </label>
                      <input
                        id="tools-rejoin-delay"
                        v-model="rejoinDelay"
                        class="tool-input command-duration"
                        maxlength="7"
                        placeholder="00:00"
                        aria-describedby="tools-rejoin-hint"
                      />
                      <p id="tools-rejoin-hint" class="field-hint">
                        {{ localize('@toolsHoursMinutesHint') }}
                      </p>
                      <p v-if="rejoinDelay && !rejoinFrame" class="validation-error">
                        {{ localize('@toolsInvalidDuration') }}
                      </p>
                    </div>
                  </div>
                  <ion-button
                    expand="block"
                    :disabled="!canSendCommand"
                    @click="sendSensorReboot"
                  >
                    <ion-icon slot="start" :icon="lockIcon" />
                    {{ commandSending === 'reboot'
                      ? localize('@toolsSendingCommand')
                      : localize('@toolsSensorReboot') }}
                  </ion-button>
                  <ion-button
                    expand="block"
                    :disabled="!canSendCommand"
                    @click="sendFactoryReset"
                  >
                    <ion-icon slot="start" :icon="lockIcon" />
                    {{ commandSending === 'factory-reset'
                      ? localize('@toolsSendingCommand')
                      : localize('@toolsFactoryReset') }}
                  </ion-button>
                  <ion-button expand="block" disabled>
                    <ion-icon slot="start" :icon="lockIcon" />
                    {{ localize('@toolsFirmwareUpdate') }}
                  </ion-button>
                </div>
                <p
                  v-if="feedback && feedbackContext === 'commands'"
                  class="feedback"
                  :class="{ 'feedback--error': feedbackError }"
                  aria-live="polite"
                >
                  {{ feedback }}
                </p>
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
                    :icon="deviceStatus.osaAuthenticated === true ? lockOpenOutline : lockClosed"
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
                <ion-button
                  v-if="developerModeEnabled && !campaignRunning"
                  expand="block"
                  fill="outline"
                  color="medium"
                  @click="simulateCampaign"
                >
                  {{ localize('@toolsSimulateCampaign') }}
                </ion-button>
              </div>
              <p
                v-if="feedback && feedbackContext === 'network-test'"
                class="feedback"
                :class="{ 'feedback--error': feedbackError }"
                aria-live="polite"
              >
                {{ feedback }}
              </p>
            </ion-card-content>
            </ion-card>

            <details v-if="developerModeEnabled" class="campaign-debug">
              <summary>{{ localize('@toolsCampaignDebugTitle') }}</summary>
              <div class="campaign-debug__header">
                <p>{{ localize('@toolsCampaignDebugDescription') }}</p>
                <ion-button
                  size="small"
                  fill="clear"
                  :disabled="campaignDiagnostics.length === 0"
                  @click="campaignDiagnostics = []"
                >
                  {{ localize('@toolsCampaignDebugClear') }}
                </ion-button>
              </div>
              <div class="campaign-debug__entries no-page-swipe">
                <pre
                  v-for="entry in campaignDiagnostics"
                  :key="entry.id"
                  :class="{
                    'campaign-debug__entry--accepted': entry.linkCheckFresh && entry.transactionComplete,
                    'campaign-debug__entry--rejected': entry.linkCheckFresh && !entry.transactionComplete,
                  }"
                >{{ formatCampaignDiagnostic(entry) }}</pre>
                <p v-if="campaignDiagnostics.length === 0" class="campaign-debug__empty">
                  {{ localize('@toolsCampaignDebugEmpty') }}
                </p>
              </div>
            </details>

            <div v-if="campaignRuns.length" class="chart-grid">
            <div class="campaign-selector" :aria-label="localize('@toolsCampaignSelection')">
              <button
                v-for="(run, runIndex) in campaignRuns"
                :key="run.id"
                type="button"
                class="campaign-selector__button"
                :class="{ 'campaign-selector__button--selected': selectedCampaign?.id === run.id }"
                :aria-pressed="selectedCampaign?.id === run.id"
                @click="selectCampaign(run.id)"
              >
                <span
                  class="campaign-selector__dot"
                  :style="{ backgroundColor: CAMPAIGN_COLORS[runIndex] }"
                  aria-hidden="true"
                />
                {{ campaignLabel(run) }}
              </button>
            </div>
            <sensor-history-card
              :label="localize('@toolsLinkMarginLong')"
              :subtitle="localize('@toolsFiveMeasureCampaign')"
              :empty-label="localize('@noHistoryData')"
              :series="campaignSeries('marginDb')"
              :selected-series-id="selectedCampaign?.id"
              unit="dB"
              accent="#2f9d68"
              x-axis-mode="sequence"
              @select-series="selectCampaign"
            />
            <sensor-history-card
              :label="localize('@toolsRssiLong')"
              :subtitle="localize('@toolsFiveMeasureCampaign')"
              :empty-label="localize('@noHistoryData')"
              :series="campaignSeries('rssiDbm')"
              :selected-series-id="selectedCampaign?.id"
              unit="dBm"
              accent="#df6c3b"
              x-axis-mode="sequence"
              @select-series="selectCampaign"
            />
            <sensor-history-card
              :label="localize('@toolsSnrLong')"
              :subtitle="localize('@toolsFiveMeasureCampaign')"
              :empty-label="localize('@noHistoryData')"
              :series="campaignSeries('snrDb')"
              :selected-series-id="selectedCampaign?.id"
              unit="dB"
              :decimals="1"
              accent="#4f7bd9"
              x-axis-mode="sequence"
              @select-series="selectCampaign"
            />

            <section class="campaign-comparison" :aria-label="localize('@toolsCampaignComparison')">
              <h3>{{ localize('@toolsCampaignComparison') }}</h3>
              <div class="campaign-comparison__scroll no-page-swipe">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{{ localize('@toolsCampaign') }}</th>
                      <th scope="col">{{ localize('@toolsSuccess') }}</th>
                      <th scope="col">{{ localize('@toolsGateways') }}</th>
                      <th scope="col">{{ localize('@toolsLinkMargin') }}</th>
                      <th scope="col">{{ localize('@toolsRssi') }}</th>
                      <th scope="col">{{ localize('@toolsSnr') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="run in campaignRuns"
                      :key="run.id"
                      :class="{ 'campaign-comparison__selected': selectedCampaign?.id === run.id }"
                      @click="selectCampaign(run.id)"
                    >
                      <th scope="row">
                        <button type="button" @click="selectCampaign(run.id)">
                          {{ campaignLabel(run) }}
                        </button>
                      </th>
                      <td>{{ run.samples.length }}/{{ CAMPAIGN_SIZE }}</td>
                      <td>{{ formatGatewayRange(run) }}</td>
                      <td>{{ formatCampaignMedian(run, 'marginDb', 'dB') }}</td>
                      <td>{{ formatCampaignMedian(run, 'rssiDbm', 'dBm') }}</td>
                      <td>{{ formatCampaignMedian(run, 'snrDb', 'dB', 1) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>{{ localize('@toolsCampaignMedianHint') }}</p>
            </section>

            <header v-if="selectedCampaign" class="campaign-details-header">
              <div>
                <h3>{{ localize('@toolsCampaignDetails') }} · {{ campaignLabel(selectedCampaign) }}</h3>
                <p>{{ campaignDateLabel(selectedCampaign) }}</p>
              </div>
              <strong>{{ selectedCampaign.samples.length }}/{{ CAMPAIGN_SIZE }}</strong>
            </header>
            <div class="campaign-results">
              <div
                v-for="(sample, index) in selectedCampaign?.samples ?? []"
                :key="`${sample.timestamp}-${index}`"
                class="campaign-result"
              >
                <div class="campaign-result__header">
                  <strong>#{{ index + 1 }}</strong>
                  <span>{{ sample.gatewayCount }} {{ localize('@toolsGatewayShort') }}</span>
                </div>
                <div class="campaign-directions">
                  <section class="campaign-direction" aria-label="TX">
                    <h4>TX</h4>
                    <dl>
                      <div>
                        <dt>{{ localize('@toolsLinkMargin') }}</dt>
                        <dd>{{ sample.marginDb }} dB</dd>
                      </div>
                      <div>
                        <dt>{{ localize('@toolsTxPower') }}</dt>
                        <dd>{{ formatOptionalValue(sample.txPowerDbm, 'dBm') }}</dd>
                      </div>
                      <div>
                        <dt>{{ localize('@toolsTxSf') }}</dt>
                        <dd>{{ formatSpreadingFactor(sample.txDataRate) }}</dd>
                      </div>
                      <div>
                        <dt>{{ localize('@toolsTxFrequency') }}</dt>
                        <dd>{{ formatFrequency(sample.txFrequencyHz) }}</dd>
                      </div>
                    </dl>
                  </section>
                  <section class="campaign-direction" aria-label="RX">
                    <h4>RX</h4>
                    <dl>
                      <div>
                        <dt>{{ localize('@toolsRssi') }}</dt>
                        <dd>{{ formatOptionalValue(sample.rssiDbm, 'dBm') }}</dd>
                      </div>
                      <div>
                        <dt>{{ localize('@toolsSnr') }}</dt>
                        <dd>{{ formatOptionalValue(sample.snrDb, 'dB', 1) }}</dd>
                      </div>
                      <div>
                        <dt>{{ localize('@toolsRxSf') }}</dt>
                        <dd>{{ formatSpreadingFactor(sample.rxDataRate) }}</dd>
                      </div>
                      <div>
                        <dt>{{ localize('@toolsRxWindow') }}</dt>
                        <dd>{{ formatRxWindow(sample.rxWindow) }}</dd>
                      </div>
                    </dl>
                  </section>
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
                ref="manualFrameInput"
                id="tools-payload"
                v-model="manualFrameHex"
                class="tool-input tool-textarea"
                placeholder="11 00 80 04 00 04"
                rows="3"
                :inputmode="systemKeyboardEnabled ? 'text' : 'none'"
                autocapitalize="characters"
                autocorrect="off"
                spellcheck="false"
                @blur="rememberManualFrameSelection"
                @click="rememberManualFrameSelection"
                @input="rememberManualFrameSelection"
                @keyup="rememberManualFrameSelection"
                @select="rememberManualFrameSelection"
              ></textarea>

              <div class="hex-keypad">
                <div v-if="!systemKeyboardEnabled" class="hex-keypad__keys">
                  <button
                    v-for="key in HEX_KEYPAD_KEYS"
                    :key="key"
                    type="button"
                    class="hex-keypad__key"
                    @click="insertManualFrameText(key)"
                  >
                    {{ key }}
                  </button>
                  <button
                    type="button"
                    class="hex-keypad__key hex-keypad__key--wide"
                    @click="insertManualFrameText(' ')"
                  >
                    {{ localize('@toolsHexSpace') }}
                  </button>
                  <button
                    type="button"
                    class="hex-keypad__key hex-keypad__key--wide"
                    :aria-label="localize('@toolsHexBackspace')"
                    @click="handleDeleteKeyClick"
                    @pointercancel="stopDeleteRepeat"
                    @pointerdown.prevent="startDeleteRepeat"
                    @pointerleave="stopDeleteRepeat"
                    @pointerup="stopDeleteRepeat"
                  >
                    &#9003;
                  </button>
                </div>
                <ion-button
                  class="hex-keypad__mode"
                  size="small"
                  fill="clear"
                  expand="block"
                  @click="toggleSystemKeyboard"
                >
                  {{ systemKeyboardEnabled
                    ? localize('@toolsHexKeypad')
                    : localize('@toolsSystemKeyboard') }}
                </ion-button>
              </div>

              <p v-if="manualFrameHex && !manualFrame" class="validation-error">
                {{ localize('@toolsInvalidPayload') }}
              </p>

              <ion-button expand="block" :disabled="!canSendManualFrame" @click="sendManualFrame">
                <ion-icon
                  slot="start"
                  :icon="deviceStatus.osaAuthenticated === true ? lockOpenOutline : lockClosed"
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
              <p
                v-if="feedback && feedbackContext === 'manual-frame'"
                class="feedback"
                :class="{ 'feedback--error': feedbackError }"
                aria-live="polite"
              >
                {{ feedback }}
              </p>
            </ion-card-content>
            </ion-card>
          </details>
        </section>

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
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import axios from 'axios';
import { IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonPage, onIonViewDidEnter } from '@ionic/vue';
import { chevronDownOutline, chevronForwardOutline, lockClosed, lockOpenOutline } from 'ionicons/icons';
import { useBle } from '@/composables/useBle';
import { useBleDebug } from '@/composables/useBleDebug';
import { useDeveloperMode } from '@/composables/useDeveloperMode';
import { useLanguage } from '@/composables/useLanguage';
import type { LanguageCode, Translations } from '@/types/localization';
import {
  eu868DataRateToSpreadingFactor,
  LoraLinkTestRejectedError,
  type LoraLinkStatus,
} from '@/utils/BLE/loraLink';
import {
  isPlausibleSensorTime,
  readAdminDeviceStatus,
  type AdminDeviceStatus,
} from '@/utils/BLE/adminStatus';
import { presentAuthorizationDeniedAlert } from '@/utils/authorizationAlert';
import {
  parseAppFrameHex,
  startAppRxMonitoring,
  stopAppRxMonitoring,
  writeAppTx,
  type AppRxSubscription,
} from '@/utils/BLE/appFrames';
import { toSpacedHex } from '@/utils/BLE/blob';
import {
  buildLoraRejoinFrame,
  FACTORY_RESET_FRAME,
  isExpectedRestartDisconnect,
  rebootDevice,
} from '@/utils/BLE/deviceCommands';
import {
  readDeviceInformation,
  type DeviceInformation,
} from '@/utils/BLE/deviceInformation';
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
  txDataRate: number | null;
  txPowerDbm: number | null;
  txFrequencyHz: number | null;
  rxDataRate: number | null;
  rxWindow: number | null;
};

type CampaignRun = {
  id: string;
  startedAt: number;
  samples: CampaignSample[];
};

type CompleteLinkCheckStatus = LoraLinkStatus & {
  linkCheck: NonNullable<LoraLinkStatus['linkCheck']>;
  rx: NonNullable<LoraLinkStatus['rx']>;
  tx: NonNullable<LoraLinkStatus['tx']>;
};

type CampaignDiagnostic = {
  id: number;
  observedAt: number;
  sampleNumber: number;
  flags: number;
  linkCheckFresh: boolean;
  previousLinkCheckTimestamp: number | null;
  linkCheckTimestamp: number | null;
  marginDb: number | null;
  gatewayCount: number | null;
  previousRxSequence: number | null;
  rxSequence: number | null;
  rxTimestamp: number | null;
  rxSource: number | null;
  rxWindow: number | null;
  rxLinkDeltaMs: number | null;
  rxSequenceFresh: boolean;
  previousTxSequence: number | null;
  txSequence: number | null;
  txTimestamp: number | null;
  txStatus: number | null;
  txSequenceFresh: boolean;
  transactionComplete: boolean;
};

type CampaignMetric = 'marginDb' | 'rssiDbm' | 'snrDb';

type DeviceStatus = AdminDeviceStatus & DeviceInformation;

const CAMPAIGN_SIZE = 5;
const MAX_CAMPAIGN_RUNS = 4;
const CAMPAIGN_COLORS = ['#f47b20', '#4f7bd9', '#2f9d68', '#8a67c7'];
const LINK_CHECK_TIMEOUT_MS = 45_000;
const LINK_TEST_BUSY_RETRY_TIMEOUT_MS = 45_000;
const LINK_TEST_BUSY_RETRY_DELAY_MS = 2_000;
const INTER_TEST_DELAY_MS = 5_000;
const APP_RX_FIRST_RESPONSE_TIMEOUT_MS = 2_000;
const APP_RX_IDLE_TIMEOUT_MS = 1_000;
const HEX_KEYPAD_KEYS = [
  '1', '2', '3', 'A',
  '4', '5', '6', 'B',
  '7', '8', '9', 'C',
  '0', 'D', 'E', 'F',
] as const;
const ble = useBle();
const { developerModeEnabled } = useDeveloperMode();
const {
  debugVisible,
  debugLogs,
  debugSubscribed,
  debugHex,
  debugOtaAppKeyHex,
  debugDevEuiHex,
  pushDebugLog,
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
const campaignDiagnostics = ref<CampaignDiagnostic[]>([]);
const previousCampaigns = ref<CampaignRun[]>([]);
const currentCampaignId = ref<string | null>(null);
const currentCampaignStartedAt = ref<number | null>(null);
const selectedCampaignId = ref<string | null>(null);
const campaignRunning = ref(false);
const campaignMessage = ref('');
const feedback = ref('');
const feedbackError = ref(false);
const feedbackContext = ref<'commands' | 'network-test' | 'manual-frame'>('commands');
const deviceStatus = ref<DeviceStatus>({
  firmwareLongName: null,
  firmwareVersion: null,
  manufacturer: null,
  pcbVersion: null,
  sensorTime: null,
  runningTimeSeconds: null,
  osaAuthenticated: null,
});
const deviceStatusLoading = ref(false);
const deviceInformationLoading = ref(false);
const osaAuthenticating = ref(false);
const manualFrameHex = ref('11 00 80 04 00 04');
const manualFrameInput = ref<HTMLTextAreaElement | null>(null);
const manualFrameSelectionStart = ref(manualFrameHex.value.length);
const manualFrameSelectionEnd = ref(manualFrameHex.value.length);
const systemKeyboardEnabled = ref(false);
const lastCommandResponse = ref('');
const manualFrameSending = ref(false);
const awaitingManualResponse = ref(false);
const rejoinDelay = ref('00:00');
const rejoinOptionsVisible = ref(false);
const commandSending = ref<'rejoin' | 'factory-reset' | 'reboot' | null>(null);
let appRxSubscription: AppRxSubscription | undefined;
let appRxResponseTimer: ReturnType<typeof setTimeout> | undefined;
let resolveAppRxResponses: (() => void) | undefined;
let deviceInformationDeviceId: string | undefined;
let campaignCancelled = false;
let campaignSequence = 0;
let campaignDiagnosticSequence = 0;
let deleteRepeatDelay: ReturnType<typeof setTimeout> | undefined;
let deleteRepeatInterval: ReturnType<typeof setInterval> | undefined;

const status = computed(() => ble.loraLinkStatus.value);
const bleDeviceName = computed(() => {
  const device = ble.connectedDevice.value ?? ble.lastConnectedDevice.value;
  return device ? ble.getDeviceName(device) : '—';
});
const canRunTests = computed(() => (
  ble.connected.value
  && ble.loraLinkTestAvailable.value === true
  && status.value?.joined === true
  && !ble.sending.value
  && !osaAuthenticating.value
));
const joinLabel = computed(() => status.value
  ? localize(status.value.joined ? '@toolsJoined' : '@toolsNotJoined')
  : localize('@toolsStatusUnknown'));
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
const sensorTimeIsPlausible = computed(() => isPlausibleSensorTime(deviceStatus.value.sensorTime));
const deviceInformationRequiresAuthentication = computed(() => (
  deviceStatus.value.osaAuthenticated === false
));
const campaignRuns = computed<CampaignRun[]>(() => {
  const current = currentCampaignId.value && currentCampaignStartedAt.value
    ? [{
      id: currentCampaignId.value,
      startedAt: currentCampaignStartedAt.value,
      samples: campaignSamples.value,
    }]
    : [];
  return [...current, ...previousCampaigns.value].slice(0, MAX_CAMPAIGN_RUNS);
});
const selectedCampaign = computed(() => (
  campaignRuns.value.find(run => run.id === selectedCampaignId.value)
  ?? campaignRuns.value[0]
));
const manualFrame = computed(() => parseAppFrameHex(manualFrameHex.value));
const rejoinFrame = computed(() => buildLoraRejoinFrame(rejoinDelay.value));
const lockIcon = computed(() => (
  deviceStatus.value.osaAuthenticated === true ? lockOpenOutline : lockClosed
));
const canSendCommand = computed(() => (
  ble.connected.value
  && !ble.sending.value
  && !commandSending.value
  && !osaAuthenticating.value
));
const canSendRejoin = computed(() => canSendCommand.value && rejoinFrame.value !== null);
const canSendManualFrame = computed(() => (
  ble.connected.value
  && manualFrame.value !== null
  && !manualFrameSending.value
  && !ble.sending.value
  && !osaAuthenticating.value
));

function rememberManualFrameSelection(): void {
  const input = manualFrameInput.value;
  if (!input) return;
  manualFrameSelectionStart.value = input.selectionStart ?? manualFrameHex.value.length;
  manualFrameSelectionEnd.value = input.selectionEnd ?? manualFrameSelectionStart.value;
}

async function restoreManualFrameSelection(position: number): Promise<void> {
  await nextTick();
  const input = manualFrameInput.value;
  if (!input) return;
  input.focus({ preventScroll: true });
  input.setSelectionRange(position, position);
  manualFrameSelectionStart.value = position;
  manualFrameSelectionEnd.value = position;
}

function insertManualFrameText(text: string): void {
  const start = manualFrameSelectionStart.value;
  const end = manualFrameSelectionEnd.value;
  manualFrameHex.value = `${manualFrameHex.value.slice(0, start)}${text}${manualFrameHex.value.slice(end)}`;
  void restoreManualFrameSelection(start + text.length);
}

function deleteManualFrameBackward(): void {
  const start = manualFrameSelectionStart.value;
  const end = manualFrameSelectionEnd.value;
  if (start === end && start === 0) {
    void restoreManualFrameSelection(0);
    return;
  }

  const deletionStart = start === end ? start - 1 : start;
  manualFrameHex.value = `${manualFrameHex.value.slice(0, deletionStart)}${manualFrameHex.value.slice(end)}`;
  void restoreManualFrameSelection(deletionStart);
}

function stopDeleteRepeat(): void {
  if (deleteRepeatDelay) clearTimeout(deleteRepeatDelay);
  if (deleteRepeatInterval) clearInterval(deleteRepeatInterval);
  deleteRepeatDelay = undefined;
  deleteRepeatInterval = undefined;
}

function startDeleteRepeat(event: PointerEvent): void {
  stopDeleteRepeat();
  (event.currentTarget as HTMLButtonElement).setPointerCapture?.(event.pointerId);
  deleteManualFrameBackward();
  deleteRepeatDelay = setTimeout(() => {
    deleteRepeatInterval = setInterval(deleteManualFrameBackward, 55);
  }, 350);
}

function handleDeleteKeyClick(event: MouseEvent): void {
  if (event.detail === 0) deleteManualFrameBackward();
}

async function toggleSystemKeyboard(): Promise<void> {
  rememberManualFrameSelection();
  manualFrameInput.value?.blur();
  systemKeyboardEnabled.value = !systemKeyboardEnabled.value;
  await restoreManualFrameSelection(manualFrameSelectionStart.value);
}

function localize(key: string): string {
  if (!key.startsWith('@')) return key;
  return languages.value[currentLanguage.value][key.substring(1)] ?? key;
}

function formatLinkTestRejection(error: LoraLinkTestRejectedError): string {
  const localizationKeys = {
    'not-initialized': '@toolsLinkTestNotInitialized',
    invalid: '@toolsLinkTestInvalid',
    busy: '@toolsLinkTestBusy',
    failed: '@toolsLinkTestFailed',
    'no-time': '@toolsLinkTestNoTime',
    'invalid-stack-id': '@toolsLinkTestInvalidStackId',
    'no-event': '@toolsLinkTestNoEvent',
  } satisfies Record<typeof error.reason, string>;
  return `${localize(localizationKeys[error.reason])} (ATT 0x${error.attCode.toString(16).padStart(2, '0').toUpperCase()})`;
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

function campaignLabel(run: CampaignRun): string {
  if (run.id === currentCampaignId.value) return localize('@toolsCurrentCampaign');
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(run.startedAt);
}

function campaignDateLabel(run: CampaignRun): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(run.startedAt);
}

function selectCampaign(campaignId: string): void {
  selectedCampaignId.value = campaignId;
}

function campaignSeries(metric: CampaignMetric) {
  return campaignRuns.value.map((run, runIndex) => ({
    id: run.id,
    label: campaignLabel(run),
    accent: CAMPAIGN_COLORS[runIndex],
    points: run.samples.flatMap((sample, sampleIndex) => {
      const value = sample[metric];
      return value === null ? [] : [{ sequence: sampleIndex + 1, value }];
    }),
  }));
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatCampaignMedian(
  run: CampaignRun,
  metric: CampaignMetric,
  unit: string,
  decimals = 0,
): string {
  const value = median(run.samples.flatMap(sample => (
    sample[metric] === null ? [] : [sample[metric]]
  )));
  return value === null ? '—' : `${value.toFixed(decimals)} ${unit}`;
}

function formatGatewayRange(run: CampaignRun): string {
  if (!run.samples.length) return '—';
  const values = run.samples.map(sample => sample.gatewayCount);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return minimum === maximum ? String(minimum) : `${minimum}–${maximum}`;
}

function archiveCurrentCampaign(): void {
  if (!currentCampaignId.value || !currentCampaignStartedAt.value || !campaignSamples.value.length) return;
  previousCampaigns.value = [{
    id: currentCampaignId.value,
    startedAt: currentCampaignStartedAt.value,
    samples: [...campaignSamples.value],
  }, ...previousCampaigns.value].slice(0, MAX_CAMPAIGN_RUNS - 1);
}

function beginCampaign(startedAt = Date.now()): void {
  archiveCurrentCampaign();
  campaignSequence += 1;
  currentCampaignId.value = `campaign-${startedAt}-${campaignSequence}`;
  currentCampaignStartedAt.value = startedAt;
  selectedCampaignId.value = currentCampaignId.value;
  campaignSamples.value = [];
  campaignDiagnostics.value = [];
}

function formatSpreadingFactor(dataRate: number | null): string {
  const spreadingFactor = eu868DataRateToSpreadingFactor(dataRate);
  return spreadingFactor === null ? '—' : `SF${spreadingFactor}`;
}

function formatFrequency(frequencyHz: number | null): string {
  if (frequencyHz === null) return '—';
  return `${(frequencyHz / 1_000_000).toFixed(3)} MHz`;
}

function formatRxWindow(window: number | null): string {
  if (window === null) return '—';
  if (window === 0) return 'RX1';
  if (window === 1) return 'RX2';
  if (window === 2) return 'RXR';
  return `#${window}`;
}

function formatDeviceInformation(value: string | null): string {
  if (value) return value;
  if (deviceInformationRequiresAuthentication.value) {
    return localize('@toolsAuthenticationRequired');
  }
  if (deviceStatus.value.osaAuthenticated === true) return localize('@toolsNotProvided');
  return '—';
}

function deviceInformationIsNotProvided(value: string | null): boolean {
  return deviceStatus.value.osaAuthenticated === true && !value;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function isCompleteLinkCheckStatus(response: LoraLinkStatus): response is CompleteLinkCheckStatus {
  return response.linkCheck !== null && response.rx !== null && response.tx !== null;
}

function recordCampaignDiagnostic(
  sampleNumber: number,
  response: LoraLinkStatus,
  previousLinkCheckTimestamp: number | undefined,
  previousRxSequence: number | undefined,
  previousTxSequence: number | undefined,
): void {
  const linkCheckTimestamp = response.linkCheck?.timestamp ?? null;
  const rxTimestamp = response.rx?.timestamp ?? null;
  const entry: CampaignDiagnostic = {
    id: ++campaignDiagnosticSequence,
    observedAt: Date.now(),
    sampleNumber,
    flags: response.flags,
    linkCheckFresh: linkCheckTimestamp !== null && linkCheckTimestamp !== previousLinkCheckTimestamp,
    previousLinkCheckTimestamp: previousLinkCheckTimestamp ?? null,
    linkCheckTimestamp,
    marginDb: response.linkCheck?.marginDb ?? null,
    gatewayCount: response.linkCheck?.gatewayCount ?? null,
    previousRxSequence: previousRxSequence ?? null,
    rxSequence: response.rx?.sequence ?? null,
    rxTimestamp,
    rxSource: response.rx?.source ?? null,
    rxWindow: response.rx?.window ?? null,
    rxLinkDeltaMs: rxTimestamp !== null && linkCheckTimestamp !== null
      ? rxTimestamp - linkCheckTimestamp
      : null,
    rxSequenceFresh: response.rx !== null && response.rx.sequence !== previousRxSequence,
    previousTxSequence: previousTxSequence ?? null,
    txSequence: response.tx?.sequence ?? null,
    txTimestamp: response.tx?.timestamp ?? null,
    txStatus: response.tx?.status ?? null,
    txSequenceFresh: response.tx !== null && response.tx.sequence !== previousTxSequence,
    transactionComplete: isCompleteLinkCheckStatus(response),
  };
  campaignDiagnostics.value = [entry, ...campaignDiagnostics.value].slice(0, 100);
}

function formatDiagnosticValue(value: number | null): string {
  return value === null ? '—' : String(value);
}

function formatDiagnosticTime(timestamp: number | null): string {
  if (timestamp === null) return '—';
  return `${timestamp} (${new Date(timestamp).toLocaleTimeString()})`;
}

function formatCampaignDiagnostic(entry: CampaignDiagnostic): string {
  const result = entry.linkCheckFresh
    ? entry.transactionComplete ? 'COMPLETE' : 'INCOMPLETE'
    : 'WAITING';
  const flags = `0x${entry.flags.toString(16).padStart(2, '0').toUpperCase()}`;
  return [
    `#${entry.sampleNumber}  ${new Date(entry.observedAt).toLocaleTimeString()}  ${result}  flags=${flags}`,
    `LC  ts: ${formatDiagnosticTime(entry.previousLinkCheckTimestamp)} -> ${formatDiagnosticTime(entry.linkCheckTimestamp)}  fresh=${entry.linkCheckFresh}  margin=${formatDiagnosticValue(entry.marginDb)} dB  gw=${formatDiagnosticValue(entry.gatewayCount)}`,
    `RX  seq: ${formatDiagnosticValue(entry.previousRxSequence)} -> ${formatDiagnosticValue(entry.rxSequence)}  fresh=${entry.rxSequenceFresh}  ts=${formatDiagnosticTime(entry.rxTimestamp)}  deltaLC=${formatDiagnosticValue(entry.rxLinkDeltaMs)} ms  source=${formatDiagnosticValue(entry.rxSource)}  window=${formatDiagnosticValue(entry.rxWindow)}`,
    `TX  seq: ${formatDiagnosticValue(entry.previousTxSequence)} -> ${formatDiagnosticValue(entry.txSequence)}  fresh=${entry.txSequenceFresh}  ts=${formatDiagnosticTime(entry.txTimestamp)}  status=${formatDiagnosticValue(entry.txStatus)}`,
  ].join('\n');
}

async function waitForFreshLinkCheck(
  previousTimestamp: number | undefined,
  previousRxSequence: number | undefined,
  previousTxSequence: number | undefined,
  sampleNumber: number,
): Promise<CompleteLinkCheckStatus> {
  const deadline = Date.now() + LINK_CHECK_TIMEOUT_MS;
  while (!campaignCancelled && Date.now() < deadline) {
    await delay(2_000);
    if (campaignCancelled) throw new Error(localize('@toolsCampaignCancelled'));
    const nextStatus = await ble.refreshLoraLinkStatus();
    const nextTimestamp = nextStatus.linkCheck?.timestamp;
    recordCampaignDiagnostic(
      sampleNumber,
      nextStatus,
      previousTimestamp,
      previousRxSequence,
      previousTxSequence,
    );
    if (
      nextTimestamp
      && nextTimestamp !== previousTimestamp
      && isCompleteLinkCheckStatus(nextStatus)
    ) return nextStatus;
  }
  throw new Error(localize('@toolsCampaignTimeout'));
}

async function sendCampaignLinkTest(measurementMessage: string): Promise<{
  previousLinkCheckTimestamp: number | undefined;
  previousRxSequence: number | undefined;
  previousTxSequence: number | undefined;
}> {
  const deadline = Date.now() + LINK_TEST_BUSY_RETRY_TIMEOUT_MS;
  let busyAttempts = 0;
  while (!campaignCancelled) {
    const previousLinkCheckTimestamp = ble.loraLinkStatus.value?.linkCheck?.timestamp;
    const previousRxSequence = ble.loraLinkStatus.value?.rx?.sequence;
    const previousTxSequence = ble.loraLinkStatus.value?.tx?.sequence;
    try {
      await ble.sendLoraLinkTest({
        linkCheck: true,
        sendUplink: true,
        fport: 199,
      });
      campaignMessage.value = measurementMessage;
      return { previousLinkCheckTimestamp, previousRxSequence, previousTxSequence };
    } catch (error: unknown) {
      if (!(error instanceof LoraLinkTestRejectedError) || error.reason !== 'busy') throw error;
      busyAttempts += 1;
      if (Date.now() + LINK_TEST_BUSY_RETRY_DELAY_MS > deadline) throw error;
      campaignMessage.value = localize('@toolsCampaignBusyRetry')
        .replace('{attempt}', String(busyAttempts));
      if (developerModeEnabled.value) {
        pushDebugLog(`[LORA] LinkTest busy; automatic retry #${busyAttempts} in ${LINK_TEST_BUSY_RETRY_DELAY_MS} ms`);
      }
      await delay(LINK_TEST_BUSY_RETRY_DELAY_MS);
    }
  }
  throw new Error(localize('@toolsCampaignCancelled'));
}

function clearDeviceInformation(): void {
  deviceInformationDeviceId = undefined;
  deviceStatus.value = {
    ...deviceStatus.value,
    firmwareVersion: null,
    manufacturer: null,
    pcbVersion: null,
  };
}

async function refreshDeviceInformation(): Promise<void> {
  const deviceId = ble.connectedDevice.value?.deviceId;
  if (
    !ble.connected.value
    || !deviceId
    || deviceStatus.value.osaAuthenticated !== true
    || deviceInformationLoading.value
  ) return;

  deviceInformationLoading.value = true;
  clearDeviceInformation();
  try {
    const deviceInformation = await readDeviceInformation(deviceId, line => console.debug(line));
    deviceStatus.value = { ...deviceStatus.value, ...deviceInformation };
    deviceInformationDeviceId = deviceId;
  } catch (error: any) {
    console.error('Failed to read device information', error);
  } finally {
    deviceInformationLoading.value = false;
  }
}

async function refreshDeviceStatus(includeDeviceInformation = true): Promise<void> {
  const deviceId = ble.connectedDevice.value?.deviceId;
  if (!ble.connected.value || !deviceId || deviceStatusLoading.value) return;
  deviceStatusLoading.value = true;
  try {
    const adminStatus = await readAdminDeviceStatus(deviceId, line => console.debug(line));
    deviceStatus.value = { ...deviceStatus.value, ...adminStatus };
    ble.setOsaAuthenticated(adminStatus.osaAuthenticated);
    if (adminStatus.osaAuthenticated !== true) clearDeviceInformation();
  } catch (error: any) {
    console.error('Failed to read administration status', error);
  } finally {
    deviceStatusLoading.value = false;
  }
  if (includeDeviceInformation) await refreshDeviceInformation();
}

function receiveAppFrame(frame: Uint8Array): void {
  if (!awaitingManualResponse.value) return;
  const response = toSpacedHex(frame).toUpperCase();
  lastCommandResponse.value = lastCommandResponse.value
    ? `${lastCommandResponse.value}\n${response}`
    : response;
  resetAppRxResponseTimer(APP_RX_IDLE_TIMEOUT_MS);
}

function finishManualResponseCollection(): void {
  if (appRxResponseTimer !== undefined) {
    clearTimeout(appRxResponseTimer);
    appRxResponseTimer = undefined;
  }
  awaitingManualResponse.value = false;
  const resolve = resolveAppRxResponses;
  resolveAppRxResponses = undefined;
  resolve?.();
}

function resetAppRxResponseTimer(timeout: number): void {
  if (appRxResponseTimer !== undefined) clearTimeout(appRxResponseTimer);
  appRxResponseTimer = setTimeout(finishManualResponseCollection, timeout);
}

function prepareManualResponseCollection(): Promise<void> {
  awaitingManualResponse.value = true;
  return new Promise(resolve => {
    resolveAppRxResponses = resolve;
  });
}

function startFirstAppRxResponseTimeout(): void {
  if (!awaitingManualResponse.value || lastCommandResponse.value) return;
  resetAppRxResponseTimer(APP_RX_FIRST_RESPONSE_TIMEOUT_MS);
}

function logAppFrame(line: string): void {
  console.debug(line);
  if (developerModeEnabled.value) pushDebugLog(line);
}

async function runManualOsaChallenge(): Promise<void> {
  feedbackContext.value = 'commands';
  if (await authenticateWithDebugCredentials(true)) await refreshDeviceInformation();
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
    const authenticated = await runStoredOsaChallengeFe20();
    await refreshDeviceStatusAfterChallenge();
    if (authenticated && deviceStatus.value.osaAuthenticated === true) {
      await refreshDeviceInformation();
    }
  } finally {
    osaAuthenticating.value = false;
  }
}

async function refreshDeviceStatusAfterChallenge(): Promise<void> {
  while (deviceStatusLoading.value) await delay(50);
  await refreshDeviceStatus(false);
}

async function authenticateForDeviceInformation(): Promise<void> {
  feedbackContext.value = 'commands';
  if (await authenticateWithDebugCredentials(true)) await refreshDeviceInformation();
}

async function sendManualFrame(): Promise<void> {
  const deviceId = ble.connectedDevice.value?.deviceId;
  const frame = manualFrame.value;
  if (!canSendManualFrame.value || !deviceId || !frame) return;
  feedbackContext.value = 'manual-frame';
  const authenticationWasRequired = deviceStatus.value.osaAuthenticated !== true;
  if (!await authenticateWithDebugCredentials()) return;

  manualFrameSending.value = true;
  lastCommandResponse.value = '';
  feedback.value = localize('@toolsFrameWaitingResponse');
  feedbackError.value = false;
  try {
    appRxSubscription = await startAppRxMonitoring(deviceId, receiveAppFrame, logAppFrame);
    if (!appRxSubscription.notifications) {
      throw new Error(localize('@toolsFrameNotificationsUnavailable'));
    }
    const responsesComplete = prepareManualResponseCollection();
    await writeAppTx(deviceId, frame, logAppFrame);
    startFirstAppRxResponseTimeout();
    await responsesComplete;
    feedback.value = lastCommandResponse.value
      ? localize('@toolsFrameResponseReceived')
      : localize('@toolsFrameNoResponse');
  } catch (error: any) {
    feedbackError.value = true;
    feedback.value = error?.message ?? String(error);
  } finally {
    finishManualResponseCollection();
    await stopAppRxMonitoring(appRxSubscription, logAppFrame);
    appRxSubscription = undefined;
    manualFrameSending.value = false;
    if (authenticationWasRequired) await refreshDeviceInformation();
  }
}

async function sendPresetFrame(
  kind: 'rejoin' | 'factory-reset',
  frame: Uint8Array,
): Promise<void> {
  const deviceId = ble.connectedDevice.value?.deviceId;
  if (!canSendCommand.value || !deviceId) return;
  feedbackContext.value = 'commands';
  const authenticationWasRequired = deviceStatus.value.osaAuthenticated !== true;
  if (!await authenticateWithDebugCredentials()) return;

  commandSending.value = kind;
  feedback.value = '';
  feedbackError.value = false;
  try {
    await writeAppTx(
      deviceId,
      frame,
      line => console.debug(line),
      kind === 'factory-reset'
        ? { expectedWriteError: isExpectedRestartDisconnect }
        : undefined,
    );
    feedback.value = localize('@toolsCommandSent');
    if (kind === 'factory-reset') {
      await ble.reconnectAfterDeviceRestart(deviceId);
    }
  } catch (error: any) {
    feedbackError.value = true;
    feedback.value = error?.message ?? String(error);
  } finally {
    commandSending.value = null;
    if (authenticationWasRequired) await refreshDeviceInformation();
  }
}

async function sendRejoin(): Promise<void> {
  if (!rejoinFrame.value) return;
  await sendPresetFrame('rejoin', rejoinFrame.value);
}

async function sendFactoryReset(): Promise<void> {
  await sendPresetFrame('factory-reset', FACTORY_RESET_FRAME);
}

async function sendSensorReboot(): Promise<void> {
  const deviceId = ble.connectedDevice.value?.deviceId;
  if (!canSendCommand.value || !deviceId) return;
  feedbackContext.value = 'commands';
  const authenticationWasRequired = deviceStatus.value.osaAuthenticated !== true;
  if (!await authenticateWithDebugCredentials()) return;

  commandSending.value = 'reboot';
  feedback.value = '';
  feedbackError.value = false;
  try {
    await rebootDevice(deviceId, line => console.debug(line));
    feedback.value = localize('@toolsRebootSent');
    await ble.reconnectAfterDeviceRestart(deviceId);
  } catch (error: any) {
    feedbackError.value = true;
    feedback.value = error?.message ?? String(error);
  } finally {
    commandSending.value = null;
    if (authenticationWasRequired) await refreshDeviceInformation();
  }
}

async function startCampaign() {
  if (!canRunTests.value || campaignRunning.value) return;
  feedbackContext.value = 'network-test';
  const authenticationWasRequired = deviceStatus.value.osaAuthenticated !== true;
  if (!await authenticateWithDebugCredentials()) return;
  campaignCancelled = false;
  campaignRunning.value = true;
  beginCampaign();
  feedback.value = '';
  feedbackError.value = false;

  try {
    for (let index = 0; index < CAMPAIGN_SIZE; index += 1) {
      if (campaignCancelled) break;
      const measurementMessage = localize('@toolsCampaignMeasurement')
        .replace('{current}', String(index + 1))
        .replace('{total}', String(CAMPAIGN_SIZE));
      campaignMessage.value = measurementMessage;
      const {
        previousLinkCheckTimestamp,
        previousRxSequence,
        previousTxSequence,
      } = await sendCampaignLinkTest(measurementMessage);
      const response = await waitForFreshLinkCheck(
        previousLinkCheckTimestamp,
        previousRxSequence,
        previousTxSequence,
        index + 1,
      );
      const { linkCheck, rx: freshRx, tx: freshTx } = response;
      campaignSamples.value = [...campaignSamples.value, {
        timestamp: linkCheck.timestamp,
        marginDb: linkCheck.marginDb,
        gatewayCount: linkCheck.gatewayCount,
        rssiDbm: freshRx?.rssiDbm ?? null,
        snrDb: freshRx?.snrDb ?? null,
        txDataRate: freshTx?.dataRate ?? null,
        txPowerDbm: freshTx?.powerDbm ?? null,
        txFrequencyHz: freshTx?.frequencyHz ?? null,
        rxDataRate: freshRx?.dataRate ?? null,
        rxWindow: freshRx?.window ?? null,
      }];
      if (index < CAMPAIGN_SIZE - 1) await delay(INTER_TEST_DELAY_MS);
    }
    campaignMessage.value = campaignCancelled
      ? localize('@toolsCampaignCancelled')
      : localize('@toolsCampaignComplete');
  } catch (error: any) {
    if (campaignCancelled) {
      campaignMessage.value = localize('@toolsCampaignCancelled');
    } else {
      feedbackError.value = true;
      feedback.value = error instanceof LoraLinkTestRejectedError
        ? formatLinkTestRejection(error)
        : error?.message ?? String(error);
      campaignMessage.value = localize('@toolsCampaignStopped');
    }
  } finally {
    campaignRunning.value = false;
    if (authenticationWasRequired) await refreshDeviceInformation();
  }
}

function cancelCampaign() {
  campaignCancelled = true;
}

function simulateCampaign() {
  const now = Date.now();
  const simulatedValues = [
    { marginDb: 12, gatewayCount: 2, rssiDbm: -98, snrDb: 5.5, txDataRate: 3, txPowerDbm: 14, txFrequencyHz: 868100000, rxDataRate: 3, rxWindow: 0 },
    { marginDb: 9, gatewayCount: 1, rssiDbm: -105, snrDb: 2.1, txDataRate: 2, txPowerDbm: 14, txFrequencyHz: 868300000, rxDataRate: 2, rxWindow: 1 },
    { marginDb: 15, gatewayCount: 3, rssiDbm: -92, snrDb: 7.8, txDataRate: 4, txPowerDbm: 12, txFrequencyHz: 868500000, rxDataRate: 4, rxWindow: 0 },
    { marginDb: 7, gatewayCount: 1, rssiDbm: -110, snrDb: -1.3, txDataRate: 1, txPowerDbm: 14, txFrequencyHz: 867100000, rxDataRate: 1, rxWindow: 1 },
    { marginDb: 11, gatewayCount: 2, rssiDbm: -101, snrDb: 3.9, txDataRate: 3, txPowerDbm: 14, txFrequencyHz: 867300000, rxDataRate: 3, rxWindow: 0 },
  ];

  beginCampaign(now);
  campaignSamples.value = simulatedValues.map((sample, index) => ({
    timestamp: now - (CAMPAIGN_SIZE - 1 - index) * INTER_TEST_DELAY_MS,
    ...sample,
  }));
  campaignMessage.value = localize('@toolsCampaignSimulated');
  feedback.value = '';
  feedbackError.value = false;
  feedbackContext.value = 'network-test';
}

onIonViewDidEnter(() => {
  playSensorPageTransition('tools', '.sensor-tools-content');
  if (deviceInformationDeviceId !== ble.connectedDevice.value?.deviceId) clearDeviceInformation();
  void refreshDeviceStatus(false);
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
  stopDeleteRepeat();
  cancelCampaign();
  finishManualResponseCollection();
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

.tools-container > section + section {
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

.status-grid { display: grid; }

.status-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 18px;
  padding: 11px 0;
  border-bottom: 1px solid var(--app-border);
}

.status-item:first-child { padding-top: 0; }
.status-item:last-child { padding-bottom: 0; border-bottom: 0; }

.status-item span,
.field-label {
  color: var(--app-text-muted);
  font-size: 0.74rem;
  font-weight: 600;
}

.status-item strong {
  min-width: 0;
  color: var(--app-text);
  font-size: 1rem;
  text-align: right;
  overflow-wrap: anywhere;
}

.status-item--firmware strong,
.status-item--sensor-time strong { font-size: 0.78rem; font-weight: 600; }

.status-item .value-ok { color: var(--ion-color-success); }
.status-item .value-auth-required {
  color: var(--ion-color-warning-shade);
  font-size: 0.78rem;
  font-weight: 600;
}
.status-item .value-not-provided {
  color: var(--app-text-muted);
  font-size: 0.78rem;
  font-weight: 600;
}
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

.campaign-debug {
  margin-top: 12px;
  border: 1px dashed var(--app-border-strong);
  border-radius: 12px;
  background: var(--app-surface);
}

.campaign-debug > summary {
  padding: 12px;
  color: var(--app-text);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.campaign-debug__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px 8px;
}

.campaign-debug__header p,
.campaign-debug__empty {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 0.76rem;
}

.campaign-debug__entries {
  max-height: 420px;
  overflow: auto;
  padding: 0 12px 12px;
  overscroll-behavior: contain;
}

.campaign-debug__entries pre {
  min-width: max-content;
  margin: 0 0 8px;
  padding: 9px;
  border-left: 3px solid var(--app-border-strong);
  border-radius: 6px;
  background: var(--app-surface-subtle);
  color: var(--app-text);
  font: 0.7rem/1.45 monospace;
  white-space: pre;
}

.campaign-debug__entries .campaign-debug__entry--accepted {
  border-left-color: var(--ion-color-success);
}

.campaign-debug__entries .campaign-debug__entry--rejected {
  border-left-color: var(--ion-color-danger);
}

.chart-grid {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.campaign-selector {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 1px 4px;
}

.campaign-selector__button {
  display: inline-flex;
  min-height: 36px;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  padding: 7px 11px;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  background: var(--app-surface);
  color: var(--app-text-muted);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 650;
  cursor: pointer;
}

.campaign-selector__button--selected {
  border-color: var(--app-border-strong);
  box-shadow: var(--app-card-shadow);
  color: var(--app-text);
}

.campaign-selector__dot {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.campaign-comparison {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-surface);
}

.campaign-comparison h3,
.campaign-details-header h3 {
  margin: 0;
  color: var(--app-text);
  font-size: 0.9rem;
}

.campaign-comparison h3 { padding: 12px 12px 8px; }

.campaign-comparison__scroll {
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  touch-action: pan-x;
}

.campaign-comparison table {
  width: 100%;
  min-width: 570px;
  border-collapse: collapse;
  color: var(--app-text);
  font-size: 0.76rem;
  white-space: nowrap;
}

.campaign-comparison th,
.campaign-comparison td {
  padding: 9px 10px;
  border-top: 1px solid var(--app-border);
  text-align: right;
}

.campaign-comparison th:first-child { text-align: left; }

.campaign-comparison thead th {
  color: var(--app-text-muted);
  font-weight: 650;
}

.campaign-comparison tbody tr { cursor: pointer; }

.campaign-comparison__selected { background: var(--app-surface-muted, rgba(127, 127, 127, 0.08)); }

.campaign-comparison tbody button {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.campaign-comparison > p {
  margin: 0;
  padding: 8px 12px 10px;
  border-top: 1px solid var(--app-border);
  color: var(--app-text-faint);
  font-size: 0.7rem;
}

.campaign-details-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 2px 0;
}

.campaign-details-header p {
  margin: 3px 0 0;
  color: var(--app-text-muted);
  font-size: 0.72rem;
}

.campaign-details-header > strong {
  color: var(--app-text);
  font-size: 0.85rem;
}

.campaign-results {
  display: grid;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-border);
}

.campaign-result {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  color: var(--app-text-muted);
  background: var(--app-surface);
  font-size: 0.8rem;
}

.campaign-result__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.campaign-result__header strong { color: var(--app-text); }

.campaign-directions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.campaign-direction { min-width: 0; }

.campaign-direction + .campaign-direction {
  padding-left: 14px;
  border-left: 1px solid var(--app-border);
}

.campaign-direction h4 {
  margin: 0 0 5px;
  color: var(--app-text);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.campaign-direction dl {
  display: grid;
  gap: 4px;
  margin: 0;
}

.campaign-direction dl > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 4px;
}

.campaign-direction dt,
.campaign-direction dd { margin: 0; }

.campaign-direction dd {
  color: var(--app-text);
  font-weight: 650;
  text-align: right;
  white-space: nowrap;
}

.status-actions {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  margin: 10px 0 -8px;
}

.status-refresh-button { margin-left: auto; }

.field-label {
  display: block;
  margin: 12px 0 6px;
}

.field-label:first-child { margin-top: 0; }

.field-hint {
  margin: 5px 0 10px;
  color: var(--app-text-muted);
  font-size: 0.72rem;
}

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
.hex-keypad {
  display: grid;
  gap: 2px;
  margin-top: 8px;
}
.hex-keypad__keys {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.hex-keypad__key {
  min-height: 42px;
  border: 1px solid var(--app-border-strong);
  border-radius: 8px;
  color: var(--app-text);
  background: var(--app-card-background, var(--ion-card-background, #fff));
  font: 650 1rem/1 monospace;
  touch-action: manipulation;
}
.hex-keypad__key:active { background: var(--app-page-background); }
.hex-keypad__key:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 1px;
}
.hex-keypad__key--wide {
  grid-column: span 2;
  font-family: inherit;
  font-size: 0.82rem;
}
.hex-keypad__mode {
  justify-self: stretch;
  margin: 0;
}
.command-duration { font-variant-numeric: tabular-nums; }
.command-list { display: grid; gap: 8px; }
.rejoin-command {
  display: grid;
  gap: 10px;
}
.split-command {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 46px;
  overflow: hidden;
  border-radius: 4px;
  box-shadow: 0 3px 5px -1px rgb(0 0 0 / 20%), 0 6px 10px 0 rgb(0 0 0 / 14%);
}
.split-command ion-button { --box-shadow: none; }
.split-command__action { --border-radius: 4px 0 0 4px; }
.split-command__toggle {
  --border-radius: 0 4px 4px 0;
  --padding-start: 0;
  --padding-end: 0;
  margin-left: 1px !important;
}
.split-command__toggle ion-icon { transition: transform 160ms ease; }
.split-command__chevron--open { transform: rotate(180deg); }
.rejoin-options {
  display: grid;
  gap: 6px;
  padding: 2px 0 8px;
}
.rejoin-options .field-label { margin: 0; }
.rejoin-options .field-hint { margin: -1px 0 2px; }
.command-list ion-button { margin: 0; }
.toggle-row { margin: 14px 0; }
.validation-error { margin: 8px 0 0; font-size: 0.76rem; }
.feedback { margin: 18px 4px 0; text-align: center; }
.feedback--error { color: var(--ion-color-danger); }
</style>
