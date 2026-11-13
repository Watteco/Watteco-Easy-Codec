<template>
  <ion-page>
    <ion-header class="bbs-header-shell">
      <header class="bbs-header">
        <img class="bbs-header__logo" :src="logoSrc" alt="Watteco" />
        <div class="bbs-header__identity">
          <span>{{ localize('@startupRecoveryTitle') }}</span>
          <strong>{{ cachedDevEui }}</strong>
        </div>
        <span
          class="bbs-header__status"
          :class="{
            'bbs-header__status--loading': loading,
            'bbs-header__status--closed': sessionClosed,
          }"
          role="status"
        >
          <ion-spinner v-if="loading" name="crescent" />
          <span v-else aria-hidden="true"></span>
          {{ localize(loading ? '@bbsReadingShort' : sessionClosed ? '@bbsSessionEnded' : '@bbsConnected') }}
        </span>
      </header>
    </ion-header>

    <ion-content :fullscreen="true" class="bbs-content">
      <main class="bbs-shell">
        <div v-if="errorMessage" class="bbs-alert bbs-alert--error" role="alert">
          <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
          <span>{{ errorMessage }}</span>
        </div>

        <div v-if="commandSucceeded" class="bbs-alert bbs-alert--success" role="status">
          <ion-icon :icon="checkmarkCircleOutline" aria-hidden="true" />
          <span>{{ localize(commandSucceededMessageKey) }}</span>
        </div>

        <div
          v-if="sessionClosed && !commandSucceeded"
          class="bbs-alert bbs-alert--warning"
          role="status"
        >
          <ion-icon :icon="warningOutline" aria-hidden="true" />
          <span>
            <strong>{{ localize('@bbsConnectionClosed') }}</strong><br />
            {{ localize('@bbsConnectionClosedHint') }}
          </span>
        </div>

        <template v-if="status">
          <section v-if="returnToServiceTarget && !commandSucceeded" class="bbs-card bbs-return-service bbs-return-service--primary">
            <div class="bbs-card__header">
              <div>
                <h2>{{ localize(alreadyInService ? '@bbsAlreadyInServiceTitle' : '@bbsReturnToServiceTitle') }}</h2>
              </div>
              <ion-icon :icon="alreadyInService ? checkmarkCircleOutline : refreshOutline" aria-hidden="true" />
            </div>

            <div class="bbs-return-service__body">
              <div v-if="alreadyInService" class="bbs-already-service">
                <ion-icon :icon="checkmarkCircleOutline" aria-hidden="true" />
                <span>{{ localize('@bbsAlreadyInServiceMessage') }}</span>
              </div>

              <h3 class="bbs-current-state-title">{{ localize('@bbsCurrentStateTitle') }}</h3>

              <dl class="bbs-return-summary">
                <div>
                  <dt>{{ localize('@bbsOperatingMode') }}</dt>
                  <dd>{{ operatingModeLabel }}</dd>
                </div>
                <div>
                  <dt>{{ localize('@bbsCurrentStartupState') }}</dt>
                  <dd>{{ currentStorageModeLabel }}</dd>
                </div>
              </dl>

              <button
                type="button"
                class="bbs-options-toggle"
                :aria-expanded="returnOptionsVisible"
                aria-controls="bbs-return-options"
                @click="returnOptionsVisible = !returnOptionsVisible"
              >
                <ion-icon :icon="optionsOutline" aria-hidden="true" />
                {{ localize(returnOptionsVisible ? '@bbsHideRestartOptions' : '@bbsEditRestartOptions') }}
                <ion-icon :icon="returnOptionsVisible ? chevronUpOutline : chevronDownOutline" aria-hidden="true" />
              </button>

              <div v-if="returnOptionsVisible" id="bbs-return-options" class="bbs-return-options">
                <fieldset :disabled="applying || sessionClosed || !canSelectTarget(returnToServiceTarget)">
                  <legend>{{ localize('@bbsAfterRestart') }}</legend>
                  <div class="bbs-storage-control">
                    <span>{{ localize('@bbsCurrentStartupState') }}</span>
                    <div class="bbs-binary-selector" role="radiogroup" :aria-label="localize('@bbsCurrentStartupState')">
                      <button
                        type="button"
                        role="radio"
                        :aria-checked="!returnStartBlocked"
                        :class="{ 'bbs-binary-selector__option--selected': !returnStartBlocked }"
                        @click="returnStartBlocked = false"
                      >
                        {{ localize('@bbsNo') }}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        :aria-checked="returnStartBlocked"
                        :class="{ 'bbs-binary-selector__option--selected': returnStartBlocked }"
                        @click="returnStartBlocked = true"
                      >
                        {{ localize('@bbsYes') }}
                      </button>
                    </div>
                  </div>
                  <div class="bbs-storage-control">
                    <span>{{ localize('@bbsFactoryReset') }}</span>
                    <div class="bbs-binary-selector" role="radiogroup" :aria-label="localize('@bbsFactoryReset')">
                      <button
                        type="button"
                        role="radio"
                        :aria-checked="!factoryResetRequested"
                        :class="{ 'bbs-binary-selector__option--selected': !factoryResetRequested }"
                        @click="factoryResetRequested = false"
                      >
                        {{ localize('@bbsNo') }}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        :aria-checked="factoryResetRequested"
                        :class="{ 'bbs-binary-selector__option--selected': factoryResetRequested }"
                        @click="factoryResetRequested = true"
                      >
                        {{ localize('@bbsYes') }}
                      </button>
                    </div>
                  </div>
                </fieldset>

                <ion-button
                  v-if="alreadyInService"
                  expand="block"
                  color="warning"
                  :disabled="!canExecuteReturnToService"
                  @click="selectAndExecuteReturnToService"
                >
                  <ion-spinner v-if="applying && selectedTarget === 0x0b" slot="start" name="crescent" />
                  {{ returnServiceButtonLabel }}
                </ion-button>
              </div>

              <ion-button
                v-if="!alreadyInService"
                expand="block"
                color="warning"
                :disabled="!canExecuteReturnToService"
                @click="selectAndExecuteReturnToService"
              >
                <ion-spinner v-if="applying && selectedTarget === 0x0b" slot="start" name="crescent" />
                {{ returnServiceButtonLabel }}
              </ion-button>

            </div>
          </section>

          <button
            v-if="!commandSucceeded"
            type="button"
            class="bbs-advanced-toggle"
            :class="{ 'bbs-advanced-toggle--open': advancedVisible }"
            :aria-expanded="advancedVisible"
            aria-controls="bbs-advanced-content"
            @click="toggleAdvanced"
          >
            <span>
              <ion-icon :icon="optionsOutline" aria-hidden="true" />
              {{ localize('@bbsAdvancedStatesAndTools') }}
            </span>
            <ion-icon :icon="advancedVisible ? chevronUpOutline : chevronDownOutline" aria-hidden="true" />
          </button>

          <template v-if="advancedVisible && !commandSucceeded">
          <section
            id="bbs-advanced-content"
            ref="advancedSection"
            class="bbs-card bbs-overview bbs-overview--advanced"
          >
            <div class="bbs-card__header">
              <div>
                <h2>{{ localize('@bbsNextBootTitle') }}</h2>
              </div>
            </div>

            <div class="bbs-stored-states">
              <dl>
                <div>
                  <dt>{{ localize('@bbsProductionState') }}</dt>
                  <dd>{{ productionStateLabel }}</dd>
                </div>
                <div>
                  <dt>{{ localize('@bbsRadioState') }}</dt>
                  <dd>{{ radioStateLabel }}</dd>
                </div>
                <div>
                  <dt>{{ localize('@bbsCurrentStartupState') }}</dt>
                  <dd>{{ currentStorageModeLabel }}</dd>
                </div>
              </dl>
            </div>

            <button
              v-if="hasEditableTargets"
              type="button"
              class="bbs-editor-toggle"
              :class="{ 'bbs-editor-toggle--open': editing }"
              :disabled="applying || sessionClosed"
              aria-controls="bbs-state-editor"
              :aria-expanded="editing"
              @click="toggleEditor"
            >
              <span>
                <ion-icon :icon="optionsOutline" aria-hidden="true" />
                {{ localize('@bbsTargetsTitle') }}
              </span>
              <ion-icon :icon="editing ? chevronUpOutline : chevronDownOutline" aria-hidden="true" />
            </button>

            <div
              v-if="editing && hasEditableTargets"
              id="bbs-state-editor"
              ref="editorSection"
              class="bbs-editor-content"
            >
              <div class="bbs-target-groups">
                <section v-for="group in targetGroups" :key="group.key" class="bbs-target-group">
                  <h3>{{ localize(group.labelKey) }}</h3>
                  <div class="bbs-target-options">
                    <button
                      v-for="target in group.targets"
                      :key="target.id"
                      type="button"
                      class="bbs-target"
                      :class="{ 'bbs-target--selected': selectedTarget === target.id, 'bbs-target--flagged': hasCurrentFlag(target) }"
                      :disabled="!canSelectTarget(target) || applying || sessionClosed"
                      :aria-pressed="selectedTarget === target.id"
                      @click="selectedTarget = target.id"
                    >
                      <span class="bbs-target__radio" aria-hidden="true"></span>
                      <span class="bbs-target__copy">
                        <strong>{{ targetLabel(target) }}</strong>
                        <small>{{ targetDescription(target) }}</small>
                        <span v-if="hasCurrentFlag(target)" class="bbs-target__current">
                          {{ localize('@bbsTargetCurrentFlag') }}
                        </span>
                      </span>
                      <span class="bbs-target__indicator" aria-hidden="true">
                        <ion-icon
                          v-if="selectedTarget === target.id || !canSelectTarget(target)"
                          :icon="selectedTarget === target.id ? checkmarkCircleOutline : lockClosedOutline"
                        />
                      </span>
                    </button>
                  </div>
                </section>

                <div v-if="selectedTargetWarningKey" class="bbs-alert bbs-alert--warning">
                  <ion-icon :icon="warningOutline" aria-hidden="true" />
                  {{ localize(selectedTargetWarningKey) }}
                </div>
              </div>

              <ion-button expand="block" class="bbs-apply" :disabled="!canExecute" @click="confirmAndExecute">
                <ion-spinner v-if="applying" slot="start" name="crescent" />
                {{ applyButtonLabel }}
              </ion-button>
            </div>
          </section>

          <section class="bbs-card bbs-technical-card">
            <button class="bbs-technical-toggle" type="button" @click="technicalDetailsVisible = !technicalDetailsVisible">
              <ion-icon :icon="informationCircleOutline" aria-hidden="true" />
              {{ localize(technicalDetailsVisible ? '@bbsHideTechnicalDetails' : '@bbsTechnicalDetails') }}
              <ion-icon :icon="technicalDetailsVisible ? chevronUpOutline : chevronDownOutline" aria-hidden="true" />
            </button>

            <div v-if="technicalDetailsVisible" class="bbs-technical">
              <div
                class="bbs-blocking"
                :class="{ 'bbs-blocking--clear': blockingReasons.length === 0 }"
              >
                <strong>{{ localize(blockingReasons.length ? '@bbsBlockingState' : '@bbsNoBlockingState') }}</strong>
                <ul v-if="blockingReasons.length">
                  <li v-for="reason in blockingReasons" :key="reason">{{ localize(reason) }}</li>
                </ul>
              </div>

              <dl class="bbs-details">
                <div><dt>{{ localize('@bbsProtocolVersion') }}</dt><dd>{{ hex(status.version) }}</dd></div>
                <div><dt>{{ localize('@bbsPhase') }}</dt><dd>{{ hex(status.phase) }}</dd></div>
                <div><dt>{{ localize('@bbsAutotestLog') }}</dt><dd>{{ hex(status.autotestLog) }}</dd></div>
                <div><dt>{{ localize('@bbsLastAutotestStep') }}</dt><dd>{{ status.autotestLastNum }}</dd></div>
                <div><dt>{{ localize('@bbsCemState') }}</dt><dd>{{ hex(status.cemState) }}</dd></div>
                <div><dt>{{ localize('@bbsBlockedStarting') }}</dt><dd>{{ yesNo(status.blockedStarting) }}</dd></div>
                <div>
                  <dt>{{ localize('@bbsMinUptimeExpired') }}</dt>
                  <dd>{{ localize(status.minUptimeExpired ? '@bbsRestartDelayElapsed' : '@bbsRestartDelayActive') }}</dd>
                </div>
                <div><dt>{{ localize('@bbsSupportedTargets') }}</dt><dd>{{ hexWord(status.supportedTargets) }}</dd></div>
                <div><dt>{{ localize('@bbsAuthorizationMask') }}</dt><dd>{{ hex(status.authorizationMask) }}</dd></div>
              </dl>
            </div>
          </section>
          </template>

          <ion-button
            v-if="!commandSucceeded && !sessionClosed"
            expand="block"
            fill="outline"
            color="medium"
            :disabled="applying"
            @click="disconnect"
          >
            {{ localize('@bbsLeaveUnchanged') }}
          </ion-button>
        </template>

        <ion-button
          v-if="!status || commandSucceeded || sessionClosed"
          expand="block"
          fill="outline"
          color="medium"
          :disabled="applying || (commandSucceeded && !sessionClosed)"
          @click="disconnect"
        >
          {{ localize(sessionClosed ? '@bbsReturnToScan' : '@bleSpecialModeDisconnect') }}
        </ion-button>
      </main>
    </ion-content>

    <div v-if="developerModeEnabled" class="bbs-debug-stack">
      <section v-show="debugVisible" class="bbs-debug-panel" aria-label="BBS debug logs">
        <header class="bbs-debug-header">
          <strong>BBS debug</strong>
          <button type="button" @click="debugLogs = []">Clear</button>
        </header>
        <div class="bbs-debug-lines">
          <code v-for="(line, index) in debugLogs" :key="`${index}:${line}`">{{ line }}</code>
          <span v-if="debugLogs.length === 0" class="bbs-debug-empty">No events</span>
        </div>
      </section>
      <button
        type="button"
        class="bbs-debug-toggle"
        :aria-expanded="debugVisible"
        @click="debugVisible = !debugVisible"
      >
        {{ debugVisible ? '×' : 'DEV' }}
      </button>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  alertController,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/vue';
