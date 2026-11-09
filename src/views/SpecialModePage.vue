<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ localize('@bleSpecialModeTitle') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="bst-content">
      <main class="bst-shell">
        <header class="bst-heading">
          <div class="bst-heading__icon" aria-hidden="true">
            <ion-icon :icon="constructOutline" />
          </div>
          <div>
            <p class="bst-device">{{ deviceName }}</p>
            <p class="bst-admin-label">
              <ion-icon :icon="shieldCheckmarkOutline" aria-hidden="true" />
              {{ localize('@bleSpecialModeAdminAction') }}
            </p>
          </div>
        </header>

        <p class="bst-intro">{{ localize('@bleSpecialModeMessage') }}</p>

        <section v-if="loading" class="bst-card bst-loading" role="status">
          <ion-spinner name="crescent" />
          <span>{{ localize('@bstLoading') }}</span>
        </section>

        <div v-if="errorMessage" class="bst-alert bst-alert--error" role="alert">
          <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
          <span>{{ errorMessage }}</span>
        </div>

        <div v-if="commandSucceeded" class="bst-alert bst-alert--success" role="status">
          <ion-icon :icon="checkmarkCircleOutline" aria-hidden="true" />
          <span>{{ localize('@bstCommandAccepted') }}</span>
        </div>

        <template v-if="status">
          <section class="bst-card">
            <div class="bst-card__header">
              <div>
                <span class="bst-kicker">BST</span>
                <h2>{{ localize('@bstStatusTitle') }}</h2>
              </div>
              <ion-icon :icon="pulseOutline" aria-hidden="true" />
            </div>

            <div
              class="bst-blocking"
              :class="{ 'bst-blocking--clear': blockingReasons.length === 0 }"
            >
              <strong>{{ localize(blockingReasons.length ? '@bstBlockingState' : '@bstNoBlockingState') }}</strong>
              <ul v-if="blockingReasons.length">
                <li v-for="reason in blockingReasons" :key="reason">{{ localize(reason) }}</li>
              </ul>
            </div>

            <dl class="bst-details">
              <div><dt>{{ localize('@bstProtocolVersion') }}</dt><dd>{{ hex(status.version) }}</dd></div>
              <div><dt>{{ localize('@bstPhase') }}</dt><dd>{{ hex(status.phase) }}</dd></div>
              <div><dt>{{ localize('@bstAutotestLog') }}</dt><dd>{{ hex(status.autotestLog) }}</dd></div>
              <div><dt>{{ localize('@bstLastAutotestStep') }}</dt><dd>{{ status.autotestLastNum }}</dd></div>
              <div><dt>{{ localize('@bstCemState') }}</dt><dd>{{ hex(status.cemState) }}</dd></div>
              <div><dt>{{ localize('@bstBlockedStarting') }}</dt><dd>{{ yesNo(status.blockedStarting) }}</dd></div>
              <div><dt>{{ localize('@bstMinUptimeExpired') }}</dt><dd>{{ yesNo(status.minUptimeExpired) }}</dd></div>
            </dl>
          </section>

          <section v-if="!commandSucceeded" class="bst-card">
            <div class="bst-card__header">
              <div>
                <span class="bst-kicker">{{ localize('@bleSpecialModeAdminAction') }}</span>
                <h2>{{ localize('@bstTargetsTitle') }}</h2>
              </div>
              <ion-icon :icon="optionsOutline" aria-hidden="true" />
            </div>

            <div class="bst-targets">
              <button
                v-for="target in availableTargets"
                :key="target.id"
                type="button"
                class="bst-target"
                :class="{ 'bst-target--selected': selectedTarget === target.id }"
                :disabled="!canSelectTarget(target) || applying"
                @click="selectedTarget = target.id"
              >
                <span class="bst-target__radio" aria-hidden="true"></span>
                <span class="bst-target__copy">
                  <strong>{{ targetLabel(target) }}</strong>
                  <small>{{ targetDescription(target) }}</small>
                  <em v-if="target.elevated && !hasElevatedAccess">
                    <ion-icon :icon="lockClosedOutline" aria-hidden="true" />
                    {{ localize('@bstElevatedRoleRequired') }}
                  </em>
                </span>
              </button>
            </div>

            <div
              class="bst-authorization"
              :class="{ 'bst-authorization--available': credentialAvailable }"
            >
              <ion-icon :icon="credentialAvailable ? keyOutline : lockClosedOutline" aria-hidden="true" />
              <span>{{ localize(credentialMessageKey) }}</span>
            </div>

            <ion-button
              expand="block"
              class="bst-apply"
              :disabled="!canExecute"
              @click="confirmAndExecute"
            >
              <ion-spinner v-if="applying" slot="start" name="crescent" />
              {{ localize(applying ? '@bstApplyingMode' : '@bstApplyMode') }}
            </ion-button>
          </section>
        </template>

        <ion-button expand="block" fill="outline" color="medium" @click="disconnect">
          {{ localize('@bleSpecialModeDisconnect') }}
        </ion-button>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  alertController,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  constructOutline,
  keyOutline,
  lockClosedOutline,
  optionsOutline,
  pulseOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { useBle } from '@/composables/useBle';
