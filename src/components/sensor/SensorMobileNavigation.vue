<template>
  <header
    class="sensor-mobile-header"
    :class="{ 'sensor-mobile-header--disconnected': effectiveStatus !== 'connected' }"
  >
    <img class="sensor-mobile-logo" :src="logoSrc" alt="Watteco" />

    <div v-if="effectiveStatus !== 'choose'" class="sensor-mobile-identity">
      <strong>
        <OverflowMarqueeText :text="displayedProductName" />
      </strong>
      <span class="sensor-mobile-reference">
        <template v-if="displayedProductReference || displayedDevEui">
          <LeadingEllipsisText
            v-if="displayedProductReference"
            class="sensor-mobile-reference-product"
            :text="displayedProductReference"
            :overflow-suffix="displayedProductReferenceSuffix"
          />
          <span
            v-if="displayedProductReference && displayedDevEui"
            class="sensor-mobile-reference-separator"
            aria-hidden="true"
          >&nbsp;&middot;&nbsp;</span>
          <LeadingEllipsisText
            v-if="displayedDevEui"
            class="sensor-mobile-reference-eui"
            :text="displayedDevEui"
            :min-visible-characters="6"
          />
        </template>
        <span v-else class="sensor-mobile-reference-fallback">{{ displayedDeviceName }}</span>
      </span>
      <span class="sensor-mobile-status">
        <ion-spinner
          v-if="isDisconnecting || effectiveStatus === 'loading'"
          class="sensor-mobile-status-icon"
          name="crescent"
          aria-hidden="true"
        />
        <ion-icon
          v-else-if="effectiveStatus === 'reconnect'"
          class="sensor-mobile-status-icon"
          :icon="alertCircleOutline"
          aria-hidden="true"
        />
        <template v-else-if="effectiveStatus === 'connected'">
          <span class="sensor-mobile-network-status" :aria-label="connectedNetworksLabel" aria-live="polite">
            <span
              class="sensor-mobile-signal-bars"
              :class="{ 'sensor-mobile-signal-bars--unknown': effectiveBleSignalLevel === null }"
              aria-hidden="true"
            >
              <span
                v-for="bar in 4"
                :key="bar"
                :class="{ 'sensor-mobile-signal-bar--active': bar <= (effectiveBleSignalLevel ?? 0) }"
              ></span>
            </span>
            <span>BLE</span>
            <ion-icon
              class="sensor-mobile-authentication-icon"
              :class="{
                'sensor-mobile-authentication-icon--unknown': ble.osaAuthenticated.value === null,
              }"
              :icon="authenticationIcon"
              :aria-label="authenticationLabel"
              role="img"
            />
            <span class="sensor-mobile-status-separator" aria-hidden="true">&middot;</span>
            <span
              v-if="effectiveLoraWanJoined !== null"
              class="sensor-mobile-status-dot"
              :class="{ 'sensor-mobile-status-dot--offline': !effectiveLoraWanJoined }"
              aria-hidden="true"
            ></span>
            <span v-else class="sensor-mobile-status-unknown" aria-hidden="true">?</span>
            <span>LoRaWAN</span>
          </span>
        </template>
        <span
          v-if="effectiveStatus !== 'connected' || isDisconnecting"
          class="sensor-mobile-status-label"
          aria-live="polite"
        >{{ statusLabel }}</span>
        <span
          v-if="effectiveStatus === 'connected' && displayedBatteryLevel !== null"
          class="sensor-mobile-battery"
          :aria-label="`${localize('@batteryLevelLabel')}: ${displayedBatteryLevel}%`"
        >
          <span class="sensor-mobile-battery-gauge" aria-hidden="true">
            <span
              class="sensor-mobile-battery-level"
              :style="{ width: `${displayedBatteryLevel}%` }"
            ></span>
          </span>
          {{ displayedBatteryLevel }}%
        </span>
      </span>
    </div>
    <div v-else class="sensor-mobile-identity sensor-mobile-identity--empty">
      <strong>{{ localize('@noSensorConnected') }}</strong>
    </div>

    <div class="sensor-mobile-header-actions">
      <button
        type="button"
        class="sensor-mobile-header-action"
        :class="{ 'sensor-mobile-header-action--pending': isDisconnecting }"
        :aria-label="headerActionLabel"
        :aria-busy="isDisconnecting || ble.reconnecting.value"
        :disabled="headerActionDisabled"
        @click="handleHeaderAction"
      >
        <ion-spinner
          v-if="ble.reconnecting.value || (isDisconnecting && (effectiveStatus === 'connected' || effectiveStatus === 'loading'))"
          name="crescent"
        />
        <ion-icon v-else :icon="headerActionIcon" aria-hidden="true" />
      </button>

      <button
        v-if="effectiveStatus === 'reconnect'"
        type="button"
        class="sensor-mobile-header-action"
        :class="{ 'sensor-mobile-header-action--pending': isDisconnecting }"
        :aria-label="isDisconnecting ? localize('@sessionExiting') : localize('@sessionExit')"
        :aria-busy="isDisconnecting"
        :disabled="isDisconnecting"
        @click="requestSessionExit"
      >
        <ion-spinner v-if="isDisconnecting" name="crescent" />
        <ion-icon v-else :icon="logOutOutline" aria-hidden="true" />
      </button>
    </div>
  </header>