import {
  alertCircleOutline,
  chevronDownOutline,
  chevronUpOutline,
  checkmarkCircleOutline,
  informationCircleOutline,
  lockClosedOutline,
  optionsOutline,
  refreshOutline,
  warningOutline,
} from 'ionicons/icons';
import { useBle } from '@/composables/useBle';
import { useBleDebugCredentials } from '@/composables/useBleDebugCredentials';
import { useDeveloperMode } from '@/composables/useDeveloperMode';
import {
  KMS_ACCESS_ENFORCEMENT_ENABLED,
} from '@/composables/useKmsAccess';
import { useLanguage } from '@/composables/useLanguage';
import { OsaKeyStore, type StoredOsaKey } from '@/plugins/osaKeyStore';
import {
  BBS_FLAG_FACTORY_RESET,
  BBS_FLAG_START_BLOCKED,
  BBS_RESULT_KEYS,
  getSupportedBbsTargets,
  isBbsTargetAuthorized,
  openBbsSession,
  type BbsSession,
  type BbsStatus,
  type BbsTarget,
} from '@/utils/BLE/bbsProtocol';
import { createBundledTranslations } from '@/utils/localization';

const BLOCKING_REASON_KEYS = [
  '@bbsBlockAutotest',
  '@bbsBlockFinalAutotest',
  '@bbsBlockCem',
  '@bbsBlockCemPermanent',
  '@bbsBlockStarting',
  '@bbsBlockMinUptime',
  '@bbsBlockInconsistent',
] as const;

