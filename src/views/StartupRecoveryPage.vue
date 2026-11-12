<template>
  <ion-page>
    <ion-header class="recovery-header">
      <ion-toolbar class="recovery-toolbar">
        <ion-buttons slot="start">
          <ion-back-button default-href="/ble-settings" />
        </ion-buttons>
        <ion-title>{{ localize('@startupRecoveryTitle') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="recovery-content">
      <main class="recovery-shell">
        <section class="recovery-card">
          <p class="recovery-intro">{{ localize('@startupRecoveryIntro') }}</p>

          <label class="dev-eui-label" for="bbs-dev-eui">{{ localize('@bleDevEui') }}</label>
          <div class="dev-eui-row">
            <span>70:B3:D5:E7:</span>
            <input
              id="bbs-dev-eui"
              :value="formattedDevEuiSuffix"
              type="text"
              inputmode="text"
              maxlength="23"
              autocomplete="off"
              autocapitalize="characters"
              placeholder="5F:12:34:56"
              :disabled="workflowActive"
              @input="onDevEuiSuffixInput"
            />
            <ion-button
              class="qr-button"
              fill="clear"
              :aria-label="localize('@bleQrScan')"
              :disabled="workflowActive || qrScanInProgress"
              @click="scanSensorQrCode"
            >
              <ion-spinner v-if="qrScanInProgress" name="crescent" />
              <ion-icon v-else :icon="qrCodeOutline" aria-hidden="true" />
            </ion-button>
          </div>
          <p class="qr-hint">{{ localize('@bleQrScanHint') }}</p>

          <div class="recovery-instructions">
            <ion-icon :icon="informationCircleOutline" aria-hidden="true" />
            <span>{{ localize('@startupRecoveryInstructions') }}</span>
          </div>

          <ion-button
            expand="block"
            :color="workflowActive ? 'medium' : 'primary'"
            :disabled="!targetBbsName && !workflowActive"
            @click="toggleBbsConnection"
          >
            <ion-icon slot="start" :icon="workflowActive ? closeOutline : powerOutline" />
            {{ localize(workflowActive ? '@startupRecoveryCancel' : '@startupRecoveryStart') }}
          </ion-button>

          <div v-if="workflowActive" class="recovery-waiting" role="status" aria-live="polite">
            <ion-spinner name="crescent" />
            <span>{{ localize(connecting ? '@startupRecoveryConnecting' : '@startupRecoveryWaiting') }}</span>
          </div>
          <ion-note v-if="message" color="danger" class="recovery-message" role="alert">
            {{ message }}
          </ion-note>
        </section>

        <ion-button
          v-if="developerModeEnabled"
          expand="block"
          fill="outline"
          color="medium"
          @click="router.push('/special-mode?preview=1')"
        >
          {{ localize('@blePreviewSpecialMode') }}
        </ion-button>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonNote,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import {
  closeOutline,
  informationCircleOutline,
  powerOutline,
  qrCodeOutline,
} from 'ionicons/icons';
import { useBle } from '@/composables/useBle';
import { useDeveloperMode } from '@/composables/useDeveloperMode';
import { useLanguage } from '@/composables/useLanguage';
import { extractDevEuiFromQrPayload } from '@/utils/lorawanQr';
import {
  deriveBleDeviceNameFromDevEuiSuffix,
  formatDevEuiSuffix,
  getFormattedDevEuiSuffixCaret,
  normalizeDevEuiSuffixInput,
} from '@/utils/BLE/deviceIdentity';
import { createBundledTranslations } from '@/utils/localization';

const router = useRouter();
const ble = useBle();
const { currentLanguage } = useLanguage();
const { developerModeEnabled } = useDeveloperMode();
const languages = createBundledTranslations();
const storageKey = 'easycodec.bbsDevEuiSuffix';
const devEuiSuffix = ref(normalizeDevEuiSuffixInput(localStorage.getItem(storageKey) ?? undefined));
const workflowActive = ref(false);
const connecting = ref(false);
const qrScanInProgress = ref(false);
const message = ref('');

const localize = (key: string): string => {
  if (!key.startsWith('@')) return key;
  return languages[currentLanguage.value][key.substring(1)] ?? key;
};

const formattedDevEuiSuffix = computed(() => formatDevEuiSuffix(devEuiSuffix.value));
const targetBbsName = computed(() => {
  const normalName = deriveBleDeviceNameFromDevEuiSuffix(devEuiSuffix.value);
  return normalName ? `${normalName}.BBS` : null;
});

watch(devEuiSuffix, suffix => localStorage.setItem(storageKey, suffix), { flush: 'sync' });

onMounted(() => ble.initialize());
onUnmounted(() => {
  if (connecting.value) void ble.cancelConnect();
  else if (workflowActive.value) void ble.cancelScan();
});

function onDevEuiSuffixInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const caret = getFormattedDevEuiSuffixCaret(input.value, input.selectionStart);
  devEuiSuffix.value = normalizeDevEuiSuffixInput(input.value);
  message.value = '';
  input.value = formattedDevEuiSuffix.value;
  void nextTick(() => input.setSelectionRange(caret, caret));
}

async function scanSensorQrCode() {
  if (qrScanInProgress.value || workflowActive.value) return;
  message.value = '';
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
      message.value = localize('@bleQrInvalid');
      return;
    }
    devEuiSuffix.value = suffix;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!/cancel/i.test(detail)) message.value = localize('@bleQrScanFailed');
  } finally {
    qrScanInProgress.value = false;
  }
}