</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonIcon, IonSpinner, alertController, toastController } from '@ionic/vue';
import {
  alertCircleOutline,
  bluetoothOutline,
  lockClosed,
  lockOpenOutline,
  logOutOutline,
  refreshOutline,
} from 'ionicons/icons';
import { useBle } from '@/composables/useBle';
import { useSessionExitConfirmation } from '@/composables/useSessionExitConfirmation';
import LeadingEllipsisText from '@/components/LeadingEllipsisText.vue';
import OverflowMarqueeText from '@/components/OverflowMarqueeText.vue';
import { getProductDisplayName, getProductMeasurements } from '@/utils/productMeasurements';
import { getSensorVisual } from '@/utils/sensorVisuals';
import { deriveDevEuiFromDeviceName } from '@/utils/BLE/deviceIdentity';
import type { BleSignalLevel } from '@/utils/BLE/rssi';

type SensorPage = 'data' | 'config' | 'tools';
type ConnectionStatus = 'connected' | 'loading' | 'reconnect' | 'choose';
type LoraWanStatus = 'joined' | 'not-joined' | 'unknown';

const props = defineProps<{
  activePage: SensorPage;
  localize: (key: string) => string;
  status?: ConnectionStatus;
  deviceName?: string;
  batteryLevel?: number;
  loraWanStatus?: LoraWanStatus;
  bleSignalLevel?: BleSignalLevel;
}>();

const router = useRouter();
const ble = useBle();
const { confirmationEnabled, setConfirmationEnabled } = useSessionExitConfirmation();
const isDisconnecting = ref(false);
const logoSrc = `${import.meta.env.BASE_URL}img/icon.png`;

const actualStatus = computed<ConnectionStatus>(() => {
  if (ble.connectionPhase.value === 'discovering') return 'loading';
  if (ble.connected.value) return 'connected';
  return ble.lastConnectedDevice.value ? 'reconnect' : 'choose';
});