import { useBleDebugCredentials } from '@/composables/useBleDebugCredentials';
import { useDeveloperMode } from '@/composables/useDeveloperMode';
import { useKmsAccess } from '@/composables/useKmsAccess';
import { useLanguage } from '@/composables/useLanguage';
import { OsaKeyStore, type StoredOsaKey } from '@/plugins/osaKeyStore';
import {
  BST_RESULT_KEYS,
  getAvailableBstTargets,
  openBstSession,
  type BstSession,
  type BstStatus,
  type BstTarget,
} from '@/utils/BLE/bstProtocol';
import { createBundledTranslations } from '@/utils/localization';

const BLOCKING_REASON_KEYS = [
  '@bstBlockAutotest',
  '@bstBlockFinalAutotest',
  '@bstBlockCem',
  '@bstBlockCemPermanent',
  '@bstBlockStarting',
  '@bstBlockMinUptime',
  '@bstBlockInconsistent',
] as const;

const router = useRouter();
const route = useRoute();
const ble = useBle();
const kmsAccess = useKmsAccess();
const { developerModeEnabled } = useDeveloperMode();
const { debugOtaAppKeyHex } = useBleDebugCredentials();
const { currentLanguage } = useLanguage();
const languages = createBundledTranslations();

const status = ref<BstStatus | null>(null);
const session = ref<BstSession | null>(null);
const credential = ref<StoredOsaKey | null>(null);
const credentialSource = ref<'secure' | 'debug' | null>(null);
const selectedTarget = ref<number | null>(null);
const loading = ref(false);
const applying = ref(false);
const errorMessage = ref('');
const commandSucceeded = ref(false);
const cachedDeviceName = ref('WS5F123456.BST');
const cachedDevEui = ref('70B3D5E75F123456');

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
const deviceName = computed(() => cachedDeviceName.value);
const availableTargets = computed(() => (
  status.value ? getAvailableBstTargets(status.value.availableTargets) : []
));
const blockingReasons = computed(() => {
  const mask = status.value?.blockingMask ?? 0;
  return BLOCKING_REASON_KEYS.filter((_key, bit) => (mask & (1 << bit)) !== 0);
});
const credentialAvailable = computed(() => credential.value !== null);
const credentialMessageKey = computed(() => {
  if (credentialSource.value === 'debug') return '@bstDebugCredentialAvailable';
  return credentialAvailable.value ? '@bstCredentialAvailable' : '@bstCredentialUnavailable';
});
const hasElevatedAccess = computed(() => (
  developerModeEnabled.value
  || debugPreviewEnabled.value
  || kmsAccess.hasPrivilegedAccess(cachedDevEui.value)
));
const selectedTargetDefinition = computed(() => (
  availableTargets.value.find(target => target.id === selectedTarget.value)
));
const canExecute = computed(() => Boolean(
  session.value
  && credentialAvailable.value
  && selectedTargetDefinition.value
  && canSelectTarget(selectedTargetDefinition.value)
  && !applying.value
));

function hex(value: number): string {
  return `0x${value.toString(16).padStart(2, '0').toUpperCase()}`;
}

function yesNo(value: number): string {
  return localize(value ? '@bstYes' : '@bstNo');
}

function targetLabel(target: BstTarget): string {
  return localize(`@bstTarget${target.key[0].toUpperCase()}${target.key.slice(1)}`);
}

function targetDescription(target: BstTarget): string {
  return localize(`@bstTarget${target.key[0].toUpperCase()}${target.key.slice(1)}Description`);
}

function canSelectTarget(target: BstTarget): boolean {
  return !target.elevated || hasElevatedAccess.value;
}

function setStatus(nextStatus: BstStatus) {
  status.value = nextStatus;
  if (nextStatus.result === 1) commandSucceeded.value = true;
  if (selectedTarget.value === null) {
    selectedTarget.value = getAvailableBstTargets(nextStatus.availableTargets)
      .find(canSelectTarget)?.id ?? null;
  }
}