async function toggleBbsConnection() {
  if (workflowActive.value) {
    workflowActive.value = false;
    if (connecting.value) await ble.cancelConnect();
    else await ble.cancelScan();
    return;
  }

  const deviceName = targetBbsName.value;
  if (!deviceName) return;
  message.value = '';
  workflowActive.value = true;
  try {
    // The dedicated workflow must own the BLE radio and must never retain a
    // normal-mode connection while waiting for the short BBS window.
    if (ble.scanning.value) await ble.cancelScan();
    if (ble.connected.value) await ble.disconnect();
    if (!workflowActive.value) return;
    const device = await ble.startTargetedScan(deviceName);
    if (!device || !workflowActive.value) {
      if (workflowActive.value) message.value = localize('@startupRecoveryNotFound');
      return;
    }
    connecting.value = true;
    const connected = await ble.connectToSpecialModeDevice(device);
    if (connected) {
      workflowActive.value = false;
      await router.replace('/special-mode');
      return;
    }
    if (workflowActive.value) message.value = localize('@bleConnectionFailed');
  } finally {
    connecting.value = false;
    workflowActive.value = false;
  }
}
</script>

<style scoped>
.recovery-header { box-shadow: none; }
.recovery-toolbar {
  --background: var(--ion-color-primary);
  --color: var(--ion-color-primary-contrast);
  --min-height: 82px;
  --padding-start: 8px;
  --padding-end: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
}
.recovery-toolbar ion-back-button { width: 44px; height: 44px; --color: var(--ion-color-primary-contrast); }
.recovery-toolbar ion-title {
  padding-inline: 0 8px;
  font-size: 1.08rem;
}
.recovery-content { --background: var(--app-page-background); }
.recovery-shell { display: grid; max-width: 500px; margin: 0 auto; padding: 20px 14px; gap: 14px; }
.recovery-card {
  display: grid; padding: 18px 14px; gap: 14px; border: 1px solid rgba(var(--ion-color-primary-rgb), 0.24);
  border-radius: 14px; background: var(--app-surface); box-shadow: var(--app-card-shadow);
}
.recovery-intro { margin: 0; color: var(--app-text); font-size: 0.92rem; line-height: 1.45; }
.dev-eui-label { margin-bottom: -8px; color: var(--app-text-secondary); font-size: 0.73rem; font-weight: 750; text-transform: uppercase; }
.dev-eui-row {
  display: flex; min-width: 0; align-items: center; overflow: hidden; border: 1px solid var(--app-border);
  border-radius: 9px; background: var(--app-page-background); font-family: monospace; font-size: clamp(0.84rem, 3.8vw, 1rem); font-weight: 700;
}
.dev-eui-row > span { flex: 0 0 auto; padding-left: 11px; color: var(--app-text-secondary); }
.dev-eui-row input {
  width: 100%; min-width: 0; padding: 12px 2px; border: 0; outline: 0; color: var(--app-text);
  background: transparent; font: inherit; text-transform: uppercase;
}
.qr-button { flex: 0 0 42px; width: 42px; min-height: 42px; margin: 0; --padding-start: 0; --padding-end: 0; }
.qr-hint { margin: -8px 0 0; color: var(--app-text-secondary); font-size: 0.76rem; line-height: 1.35; }
.recovery-instructions {
  display: flex; padding: 12px; align-items: flex-start; gap: 9px; border-radius: 10px;
  color: var(--ion-color-primary-shade); background: rgba(var(--ion-color-primary-rgb), 0.08); font-size: 0.82rem; line-height: 1.4;
}
.recovery-instructions ion-icon { flex: 0 0 auto; margin-top: 1px; font-size: 19px; }
.recovery-card > ion-button { margin: 0; }
.recovery-waiting { display: flex; align-items: center; justify-content: center; gap: 9px; color: var(--ion-color-primary-shade); font-size: 0.82rem; }
.recovery-waiting ion-spinner { width: 18px; height: 18px; }
.recovery-message { display: block; text-align: center; font-size: 0.8rem; line-height: 1.35; }
</style>