const BBS_TARGET_BLOCKING_BITS: Partial<Record<BbsTarget['key'], number>> = {
  autotest: 0,
  finalAutotest: 1,
  cemOnce: 2,
  cemPermanent: 3,
};

const BBS_TARGET_GROUPS = [
  { key: 'production', labelKey: '@bbsProductionState', targetKeys: ['autotest', 'finalAutotest', 'normal'] },
  { key: 'radio', labelKey: '@bbsRadioState', targetKeys: ['stopCem', 'cemOnce', 'cemPermanent', 'continuousFsk', 'continuousLora', 'burstLora'] },
] as const;

type BbsTargetGroup = {
  key: typeof BBS_TARGET_GROUPS[number]['key'];
  labelKey: string;
  targets: BbsTarget[];
};

const router = useRouter();
const route = useRoute();
const ble = useBle();
const { developerModeEnabled } = useDeveloperMode();
const { debugOtaAppKeyHex } = useBleDebugCredentials();
const { currentLanguage } = useLanguage();
const languages = createBundledTranslations();
const logoSrc = `${import.meta.env.BASE_URL}img/icon.png`;

const status = ref<BbsStatus | null>(null);
const session = ref<BbsSession | null>(null);
const credential = ref<StoredOsaKey | null>(null);
const selectedTarget = ref<number | null>(null);
const factoryResetRequested = ref(false);
const returnStartBlocked = ref(false);
const returnOptionsInitialized = ref(false);
const returnOptionsVisible = ref(false);
const advancedVisible = ref(false);
const loading = ref(true);
const applying = ref(false);
const errorMessage = ref('');
const commandSucceeded = ref(false);
const sessionClosed = ref(false);
const bbsConnectionObserved = ref(false);
const debugVisible = ref(false);
const editing = ref(false);
const technicalDetailsVisible = ref(false);
const editorSection = ref<HTMLElement | null>(null);
const advancedSection = ref<HTMLElement | null>(null);
const debugLogs = ref<string[]>([]);
const cachedDeviceName = ref('WS5F123456.BBS');
const cachedDevEui = ref('70B3D5E75F123456');
let automaticReturnTimer: ReturnType<typeof setTimeout> | undefined;

const localize = (key: string): string => {
  if (!key.startsWith('@')) return key;
  return languages[currentLanguage.value][key.substring(1)] ?? key;
};

const interpolate = (template: string, values: Record<string, string>): string => (
  Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  )
);