async function loadCredential() {
  if (debugPreviewEnabled.value) return;
  if (developerModeEnabled.value) {
    const debugKey = debugOtaAppKeyHex.value.replace(/[^0-9a-f]/gi, '').toUpperCase();
    if (/^[0-9A-F]{32}$/.test(debugKey)) {
      credential.value = {
        devEui: cachedDevEui.value,
        keyHex: debugKey,
        expiresAt: Number.MAX_SAFE_INTEGER,
      };
      credentialSource.value = 'debug';
      return;
    }
  }

  try {
    credential.value = await OsaKeyStore.get({ devEui: cachedDevEui.value });
    credentialSource.value = 'secure';
  } catch {
    credential.value = null;
    credentialSource.value = null;
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
      availableTargets: 0x01ff,
    });
    return;
  }

  const device = ble.connectedDevice.value;
  if (!ble.connected.value || !device?.isSpecialMode || !device.devEui) {
    await router.replace('/ble-connect');
    return;
  }
  cachedDeviceName.value = ble.getDeviceName(device);
  cachedDevEui.value = device.devEui;
  loading.value = true;
  try {
    session.value = await openBstSession(device.deviceId, setStatus);
    if (session.value.initialStatus.version !== 1) {
      throw new Error(`Unsupported BST protocol version ${session.value.initialStatus.version}`);
    }
    await loadCredential();
  } catch (error: any) {
    errorMessage.value = error?.message ?? String(error);
  } finally {
    loading.value = false;
  }
}

async function confirmAndExecute() {
  const target = selectedTargetDefinition.value;
  const activeSession = session.value;
  const activeCredential = credential.value;
  if (!target || !activeSession || !activeCredential || !canSelectTarget(target)) return;

  const warning = target.id === 0
    ? `<br><br><strong>${localize('@bstConfirmNormalWarning')}</strong>`
    : '';
  const alert = await alertController.create({
    header: localize('@bstConfirmTitle'),
    message: interpolate(localize('@bstConfirmMessage'), { mode: targetLabel(target) }) + warning,
    buttons: [
      { text: localize('@bstCancel'), role: 'cancel' },
      { text: localize('@bstConfirm'), role: 'confirm' },
    ],
  });
  await alert.present();
  const result = await alert.onDidDismiss();
  if (result.role !== 'confirm') return;

  applying.value = true;
  errorMessage.value = '';
  try {
    const finalStatus = await activeSession.execute(
      target.id,
      activeCredential.keyHex,
      cachedDevEui.value,
    );
    setStatus(finalStatus);
    if (finalStatus.result !== 1) {
      const resultKey = BST_RESULT_KEYS[finalStatus.result];
      const localizationKey = resultKey && resultKey !== 'none' && resultKey !== 'accepted'
        ? `@bstResult${resultKey[0].toUpperCase()}${resultKey.slice(1)}`
        : '@bstCommandFailed';
      throw new Error(localize(localizationKey));
    }
    commandSucceeded.value = true;
  } catch (error: any) {
    errorMessage.value = error?.message ?? String(error);
  } finally {
    applying.value = false;
  }
}

async function disconnect() {
  await session.value?.close();
  session.value = null;
  if (ble.connected.value) await ble.disconnect();
  await router.replace('/ble-connect');
}

watch(
  [() => ble.connectionPhase.value, () => ble.connectedDevice.value],
  ([phase, device]) => {
    if (debugPreviewEnabled.value || commandSucceeded.value) return;
    const specialModeConnectionActive = device?.isSpecialMode
      && (phase === 'discovering' || phase === 'ready');
    if (!specialModeConnectionActive) void router.replace('/ble-connect');
  },
);

onMounted(initializeSession);
onUnmounted(() => {
  void session.value?.close();
});
</script>

<style scoped>
.bst-content { --background: var(--app-page-background); }

.bst-shell {
  display: grid;
  box-sizing: border-box;
  width: min(100%, 680px);
  min-height: 100%;
  margin: 0 auto;
  padding: 28px 18px 40px;
  align-content: start;
  gap: 16px;
}