const effectiveStatus = computed(() => props.status ?? actualStatus.value);
const effectiveLoraWanJoined = computed<boolean | null>(() => {
  if (props.loraWanStatus === 'joined') return true;
  if (props.loraWanStatus === 'not-joined') return false;
  if (props.loraWanStatus === 'unknown') return null;
  return ble.loraWanJoined.value;
});
const effectiveBleSignalLevel = computed<BleSignalLevel | null>(() => (
  props.bleSignalLevel ?? ble.bleSignalLevel.value
));
const authenticationIcon = computed(() => {
  if (ble.osaAuthenticated.value === true) return lockOpenOutline;
  return lockClosed;
});
const authenticationLabel = computed(() => props.localize(
  ble.osaAuthenticated.value === true
    ? '@toolsOsaAuthenticated'
    : ble.osaAuthenticated.value === false
      ? '@toolsOsaNotAuthenticated'
      : '@toolsOsaAuthenticationUnknown',
));
const displayedDeviceName = computed(() => {
  if (props.deviceName) return props.deviceName;
  const device = ble.connectedDevice.value ?? ble.lastConnectedDevice.value;
  return device ? ble.getDeviceName(device) : props.localize('@sensor');
});
const displayedDevEui = computed(() => {
  const device = ble.connectedDevice.value ?? ble.lastConnectedDevice.value;
  return deriveDevEuiFromDeviceName(props.deviceName)
    ?? device?.devEui
    ?? deriveDevEuiFromDeviceName(device?.name);
});
const displayedProductName = computed(() => (
  getProductDisplayName(ble.productReference.value) ?? displayedDeviceName.value
));
const displayedProductReference = computed(() => ble.productReference.value);
const displayedProductReferenceSuffix = computed(() => {
  const reference = displayedProductReference.value;
  if (!reference || !/^50-70(?:-|$)/.test(reference)) return undefined;
  return reference.slice('50-70'.length);
});
const displayedBatteryLevel = computed(() => {
  const batteryMeasurementCount = getProductMeasurements(ble.productReference.value)
    .filter(measurement => getSensorVisual(measurement.measId).category === 'battery')
    .length;
  const level = props.batteryLevel ?? ble.measurementValues.value.battery_level_percent;

  if (batteryMeasurementCount !== 1 || typeof level !== 'number' || !Number.isFinite(level)) {
    return null;
  }

  return Math.round(Math.min(100, Math.max(0, level)));
});
const statusLabel = computed(() => {
  if (isDisconnecting.value) {
    return props.localize(effectiveStatus.value === 'reconnect'
      ? '@sessionExiting'
      : '@bleDisconnecting');
  }
  if (effectiveStatus.value === 'loading') return props.localize('@bleLoading');
  if (effectiveStatus.value === 'connected') return props.localize('@bleConnected');
  if (effectiveStatus.value === 'reconnect') {
    return props.localize(ble.reconnecting.value ? '@bleReconnecting' : '@bleConnectionLost');
  }
  return props.localize('@bleNotConnected');
});
const connectedNetworksLabel = computed(() => {
  const bleSignal = effectiveBleSignalLevel.value === null
    ? props.localize('@bleSignalUnavailable')
    : props.bleSignalLevel === undefined && ble.bleRssi.value !== null
      ? `${props.localize('@bleSignalStrength')}: ${effectiveBleSignalLevel.value}/4 (${ble.bleRssi.value} dBm)`
      : `${props.localize('@bleSignalStrength')}: ${effectiveBleSignalLevel.value}/4`;
  const loraWanStatus = effectiveLoraWanJoined.value === null
    ? props.localize('@loraWanStatusUnknown')
    : props.localize(effectiveLoraWanJoined.value ? '@loraWanJoined' : '@loraWanNotJoined');
  return `${props.localize('@bleConnected')}. ${bleSignal}. ${loraWanStatus}`;
});
const headerActionLabel = computed(() => {
  if (isDisconnecting.value) return props.localize('@bleDisconnecting');
  if (effectiveStatus.value === 'connected' || effectiveStatus.value === 'loading') {
    return props.localize('@bleDisconnect');
  }
  if (effectiveStatus.value === 'reconnect') return props.localize('@bleReconnect');
  return props.localize('@chooseSensor');
});
const headerActionIcon = computed(() => {
  if (effectiveStatus.value === 'connected' || effectiveStatus.value === 'loading') return logOutOutline;
  if (effectiveStatus.value === 'reconnect') return refreshOutline;
  return bluetoothOutline;
});
const headerActionDisabled = computed(() => (
  isDisconnecting.value || (ble.pairing.value && !ble.reconnecting.value)
));

