<template>
  <ion-page>
    <sensor-mobile-navigation
      active-page="tools"
      back-to="/sensor-tools"
      :back-label="localize('@backLabel')"
      :localize="localize"
    />

    <ion-content :fullscreen="true" class="ota-app-eui-content">
      <main class="ota-app-eui-container">
        <header class="page-heading">
          <h1>{{ localize('@otaAppEuiTitle') }}</h1>
        </header>

        <section class="app-eui-card app-eui-current" aria-live="polite">
          <span>{{ localize('@otaAppEuiCurrent') }}</span>
          <div class="current-value">
            <ion-spinner v-if="readingAppEui || checkingAuthentication" name="crescent" />
            <strong>{{ formattedCurrentAppEui || '—' }}</strong>
          </div>
          <p
            v-if="currentStatusMessage"
            :class="{ 'message--error': currentStatusError }"
          >
            {{ currentStatusMessage }}
          </p>
          <ion-button
            v-if="canRetryRead"
            size="small"
            fill="clear"
            :disabled="readingAppEui || checkingAuthentication"
            @click="initializeAppEui"
          >
            {{ localize('@otaAppEuiRetry') }}
          </ion-button>
        </section>

        <section class="app-eui-card app-eui-editor">
          <eui-input
            ref="appEuiInput"
            v-model="newAppEui"
            input-id="ota-app-eui-input"
            :label="localize('@otaAppEuiNew')"
            :input-mode="systemKeyboardEnabled ? 'text' : 'none'"
            placeholder="00:00:00:00:00:00:00:00"
            :disabled="writingAppEui"
          />
          <p class="input-hint">{{ localize('@otaAppEuiInputHint') }}</p>

          <hex-keypad
            :show-space="false"
            :disabled="writingAppEui"
            :system-keyboard-enabled="systemKeyboardEnabled"
            :backspace-label="localize('@toolsHexBackspace')"
            :keypad-label="localize('@toolsHexKeypad')"
            :system-keyboard-label="localize('@toolsSystemKeyboard')"
            @insert="insertHexDigit"
            @backspace="deleteHexDigit"
            @focus-request="focusAppEuiInput"
            @toggle-system-keyboard="toggleSystemKeyboard"
          />

          <ion-button expand="block" :disabled="!canSaveAppEui" @click="confirmAndSaveAppEui">
            <ion-spinner v-if="writingAppEui" slot="start" name="crescent" />
            {{ localize(writingAppEui ? '@otaAppEuiWriting' : '@otaAppEuiSave') }}
          </ion-button>
          <p
            v-if="writeFeedback"
            class="write-feedback"
            :class="{ 'message--error': writeFeedbackError }"
            aria-live="polite"
          >
            {{ writeFeedback }}
          </p>
        </section>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
  IonButton,
  IonContent,
  IonPage,
  IonSpinner,
  alertController,
  onIonViewDidEnter,
  onIonViewDidLeave,
} from '@ionic/vue';
import { useBle } from '@/composables/useBle';
import { useLanguage } from '@/composables/useLanguage';
import EuiInput from '@/components/EuiInput.vue';
import HexKeypad from '@/components/HexKeypad.vue';
import SensorMobileNavigation from '@/components/sensor/SensorMobileNavigation.vue';
import { createBundledTranslations } from '@/utils/localization';
import { formatEuiInput, isCompleteEuiInput } from '@/utils/euiInput';
import {
  readOtaAppEui,
  writeAndVerifyOtaAppEui,
} from '@/utils/BLE/otaAppEui';

const ble = useBle();
const { currentLanguage } = useLanguage();
const languages = createBundledTranslations();
const appEuiInput = ref<InstanceType<typeof EuiInput> | null>(null);
const currentAppEui = ref<string | null>(null);
const newAppEui = ref('');
const systemKeyboardEnabled = ref(false);
const checkingAuthentication = ref(false);
const readingAppEui = ref(false);
const writingAppEui = ref(false);
const currentStatusMessage = ref('');
const currentStatusError = ref(false);
const writeFeedback = ref('');
const writeFeedbackError = ref(false);
let pageActive = false;
let operationSequence = 0;