.bst-heading { display: flex; align-items: center; gap: 14px; }
.bst-heading__icon {
  display: grid; width: 58px; height: 58px; flex: 0 0 auto; border-radius: 16px;
  color: var(--ion-color-warning-shade); background: rgba(var(--ion-color-warning-rgb), 0.15);
  font-size: 29px; place-items: center;
}
.bst-device { margin: 0 0 7px; color: var(--app-text); font-size: 1.05rem; font-weight: 750; }
.bst-admin-label {
  display: inline-flex; margin: 0; align-items: center; gap: 6px; color: var(--ion-color-warning-shade);
  font-size: 0.72rem; font-weight: 750; letter-spacing: 0.06em; text-transform: uppercase;
}
.bst-intro { margin: 0; color: var(--app-text-secondary); line-height: 1.5; }
.bst-card {
  overflow: hidden; border: 1px solid var(--app-border); border-radius: 16px;
  background: var(--app-surface); box-shadow: var(--app-card-shadow);
}
.bst-loading { display: flex; padding: 24px; align-items: center; justify-content: center; gap: 12px; }
.bst-card__header { display: flex; padding: 16px 18px; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--app-border); }
.bst-card__header h2 { margin: 3px 0 0; color: var(--app-text); font-size: 1.05rem; }
.bst-card__header > ion-icon { color: var(--ion-color-primary); font-size: 24px; }
.bst-kicker { color: var(--app-text-muted); font-size: 0.67rem; font-weight: 750; letter-spacing: 0.08em; text-transform: uppercase; }
.bst-blocking { margin: 16px 18px 0; padding: 13px 14px; border-radius: 12px; color: var(--ion-color-warning-shade); background: rgba(var(--ion-color-warning-rgb), 0.1); }
.bst-blocking--clear { color: var(--ion-color-success-shade); background: rgba(var(--ion-color-success-rgb), 0.1); }
.bst-blocking strong { font-size: 0.85rem; }
.bst-blocking ul { margin: 8px 0 0; padding-left: 19px; font-size: 0.78rem; line-height: 1.55; }
.bst-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; padding: 16px 18px 18px; gap: 10px; }
.bst-details div { min-width: 0; padding: 10px 11px; border-radius: 10px; background: var(--app-surface-subtle); }
.bst-details dt { color: var(--app-text-muted); font-size: 0.68rem; }
.bst-details dd { margin: 4px 0 0; color: var(--app-text); font-size: 0.86rem; font-weight: 700; }
.bst-targets { display: grid; padding: 12px; gap: 8px; }
.bst-target {
  display: grid; grid-template-columns: 20px minmax(0, 1fr); width: 100%; padding: 13px;
  align-items: start; gap: 11px; border: 1px solid var(--app-border); border-radius: 12px;
  color: var(--app-text); background: var(--app-surface-subtle); cursor: pointer; text-align: left;
}
.bst-target--selected { border-color: var(--ion-color-primary); box-shadow: 0 0 0 2px rgba(var(--ion-color-primary-rgb), 0.1); }
.bst-target:disabled { cursor: not-allowed; opacity: 0.55; }
.bst-target__radio { box-sizing: border-box; width: 18px; height: 18px; margin-top: 1px; border: 2px solid var(--app-border-strong); border-radius: 50%; }
.bst-target--selected .bst-target__radio { border: 5px solid var(--ion-color-primary); }
.bst-target__copy { display: grid; gap: 4px; }
.bst-target__copy strong { font: 700 0.86rem/1.3 inherit; }
.bst-target__copy small { color: var(--app-text-secondary); font-size: 0.74rem; line-height: 1.4; }
.bst-target__copy em { display: flex; align-items: center; gap: 5px; color: var(--ion-color-warning-shade); font-size: 0.69rem; font-style: normal; font-weight: 650; }
.bst-authorization { display: flex; margin: 0 12px 12px; padding: 11px 12px; align-items: flex-start; gap: 9px; border-radius: 10px; color: var(--app-text-secondary); background: var(--app-surface-subtle); font-size: 0.74rem; line-height: 1.4; }
.bst-authorization--available { color: var(--ion-color-success-shade); background: rgba(var(--ion-color-success-rgb), 0.08); }
.bst-authorization ion-icon { flex: 0 0 auto; margin-top: 1px; font-size: 18px; }
.bst-apply { margin: 0 12px 14px; }
.bst-alert { display: flex; padding: 13px 14px; align-items: flex-start; gap: 9px; border: 1px solid transparent; border-radius: 12px; font-size: 0.82rem; line-height: 1.45; }
.bst-alert ion-icon { flex: 0 0 auto; margin-top: 1px; font-size: 20px; }
.bst-alert--error { border-color: rgba(var(--ion-color-danger-rgb), 0.25); color: var(--ion-color-danger-shade); background: rgba(var(--ion-color-danger-rgb), 0.08); }
.bst-alert--success { border-color: rgba(var(--ion-color-success-rgb), 0.25); color: var(--ion-color-success-shade); background: rgba(var(--ion-color-success-rgb), 0.08); }

@media (max-width: 420px) {
  .bst-shell { padding-inline: 12px; }
  .bst-details { grid-template-columns: 1fr; }
}
</style>