const debugPreviewEnabled = computed(() => (
  developerModeEnabled.value && route.query.preview === '1'
));
const supportedTargets = computed(() => (
  status.value ? getSupportedBbsTargets(status.value.supportedTargets) : []
));
const targetGroups = computed<BbsTargetGroup[]>(() => BBS_TARGET_GROUPS.flatMap(group => {
  const targets = supportedTargets.value.filter(target => (
    (group.targetKeys as readonly string[]).includes(target.key)
  ));
  return targets.length ? [{ ...group, targets }] : [];
}));
const returnToServiceTarget = computed(() => (
  supportedTargets.value.find(target => target.key === 'returnToService') ?? null
));
const returnToServiceOnlyAuthorization = computed(() => status.value?.authorizationMask === 0x08);
const hasEditableTargets = computed(() => (
  !returnToServiceOnlyAuthorization.value
  && targetGroups.value.some(group => group.targets.length > 0)
));
const blockingReasons = computed(() => {
  const mask = status.value?.blockingMask ?? 0;
  return BLOCKING_REASON_KEYS.filter((_key, bit) => (mask & (1 << bit)) !== 0);
});
const credentialAvailable = computed(() => credential.value !== null);
const selectedTargetDefinition = computed(() => (
  supportedTargets.value.find(target => target.id === selectedTarget.value)
));
const canExecute = computed(() => Boolean(
  session.value
  && credentialAvailable.value
  && selectedTargetDefinition.value
  && canSelectTarget(selectedTargetDefinition.value)
  && !applying.value
));
const canExecuteReturnToService = computed(() => Boolean(
  returnToServiceTarget.value
  && session.value
  && credentialAvailable.value
  && canSelectTarget(returnToServiceTarget.value)
  && !applying.value
));
const returnOptionsChanged = computed(() => (
  returnStartBlocked.value || factoryResetRequested.value
));
const returnServiceButtonLabel = computed(() => {
  if (applying.value) return localize('@bbsApplyingMode');
  return localize(returnOptionsChanged.value ? '@bbsApplyAndRestart' : '@bbsReturnToServiceAction');
});
const alreadyInService = computed(() => Boolean(
  status.value
  && status.value.autotestLog === 0
  && status.value.cemState === 0
  && status.value.blockedStarting === 0
));
const returnStartupLabel = computed(() => localize(
  returnStartBlocked.value ? '@bbsReturnStartupStorage' : '@bbsReturnStartupService',
));
const selectedTargetWarningKey = computed(() => {
  if (selectedTarget.value === 0) return '@bbsConfirmNormalWarning';
  if ([4, 5, 6, 7].includes(selectedTarget.value ?? -1)) return '@bbsPersistentModeWarning';
  return '';
});
const productionStateLabel = computed(() => {
  if (!status.value) return '';
  if (status.value.autotestLog === 0x14 || (status.value.blockingMask & 0x02)) {
    return localize('@bbsFinalAutotestRequestedState');
  }
  if (status.value.autotestLog !== 0 || (status.value.blockingMask & 0x01)) {
    return localize('@bbsAutotestRequestedState');
  }
  return localize('@bbsProductionValidatedState');
});
const radioStateLabel = computed(() => {
  const currentStatus = status.value;
  if (!currentStatus) return '';
  const explicitStates: Record<number, string> = {
    0x20: '@bbsRadioContinuousFskState',
    0x21: '@bbsRadioContinuousLoraState',
    0x22: '@bbsRadioBurstLoraState',
  };
  const explicit = explicitStates[currentStatus.cemState];
  if (explicit) return localize(explicit);
  if (currentStatus.blockingMask & 0x08) return localize('@bbsRadioCemPermanentState');
  if ((currentStatus.blockingMask & 0x04) || currentStatus.cemState !== 0) {
    return localize('@bbsRadioCemOnceState');
  }
  return localize('@bbsRadioNoneState');
});
const currentStorageModeLabel = computed(() => localize(
  status.value?.blockedStarting ? '@bbsYes' : '@bbsNo',
));
const operatingModeLabel = computed(() => {
  const currentStatus = status.value;
  if (!currentStatus) return '';
  const testModeActive = currentStatus.autotestLog !== 0
    || currentStatus.cemState !== 0
    || (currentStatus.blockingMask & 0x0f) !== 0;
  return localize(testModeActive ? '@bbsOperatingModeTest' : '@bbsOperatingModeNormal');
});
const applyButtonLabel = computed(() => {
  if (applying.value) return localize('@bbsApplyingMode');
  if (!selectedTargetDefinition.value) return localize('@bbsApplyMode');
  return interpolate(localize('@bbsApplySelectedMode'), {
    mode: targetLabel(selectedTargetDefinition.value),
  });
});
const commandSucceededMessageKey = computed(() => {
  if (selectedTarget.value === 0x0b) {
    return sessionClosed.value
      ? '@bbsReturnToServiceDisconnected'
      : '@bbsReturnToServiceAccepted';
  }
  return sessionClosed.value ? '@bbsCommandDisconnected' : '@bbsCommandAccepted';
});

function pushDebugLog(message: string) {
  const timestamp = new Date().toLocaleTimeString([], { hour12: false });
  debugLogs.value = [`${timestamp} ${message}`, ...debugLogs.value].slice(0, 200);
}

function hex(value: number): string {
  return `0x${value.toString(16).padStart(2, '0').toUpperCase()}`;
}

function hexWord(value: number): string {
  return `0x${value.toString(16).padStart(4, '0').toUpperCase()}`;
}

function yesNo(value: number): string {
  return localize(value ? '@bbsYes' : '@bbsNo');
}

function targetLabel(target: BbsTarget): string {
  return localize(`@bbsTarget${target.key[0].toUpperCase()}${target.key.slice(1)}`);
}

function targetDescription(target: BbsTarget): string {
  return localize(`@bbsTarget${target.key[0].toUpperCase()}${target.key.slice(1)}Description`);
}