const presentReconnectWaitingToast = async () => {
  const toast = await toastController.create({
    message: props.localize('@bleConnectionWaiting'),
    duration: 0,
    position: 'bottom',
    positionAnchor: 'sensor-mobile-tabs',
    cssClass: 'connection-waiting-toast',
  });
  await toast.present();
  return toast;
};

const handleHeaderAction = async () => {
  if (effectiveStatus.value === 'connected' || effectiveStatus.value === 'loading') {
    await requestSessionExit();
    return;
  }

  if (effectiveStatus.value === 'reconnect') {
    if (ble.reconnecting.value) {
      await ble.cancelReconnect();
      return;
    }
    const waitingToast = await presentReconnectWaitingToast();
    try {
      await ble.reconnectToLastDevice();
    } finally {
      await waitingToast.dismiss();
    }
    return;
  }

  await router.replace('/ble-connect');
};

const confirmSessionExit = async (): Promise<boolean> => {
  if (!confirmationEnabled.value) return true;

  const connected = effectiveStatus.value === 'connected' || effectiveStatus.value === 'loading';
  const alert = await alertController.create({
    header: props.localize(connected ? '@bleDisconnectConfirmTitle' : '@sessionExitConfirmTitle'),
    message: props.localize('@sessionExitWarning'),
    inputs: [
      {
        type: 'checkbox',
        label: props.localize('@doNotAskAgain'),
        value: 'do-not-ask-again',
      },
    ],
    buttons: [
      {
        text: props.localize('@cancel'),
        role: 'cancel',
      },
      {
        text: props.localize(connected ? '@bleDisconnect' : '@sessionExit'),
        role: 'confirm',
        handler: (values: string[]) => {
          if (values.includes('do-not-ask-again')) {
            setConfirmationEnabled(false);
          }
        },
      },
    ],
  });

  await alert.present();
  const result = await alert.onDidDismiss();
  return result.role === 'confirm';
};

const requestSessionExit = async () => {
  if (isDisconnecting.value || !(await confirmSessionExit())) return;
  await disconnectAndGoBack();
};

const disconnectAndGoBack = async () => {
  if (isDisconnecting.value) return;

  isDisconnecting.value = true;
  await nextTick();

  try {
    await ble.cancelConnect();
    await ble.cancelReconnect();
    await ble.disconnect();
    await router.replace('/ble-connect');
  } finally {
    isDisconnecting.value = false;
  }
};

</script>

<style scoped>
:global(.connection-waiting-toast::part(message)) {
  white-space: pre-line;
}

.sensor-mobile-header {
  box-sizing: border-box;
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1000;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  height: calc(82px + env(safe-area-inset-top));
  min-height: calc(82px + env(safe-area-inset-top));
  padding: calc(10px + env(safe-area-inset-top)) 12px 10px;
  overflow: hidden;
  color: var(--ion-color-primary-contrast);
  background: var(--ion-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
}

.sensor-mobile-header--disconnected {
  color: var(--ion-color-warning-contrast);
  background: var(--ion-color-warning);
}

.sensor-mobile-logo {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border: 1px solid #fff;
  border-radius: 9px;
}

.sensor-mobile-identity {
  display: grid;
  min-width: 0;
  line-height: 1.15;
}

.sensor-mobile-identity strong {
  overflow: hidden;
  font-size: 1rem;
  white-space: nowrap;
}

.sensor-mobile-reference {
  display: flex;
  min-width: 0;
  overflow: hidden;
  margin-top: 2px;
  font-size: 0.78rem;
  font-weight: 600;
  opacity: 0.82;
  white-space: nowrap;
}

.sensor-mobile-reference-separator {
  flex: 0 0 auto;
}

.sensor-mobile-reference-product {
  /* The DevEUI's measured minimum protects its last six characters; the
     reference yields the remaining space when the row gets narrower. */
  flex: 0 1 auto;
  min-width: 0;
}

.sensor-mobile-reference-eui {
  flex: 1 1 auto;
}

.sensor-mobile-reference-fallback {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sensor-mobile-status {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin-top: 5px;
  font-size: 0.76rem;
  white-space: nowrap;
}

.sensor-mobile-status-dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border: 1px solid currentColor;
  border-radius: 50%;
  background: #4bd37b;
}

.sensor-mobile-signal-bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 1px;
  width: 15px;
  height: 12px;
}