const localize = (key: string): string => {
  if (!key.startsWith('@')) return key;
  return languages[currentLanguage.value][key.substring(1)] ?? key;
};

const formattedCurrentAppEui = computed(() => formatEuiInput(currentAppEui.value ?? ''));
const canSaveAppEui = computed(() => (
  ble.connected.value
  && ble.osaAuthenticated.value === true
  && currentAppEui.value !== null
  && isCompleteEuiInput(newAppEui.value)
  && newAppEui.value !== currentAppEui.value
  && !readingAppEui.value
  && !writingAppEui.value
));
const canRetryRead = computed(() => (
  ble.connected.value
  && !currentAppEui.value
  && !readingAppEui.value
  && !checkingAuthentication.value
));

function logAppEui(line: string): void {
  console.debug(`[OTA AppEUI] ${line}`);
}

async function readCurrentAppEui(sequence = operationSequence): Promise<void> {
  const deviceId = ble.connectedDevice.value?.deviceId;
  if (!pageActive || !ble.connected.value || !deviceId || readingAppEui.value) return;
  if (ble.osaAuthenticated.value !== true) {
    currentStatusError.value = true;
    currentStatusMessage.value = localize('@otaAppEuiAuthenticationRequired');
    return;
  }

  readingAppEui.value = true;
  currentStatusError.value = false;
  currentStatusMessage.value = localize('@otaAppEuiReading');
  try {
    const value = await readOtaAppEui(deviceId, logAppEui);
    if (!pageActive || sequence !== operationSequence) return;
    currentAppEui.value = value;
    currentStatusMessage.value = '';
  } catch (error: any) {
    if (!pageActive || sequence !== operationSequence) return;
    currentStatusError.value = true;
    currentStatusMessage.value = localize('@otaAppEuiReadError');
    logAppEui(`Read failed: ${error?.message ?? error}`);
  } finally {
    if (sequence === operationSequence) readingAppEui.value = false;
  }
}

async function initializeAppEui(): Promise<void> {
  const sequence = ++operationSequence;
  currentAppEui.value = null;
  writeFeedback.value = '';
  currentStatusError.value = false;

  if (!ble.connected.value || !ble.connectedDevice.value?.deviceId) {
    currentStatusError.value = true;
    currentStatusMessage.value = localize('@otaAppEuiDisconnected');
    return;
  }

  checkingAuthentication.value = true;
  currentStatusMessage.value = localize('@otaAppEuiCheckingAuthentication');
  try {
    const authenticated = await ble.refreshOsaAuthenticationStatus();
    if (!pageActive || sequence !== operationSequence) return;
    if (authenticated !== true) {
      currentStatusError.value = true;
      currentStatusMessage.value = localize('@otaAppEuiAuthenticationRequired');
      return;
    }
  } catch (error: any) {
    if (!pageActive || sequence !== operationSequence) return;
    currentStatusError.value = true;
    currentStatusMessage.value = localize('@otaAppEuiAuthenticationCheckError');
    logAppEui(`Authentication check failed: ${error?.message ?? error}`);
    return;
  } finally {
    if (sequence === operationSequence) checkingAuthentication.value = false;
  }

  await readCurrentAppEui(sequence);
}

function insertHexDigit(value: string): void {
  appEuiInput.value?.insert(value);
}

function deleteHexDigit(): void {
  appEuiInput.value?.backspace();
}

function focusAppEuiInput(): void {
  appEuiInput.value?.focus();
}

async function toggleSystemKeyboard(): Promise<void> {
  systemKeyboardEnabled.value = !systemKeyboardEnabled.value;
  await nextTick();
  appEuiInput.value?.focus();
}