function hasCurrentFlag(target: BbsTarget): boolean {
  const currentStatus = status.value;
  if (!currentStatus) return false;
  if (target.key === 'normal') {
    return currentStatus.autotestLog === 0 && (currentStatus.blockingMask & 0x03) === 0;
  }
  if (target.key === 'stopCem') {
    return currentStatus.cemState === 0 && (currentStatus.blockingMask & 0x0c) === 0;
  }
  if (target.key === 'continuousFsk') return currentStatus.cemState === 0x20;
  if (target.key === 'continuousLora') return currentStatus.cemState === 0x21;
  if (target.key === 'burstLora') return currentStatus.cemState === 0x22;
  if (target.key === 'cemOnce') {
    return ![0x20, 0x21, 0x22].includes(currentStatus.cemState)
      && Boolean(currentStatus.blockingMask & 0x04)
      && !(currentStatus.blockingMask & 0x08);
  }
  const bit = BBS_TARGET_BLOCKING_BITS[target.key];
  return bit !== undefined && Boolean(currentStatus.blockingMask & (1 << bit));
}

function canSelectTarget(target: BbsTarget): boolean {
  return Boolean(status.value && isBbsTargetAuthorized(target, status.value.authorizationMask));
}

async function toggleEditor() {
  editing.value = !editing.value;
  if (!editing.value) return;
  await nextTick();
  editorSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function toggleAdvanced() {
  advancedVisible.value = !advancedVisible.value;
  if (!advancedVisible.value) return;
  await nextTick();
  advancedSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setStatus(nextStatus: BbsStatus) {
  status.value = nextStatus;
  if (!returnOptionsInitialized.value) {
    // Returning to service defaults to normal application startup. Storage
    // must be selected explicitly as an advanced option.
    returnStartBlocked.value = false;
    returnOptionsInitialized.value = true;
  }
  if (selectedTarget.value !== null) {
    const selectionStillAvailable = getSupportedBbsTargets(nextStatus.supportedTargets)
      .some(target => target.id === selectedTarget.value && canSelectTarget(target));
    if (!selectionStillAvailable) selectedTarget.value = null;
  }
}

async function loadCredential() {
  if (debugPreviewEnabled.value) return;
  if (!KMS_ACCESS_ENFORCEMENT_ENABLED) {
    const debugKey = debugOtaAppKeyHex.value.replace(/[^0-9a-f]/gi, '').toUpperCase();
    if (/^[0-9A-F]{32}$/.test(debugKey)) {
      credential.value = {
        devEui: cachedDevEui.value,
        keyHex: debugKey,
        expiresAt: Number.MAX_SAFE_INTEGER,
      };
      pushDebugLog('[BBS] Temporary shared OSA key available; value hidden');
      return;
    }
  }

  try {
    credential.value = await OsaKeyStore.get({ devEui: cachedDevEui.value });
    pushDebugLog('[BBS] Secure OSA credential available; value hidden');
  } catch {
    credential.value = null;
    pushDebugLog('[BBS] No OSA credential available');
  }
}

async function initializeSession() {
  if (debugPreviewEnabled.value) {
    setStatus({
      version: 1,
      phase: 1,
      blockingMask: 0x15,
      autotestLog: 0,
      autotestLastNum: 3,
      cemState: 0,
      blockedStarting: 1,
      minUptimeExpired: 1,
      result: 0,
      supportedTargets: 0x0cff,
      authorizationMask: 0x0f,
    });
    loading.value = false;
    return;
  }

  const device = ble.connectedDevice.value;
  if (!ble.connected.value || !device?.isSpecialMode || !device.devEui) {
    await router.replace('/startup-recovery');
    return;
  }
  cachedDeviceName.value = ble.getDeviceName(device);
  cachedDevEui.value = device.devEui;
  bbsConnectionObserved.value = true;
  pushDebugLog(`[BBS] Opening ${cachedDeviceName.value} (${device.deviceId})`);
  loading.value = true;
  try {
    session.value = await openBbsSession(device.deviceId, setStatus, pushDebugLog);
    if (session.value.initialStatus.version !== 1) {
      throw new Error(`Unsupported BBS protocol version ${session.value.initialStatus.version}`);
    }
    await loadCredential();
    if (credential.value) {
      const authenticatedStatus = await session.value.authenticate(
        credential.value.keyHex,
        cachedDevEui.value,
      );
      setStatus(authenticatedStatus);
      pushDebugLog(`[BBS] Authorization mask ${hex(authenticatedStatus.authorizationMask)}`);
    }
  } catch (error: any) {
    errorMessage.value = error?.message ?? String(error);
    pushDebugLog(`[BBS] Session failed: ${errorMessage.value}`);
  } finally {
    loading.value = false;
  }
}

async function confirmAndExecute() {
  const target = selectedTargetDefinition.value;
  const activeSession = session.value;
  const activeCredential = credential.value;
  if (!target || !activeSession || !activeCredential || !canSelectTarget(target)) return;

  const messageParts = [interpolate(localize('@bbsConfirmMessage'), {
    mode: targetLabel(target),
  })];
  if (target.id === 0) {
    messageParts.push(localize('@bbsConfirmNormalWarning'));
  } else if (target.id === 0x0b) {
    messageParts.push(interpolate(localize('@bbsConfirmReturnToServiceWarningV3'), {
      state: returnStartupLabel.value,
    }));
    if (factoryResetRequested.value) {
      messageParts.push(localize('@bbsConfirmFactoryResetWarning'));
    }
  } else if ([4, 5, 6, 7].includes(target.id)) {
    messageParts.push(localize('@bbsPersistentModeWarning'));
  }
  const alert = await alertController.create({
    header: localize('@bbsConfirmTitle'),
    message: messageParts.join('\n\n'),
    buttons: [
      { text: localize('@bbsCancel'), role: 'cancel' },
      { text: localize('@bbsConfirm'), role: 'confirm' },
    ],
  });
  await alert.present();
  const result = await alert.onDidDismiss();
  if (result.role !== 'confirm') return;

  applying.value = true;
  errorMessage.value = '';
  pushDebugLog(`[BBS] Administrative action confirmed: target 0x${target.id.toString(16).padStart(2, '0')}`);
  try {
    const flags = target.id === 0x0b
      ? (factoryResetRequested.value ? BBS_FLAG_FACTORY_RESET : 0)
        | (returnStartBlocked.value ? BBS_FLAG_START_BLOCKED : 0)
      : 0;
    const finalStatus = await activeSession.execute(
      target.id,
      flags,
      activeCredential.keyHex,
      cachedDevEui.value,
    );
    setStatus(finalStatus);
    if (finalStatus.result !== 1) {
      const resultKey = BBS_RESULT_KEYS[finalStatus.result];
      const localizationKey = resultKey && resultKey !== 'none' && resultKey !== 'accepted'
        ? `@bbsResult${resultKey[0].toUpperCase()}${resultKey.slice(1)}`
        : '@bbsCommandFailed';
      throw new Error(localize(localizationKey));
    }
    commandSucceeded.value = true;
    pushDebugLog('[BBS] Command accepted and persistent state read back');
  } catch (error: any) {
    errorMessage.value = error?.message ?? String(error);
    pushDebugLog(`[BBS] Command failed: ${errorMessage.value}`);
  } finally {
    applying.value = false;
  }
}

async function selectAndExecuteReturnToService() {
  if (!returnToServiceTarget.value) return;
  selectedTarget.value = returnToServiceTarget.value.id;
  await confirmAndExecute();
  if (!commandSucceeded.value && selectedTarget.value === returnToServiceTarget.value.id) {
    selectedTarget.value = null;
  }
}

async function disconnect() {
  pushDebugLog('[BBS] Closing session on user request');
  await session.value?.close();
  session.value = null;
  if (ble.connected.value) await ble.disconnect();
  await router.replace('/startup-recovery');
}

watch(
  [() => ble.connectionPhase.value, () => ble.connectedDevice.value],
  ([phase, device]) => {
    if (debugPreviewEnabled.value) return;
    const specialModeConnectionActive = device?.isSpecialMode
      && (phase === 'discovering' || phase === 'ready');
    if (specialModeConnectionActive) return;
    if (!bbsConnectionObserved.value) {
      void router.replace('/startup-recovery');
      return;
    }

    if (!sessionClosed.value) {
      sessionClosed.value = true;
      pushDebugLog('[BBS] Connection closed by sensor; keeping page and logs visible');
      const activeSession = session.value;
      session.value = null;
      void activeSession?.close();
    }
  },
);

watch([commandSucceeded, sessionClosed], ([succeeded, closed]) => {
  if (!succeeded || !closed || automaticReturnTimer) return;
  pushDebugLog('[BBS] Command complete; returning automatically to startup and recovery');
  automaticReturnTimer = setTimeout(() => {
    automaticReturnTimer = undefined;
    void router.replace('/startup-recovery');
  }, 900);
});

onMounted(initializeSession);
onUnmounted(() => {
  if (automaticReturnTimer) clearTimeout(automaticReturnTimer);
  void session.value?.close();
});
</script>

<style scoped>
.bbs-content { --background: var(--app-page-background); }
.bbs-header-shell { box-shadow: none; }
.bbs-header {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-height: calc(72px + env(safe-area-inset-top));
  padding: calc(8px + env(safe-area-inset-top)) 12px 8px;
  align-items: center;
  gap: 10px;
  color: var(--ion-color-primary-contrast);
  background: var(--ion-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
}
.bbs-header__logo {
  width: 48px;
  height: 48px;
  border: 1px solid #fff;
  border-radius: 9px;
  object-fit: cover;
}
.bbs-header__identity { display: grid; min-width: 0; gap: 2px; line-height: 1.1; }
.bbs-header__identity span {
  overflow: hidden;
  font-size: 0.76rem;
  font-weight: 700;
  opacity: 0.82;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bbs-header__identity strong {
  overflow: hidden;
  font: 750 0.86rem/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bbs-header__status {
  display: inline-flex;
  padding: 6px 9px;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  color: var(--ion-color-success-shade);
  background: rgba(255, 255, 255, 0.92);
  font-size: 0.68rem;
  font-weight: 800;
}
.bbs-header__status > span { width: 8px; height: 8px; border-radius: 50%; background: var(--ion-color-success); }
.bbs-header__status ion-spinner { width: 14px; height: 14px; color: var(--ion-color-primary); }
.bbs-header__status--loading { color: var(--ion-color-primary-shade); }
.bbs-header__status--closed { color: #5f6368; }
.bbs-header__status--closed > span { background: #80868b; }

.bbs-shell {
  display: grid;
  box-sizing: border-box;
  width: min(100%, 680px);
  min-height: 100%;
  margin: 0 auto;
  padding: 18px 18px 40px;
  align-content: start;
  gap: 16px;
}

.bbs-card {
  overflow: hidden; border: 1px solid var(--app-border); border-radius: 16px;
  background: var(--app-surface); box-shadow: var(--app-card-shadow);
}
.bbs-card__header { display: flex; padding: 16px 18px; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--app-border); }
.bbs-card__header h2 { margin: 0; color: var(--app-text); font-size: 1.05rem; }
.bbs-card__header > ion-icon { color: var(--ion-color-primary); font-size: 24px; }
.bbs-stored-states { padding: 16px 18px; border-top: 1px solid var(--app-border); }
.bbs-stored-states dl { display: grid; margin: 0; gap: 8px; }
.bbs-stored-states dl > div { display: grid; grid-template-columns: minmax(90px, 0.8fr) minmax(0, 1.4fr); align-items: baseline; gap: 12px; }
.bbs-stored-states dt { color: var(--app-text-secondary); font-size: 0.76rem; }
.bbs-stored-states dd { margin: 0; color: var(--app-text); font-size: 0.8rem; font-weight: 750; text-align: right; }
.bbs-editor-toggle {
  display: flex; width: 100%; padding: 13px 15px; align-items: center; justify-content: space-between; gap: 8px;
  border: 0; border-top: 1px solid var(--app-border); color: var(--app-text); background: transparent;
  cursor: pointer; font: 700 0.8rem/1.2 inherit;
}
.bbs-editor-toggle > span { display: flex; align-items: center; gap: 8px; }
.bbs-editor-toggle ion-icon { color: var(--ion-color-primary); font-size: 18px; }
.bbs-editor-toggle--open { background: rgba(var(--ion-color-primary-rgb), 0.06); }
.bbs-editor-toggle:disabled { cursor: not-allowed; opacity: 0.55; }
.bbs-editor-content { scroll-margin-top: 88px; border-top: 1px solid var(--app-border); }
.bbs-technical-toggle {
  display: flex; width: 100%; padding: 10px 8px; align-items: center; justify-content: center; gap: 7px;
  border: 0; color: var(--ion-color-primary); background: transparent; cursor: pointer;
  font: 700 0.75rem/1.2 inherit;
}
.bbs-technical-toggle ion-icon:last-child { margin-left: 2px; }
.bbs-technical-card .bbs-technical-toggle {
  padding: 13px 15px;
  justify-content: flex-start;
  color: var(--app-text);
  font-size: 0.8rem;
}
.bbs-technical-card .bbs-technical-toggle ion-icon { color: var(--ion-color-primary); }
.bbs-technical-card .bbs-technical-toggle ion-icon:last-child { margin-left: auto; }
.bbs-technical { border-top: 1px solid var(--app-border); }
.bbs-blocking { margin: 16px 18px 0; padding: 13px 14px; border-radius: 12px; color: var(--ion-color-warning-shade); background: rgba(var(--ion-color-warning-rgb), 0.1); }
.bbs-blocking--clear { color: var(--ion-color-success-shade); background: rgba(var(--ion-color-success-rgb), 0.1); }
.bbs-blocking strong { font-size: 0.85rem; }
.bbs-blocking ul { margin: 8px 0 0; padding-left: 19px; font-size: 0.78rem; line-height: 1.55; }
.bbs-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; padding: 16px 18px 18px; gap: 10px; }
.bbs-details div { min-width: 0; padding: 10px 11px; border-radius: 10px; background: var(--app-surface-subtle); }
.bbs-details dt { color: var(--app-text-muted); font-size: 0.68rem; }
.bbs-details dd { margin: 4px 0 0; color: var(--app-text); font-size: 0.86rem; font-weight: 700; }
.bbs-target-flag-legend {
  display: flex; margin: 12px 12px 0; align-items: center; gap: 6px;
  color: var(--ion-color-secondary-shade); font-size: 0.68rem; font-weight: 650;
}
.bbs-target-flag-legend ion-icon { font-size: 15px; }
.bbs-target-groups { display: grid; padding: 12px; gap: 14px; }
.bbs-target-group { display: grid; min-width: 0; gap: 7px; }
.bbs-target-group h3 {
  margin: 0; color: var(--app-text); font-size: 0.8rem; font-weight: 750;
  letter-spacing: 0.02em;
}
.bbs-target-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); gap: 7px; }
.bbs-target-options--single { grid-template-columns: 1fr; }
.bbs-target {
  display: flex; width: 100%; min-height: 58px; padding: 10px 11px;
  align-items: center; gap: 8px; border: 1px solid var(--app-border); border-radius: 10px;
  color: var(--app-text); background: var(--app-surface-subtle); cursor: pointer; text-align: left;
}
.bbs-target--selected {
  border-color: var(--ion-color-primary-shade); color: var(--ion-color-primary-contrast);
  background: var(--ion-color-primary); box-shadow: 0 2px 7px rgba(var(--ion-color-primary-rgb), 0.32);
}
.bbs-target--flagged:not(.bbs-target--selected) {
  border-color: var(--ion-color-secondary); background: rgba(var(--ion-color-secondary-rgb), 0.09);
  box-shadow: inset 3px 0 0 var(--ion-color-secondary);
}
.bbs-target:disabled { cursor: not-allowed; opacity: 0.55; }
.bbs-target__radio { box-sizing: border-box; width: 16px; height: 16px; flex: 0 0 auto; border: 2px solid var(--app-border-strong); border-radius: 50%; }
.bbs-target--selected .bbs-target__radio { border: 5px solid var(--ion-color-primary-contrast); }
.bbs-target__copy { display: grid; min-width: 0; gap: 3px; }
.bbs-target strong { min-width: 0; font: 700 0.78rem/1.25 inherit; }
.bbs-target__copy small { color: var(--app-text-secondary); font-size: 0.66rem; line-height: 1.3; }
.bbs-target--selected .bbs-target__copy small { color: inherit; opacity: 0.86; }
.bbs-target__current {
  width: fit-content; margin-top: 2px; padding: 2px 6px; border-radius: 999px;
  color: var(--ion-color-secondary-shade); background: rgba(var(--ion-color-secondary-rgb), 0.12);
  font-size: 0.6rem; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase;
}
.bbs-target--selected .bbs-target__current { color: inherit; background: rgba(255, 255, 255, 0.18); }
.bbs-target__indicator {
  display: grid; width: 20px; min-width: 20px; height: 20px; margin-left: auto;
  color: var(--ion-color-warning-shade); place-items: center;
}
.bbs-target__indicator ion-icon { font-size: 18px; }
.bbs-target--selected .bbs-target__indicator { color: var(--ion-color-primary-contrast); }
.bbs-target__flag {
  display: grid; width: 18px; height: 18px; flex: 0 0 auto; border-radius: 50%;
  color: var(--ion-color-secondary-contrast); background: var(--ion-color-secondary); place-items: center;
}
.bbs-target__flag ion-icon { font-size: 11px; }
.bbs-target-description {
  min-height: 2.7em; margin: 0 2px; color: var(--app-text-secondary);
  font-size: 0.7rem; line-height: 1.35;
}
.bbs-target-description--empty { visibility: hidden; }
.bbs-visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden;
  clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.bbs-apply { margin: 0 12px 14px; }
.bbs-return-service { border-color: rgba(var(--ion-color-warning-rgb), 0.4); }
.bbs-return-service--primary { box-shadow: 0 5px 18px rgba(var(--ion-color-warning-rgb), 0.12); }
.bbs-return-service__body { display: grid; padding: 14px 12px; gap: 12px; }
.bbs-return-service__body > p { margin: 0 4px; color: var(--app-text-secondary); font-size: 0.78rem; line-height: 1.45; }
.bbs-return-service__body > ion-button { margin: 0; }
.bbs-current-state-title { margin: 0 4px -4px; color: var(--app-text); font-size: 0.78rem; font-weight: 750; }
.bbs-already-service {
  display: flex; padding: 11px 12px; align-items: flex-start; gap: 9px; border-radius: 10px;
  color: var(--ion-color-success-shade); background: rgba(var(--ion-color-success-rgb), 0.09);
  font-size: 0.76rem; line-height: 1.4;
}
.bbs-already-service ion-icon { flex: 0 0 auto; margin-top: 1px; font-size: 19px; }
.bbs-return-summary { display: grid; margin: 0; padding: 11px 12px; gap: 8px; border-radius: 10px; background: var(--app-surface-subtle); }
.bbs-return-summary > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 12px; }
.bbs-return-summary dt { color: var(--app-text-secondary); font-size: 0.7rem; }
.bbs-return-summary dd { margin: 0; color: var(--app-text); font-size: 0.76rem; font-weight: 750; text-align: right; }
.bbs-options-toggle,
.bbs-advanced-toggle {
  display: flex; width: 100%; padding: 11px 12px; align-items: center; justify-content: center; gap: 7px;
  border: 0; border-radius: 10px; color: var(--ion-color-primary); background: transparent;
  cursor: pointer; font: 750 0.75rem/1.25 inherit;
}
.bbs-options-toggle ion-icon:last-child { margin-left: auto; }
.bbs-advanced-toggle {
  justify-content: space-between; border: 1px solid var(--app-border); color: var(--app-text);
  background: var(--app-surface); box-shadow: var(--app-card-shadow);
}
.bbs-advanced-toggle > span { display: flex; align-items: center; gap: 8px; }
.bbs-advanced-toggle ion-icon { color: var(--ion-color-primary); font-size: 18px; }
.bbs-advanced-toggle--open {
  border-color: rgba(var(--ion-color-primary-rgb), 0.55);
  background: rgba(var(--ion-color-primary-rgb), 0.07);
}
.bbs-overview--advanced {
  scroll-margin-top: 12px;
  margin-top: -8px;
  border-color: rgba(var(--ion-color-primary-rgb), 0.45);
  box-shadow: 0 5px 18px rgba(var(--ion-color-primary-rgb), 0.11);
}
.bbs-return-options { display: grid; gap: 10px; }
.bbs-return-options fieldset { display: grid; min-width: 0; margin: 0; padding: 0; gap: 7px; border: 0; }
.bbs-return-options fieldset:disabled { opacity: 0.58; }
.bbs-return-options legend { margin: 0 0 2px; color: var(--app-text); font-size: 0.75rem; font-weight: 750; }
.bbs-storage-control {
  display: flex; padding: 8px 9px 8px 11px; align-items: center; justify-content: space-between; gap: 12px;
  border-radius: 10px; color: var(--app-text); background: var(--app-surface-subtle); font-size: 0.76rem; font-weight: 700;
}
.bbs-binary-selector {
  display: grid; grid-template-columns: repeat(2, minmax(46px, 1fr)); padding: 2px; gap: 2px;
  border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-surface);
}
.bbs-binary-selector button {
  min-height: 28px; padding: 4px 9px; border: 0; border-radius: 6px;
  color: var(--app-text-secondary); background: transparent; cursor: pointer; font: 700 0.72rem/1 inherit;
}
.bbs-binary-selector button:disabled { cursor: not-allowed; }
.bbs-binary-selector button.bbs-binary-selector__option--selected {
  color: var(--ion-color-primary-contrast); background: var(--ion-color-primary);
}
.bbs-return-options > ion-button { margin: 0; }
.bbs-alert { display: flex; padding: 13px 14px; align-items: flex-start; gap: 9px; border: 1px solid transparent; border-radius: 12px; font-size: 0.82rem; line-height: 1.45; }
.bbs-alert ion-icon { flex: 0 0 auto; margin-top: 1px; font-size: 20px; }
.bbs-alert--error { border-color: rgba(var(--ion-color-danger-rgb), 0.25); color: var(--ion-color-danger-shade); background: rgba(var(--ion-color-danger-rgb), 0.08); }
.bbs-alert--success { border-color: rgba(var(--ion-color-success-rgb), 0.25); color: var(--ion-color-success-shade); background: rgba(var(--ion-color-success-rgb), 0.08); }
.bbs-alert--warning { border-color: rgba(var(--ion-color-warning-rgb), 0.25); color: var(--ion-color-warning-shade); background: rgba(var(--ion-color-warning-rgb), 0.09); }

.bbs-debug-stack {
  position: fixed;
  right: 10px;
  bottom: calc(10px + env(safe-area-inset-bottom));
  z-index: 1000;
  display: flex;
  max-width: min(360px, calc(100vw - 20px));
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.bbs-debug-panel {
  box-sizing: border-box;
  width: min(360px, calc(100vw - 20px));
  max-height: min(310px, 42vh);
  padding: 9px;
  overflow: hidden;
  border: 1px solid var(--app-border-strong);
  border-radius: 10px;
  color: var(--app-text);
  background: var(--app-surface);
  box-shadow: 0 5px 18px rgba(0, 0, 0, 0.22);
}
.bbs-debug-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
.bbs-debug-header strong { font-size: 0.8rem; }
.bbs-debug-header button {
  padding: 3px 7px; border: 0; color: var(--ion-color-primary); background: transparent;
  cursor: pointer; font: 650 0.72rem/1.2 inherit;
}
.bbs-debug-lines {
  display: grid;
  max-height: min(260px, 35vh);
  padding: 8px;
  overflow: auto;
  gap: 5px;
  border-radius: 7px;
  color: #e8eef7;
  background: #17202c;
}
.bbs-debug-lines code { font-size: 0.67rem; line-height: 1.35; white-space: pre-wrap; overflow-wrap: anywhere; }
.bbs-debug-empty { color: #9ba8b8; font-size: 0.72rem; }
.bbs-debug-toggle {
  min-width: 46px;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  color: #fff;
  background: rgba(73, 78, 86, 0.92);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  font: 750 0.68rem/1.2 inherit;
  letter-spacing: 0.06em;
}

@media (max-width: 420px) {
  .bbs-shell { padding-inline: 12px; }
  .bbs-target-options { grid-template-columns: 1fr; }
}

@media (min-width: 560px) {
  .bbs-details { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 330px) {
  .bbs-details { grid-template-columns: 1fr; }
}
</style>