.sensor-mobile-signal-bars > span {
  width: 3px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 1px 1px 0 0;
}

.sensor-mobile-signal-bars > span:nth-child(1) { height: 3px; }
.sensor-mobile-signal-bars > span:nth-child(2) { height: 6px; }
.sensor-mobile-signal-bars > span:nth-child(3) { height: 9px; }
.sensor-mobile-signal-bars > span:nth-child(4) { height: 12px; }

.sensor-mobile-signal-bars > .sensor-mobile-signal-bar--active {
  background: #4bd37b;
}

.sensor-mobile-signal-bars--unknown {
  opacity: 0.7;
}

.sensor-mobile-network-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.sensor-mobile-authentication-icon {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  transform: translateY(-1px);
}

.sensor-mobile-authentication-icon--unknown {
  opacity: 0.55;
}

.sensor-mobile-status-dot--offline {
  background: var(--ion-color-danger, #ff0000);
}

.sensor-mobile-status-unknown {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 11px;
  height: 11px;
  color: var(--ion-color-medium-contrast, #fff);
  background: var(--ion-color-medium, #92949c);
  border-radius: 50%;
  font-size: 8px;
  font-weight: 800;
  line-height: 1;
}

.sensor-mobile-status-separator {
  margin: 0 1px;
  opacity: 0.75;
}

.sensor-mobile-status-icon {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
}

.sensor-mobile-status-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sensor-mobile-battery {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-left: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.sensor-mobile-battery-gauge {
  box-sizing: border-box;
  position: relative;
  display: inline-flex;
  width: 15px;
  height: 9px;
  padding: 1px;
  border: 1px solid currentColor;
  border-radius: 2px;
}

.sensor-mobile-battery-gauge::after {
  position: absolute;
  top: 50%;
  right: -3px;
  width: 2px;
  height: 5px;
  border-radius: 0 1px 1px 0;
  background: currentColor;
  content: '';
  transform: translateY(-50%);
}

.sensor-mobile-battery-level {
  display: block;
  max-width: 100%;
  height: 100%;
  border-radius: 1px;
  background: currentColor;
  transition: width 180ms ease-out;
}

.sensor-mobile-header--disconnected .sensor-mobile-status-dot {
  background: transparent;
}

.sensor-mobile-header-actions {
  display: flex;
  gap: 8px;
}

.sensor-mobile-header-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 44px;
  height: 44px;
  padding: 0;
  color: inherit;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 50%;
  transition: background-color 120ms ease, opacity 120ms ease, transform 80ms ease;
}

.sensor-mobile-header-action:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(0.92);
}

.sensor-mobile-header-action--pending {
  background: rgba(255, 255, 255, 0.28);
}

.sensor-mobile-header-action:disabled {
  opacity: 0.55;
}

.sensor-mobile-header-action ion-icon,
.sensor-mobile-header-action ion-spinner {
  width: 22px;
  height: 22px;
}

@media (max-width: 380px) {
  .sensor-mobile-header {
    gap: 8px;
    padding-right: 10px;
    padding-left: 10px;
  }

  .sensor-mobile-logo {
    width: 44px;
    height: 44px;
  }

  .sensor-mobile-header-actions {
    gap: 6px;
  }

  .sensor-mobile-header-action {
    width: 40px;
    height: 40px;
  }
}

</style>