async function confirmAndSaveAppEui(): Promise<void> {
  const deviceId = ble.connectedDevice.value?.deviceId;
  if (!canSaveAppEui.value || !deviceId) return;
  const formattedValue = formatEuiInput(newAppEui.value);
  const alert = await alertController.create({
    header: localize('@otaAppEuiConfirmTitle'),
    message: localize('@otaAppEuiConfirmMessage').replace('{appEui}', formattedValue),
    buttons: [
      { text: localize('@cancel'), role: 'cancel' },
      { text: localize('@otaAppEuiConfirm'), role: 'confirm' },
    ],
  });
  await alert.present();
  const result = await alert.onDidDismiss();
  if (result.role !== 'confirm') return;

  const sequence = ++operationSequence;
  writingAppEui.value = true;
  writeFeedback.value = '';
  writeFeedbackError.value = false;
  try {
    const confirmed = await writeAndVerifyOtaAppEui(deviceId, newAppEui.value, logAppEui);
    if (!pageActive || sequence !== operationSequence) return;
    currentAppEui.value = confirmed;
    newAppEui.value = '';
    writeFeedback.value = localize('@otaAppEuiWriteSuccess');
  } catch (error: any) {
    if (!pageActive || sequence !== operationSequence) return;
    writeFeedbackError.value = true;
    writeFeedback.value = localize('@otaAppEuiWriteError');
    logAppEui(`Write failed: ${error?.message ?? error}`);
  } finally {
    if (sequence === operationSequence) writingAppEui.value = false;
  }
}

onIonViewDidEnter(() => {
  pageActive = true;
  void initializeAppEui();
});

onIonViewDidLeave(() => {
  pageActive = false;
  operationSequence += 1;
  checkingAuthentication.value = false;
  readingAppEui.value = false;
  writingAppEui.value = false;
});

watch(() => ble.connected.value, connected => {
  if (!pageActive) return;
  if (connected) {
    void initializeAppEui();
    return;
  }
  operationSequence += 1;
  currentAppEui.value = null;
  currentStatusError.value = true;
  currentStatusMessage.value = localize('@otaAppEuiDisconnected');
});
</script>

<style scoped>
.ota-app-eui-content {
  --background: var(--app-page-background);
  --padding-top: calc(82px + env(safe-area-inset-top));
}

.ota-app-eui-container {
  display: grid;
  width: min(100%, 720px);
  box-sizing: border-box;
  margin: 0 auto;
  padding: 20px 14px calc(24px + env(safe-area-inset-bottom));
  gap: 14px;
}

.page-heading h1 {
  margin: 0;
  color: var(--app-text);
  font-size: 1.35rem;
}

.app-eui-card {
  padding: 16px 14px;
  border: 1px solid var(--app-border);
  border-radius: 14px;
  background: var(--app-surface);
  box-shadow: var(--app-card-shadow);
}

.app-eui-current {
  display: grid;
  gap: 7px;
}

.app-eui-current > span {
  color: var(--app-text-muted);
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
}

.app-eui-current strong {
  color: var(--app-text);
  font-family: monospace;
  font-size: clamp(1rem, 5vw, 1.25rem);
  letter-spacing: 0.02em;
}

.current-value {
  display: flex;
  align-items: center;
  gap: 9px;
}

.current-value ion-spinner {
  width: 20px;
  height: 20px;
  color: var(--ion-color-primary);
}

.app-eui-current p,
.input-hint,
.write-feedback {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 0.76rem;
  line-height: 1.4;
}

.app-eui-current ion-button {
  justify-self: start;
  margin: 0 0 -6px -8px;
}

.message--error {
  color: var(--ion-color-danger) !important;
}

.app-eui-editor {
  display: grid;
  gap: 10px;
}

.app-eui-editor :deep(.hex-keypad) {
  margin-top: 0;
}

.app-eui-editor ion-button {
  margin: 4px 0 0;
}
</style>
