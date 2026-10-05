<template>
  <header
    class="sensor-mobile-header"
    :class="{ 'sensor-mobile-header--disconnected': effectiveStatus !== 'connected' }"
  >
    <img class="sensor-mobile-logo" :src="logoSrc" alt="Watteco" />

    <div v-if="effectiveStatus !== 'choose'" class="sensor-mobile-identity">
      <strong>{{ displayedProductName }}</strong>
      <span class="sensor-mobile-reference">
        <template v-if="effectiveStatus === 'connected'">
          {{ displayedProductReference }}
          <template v-if="displayedDeviceName"> · {{ displayedDeviceName }}</template>
        </template>
        <template v-else>{{ displayedDeviceName }}</template>
      </span>
      <span class="sensor-mobile-status">
        <ion-spinner
          v-if="isDisconnecting"
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
            <span class="sensor-mobile-status-dot" aria-hidden="true"></span>
            <span>BLE</span>
            <span class="sensor-mobile-status-separator" aria-hidden="true">&middot;</span>
            <span
              v-if="ble.loraWanJoined.value !== null"
              class="sensor-mobile-status-dot"
              :class="{ 'sensor-mobile-status-dot--offline': !ble.loraWanJoined.value }"
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
          v-if="ble.reconnecting.value || (isDisconnecting && effectiveStatus === 'connected')"
          name="crescent"
        />
        <ion-icon v-else :icon="headerActionIcon" aria-hidden="true" />
      </button>

      <button
        v-if="effectiveStatus === 'reconnect'"
        type="button"
        class="sensor-mobile-header-action"
        :class="{ 'sensor-mobile-header-action--pending': isDisconnecting }"
        :aria-label="isDisconnecting ? localize('@bleDisconnecting') : localize('@bleDisconnect')"
        :aria-busy="isDisconnecting"
        :disabled="isDisconnecting"
        @click="disconnectAndGoBack"
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
import { IonIcon, IonSpinner } from '@ionic/vue';
import {
  alertCircleOutline,
  bluetoothOutline,
  logOutOutline,
  refreshOutline,
} from 'ionicons/icons';
import { useBle } from '@/composables/useBle';
import { getProductDisplayName, getProductMeasurements } from '@/utils/productMeasurements';
import { getSensorVisual } from '@/utils/sensorVisuals';

type SensorPage = 'data' | 'config' | 'tools';
type ConnectionStatus = 'connected' | 'reconnect' | 'choose';

const props = defineProps<{
  activePage: SensorPage;
  localize: (key: string) => string;
  status?: ConnectionStatus;
  deviceName?: string;
  batteryLevel?: number;
}>();

const router = useRouter();
const ble = useBle();
const isDisconnecting = ref(false);
const logoSrc = `${import.meta.env.BASE_URL}img/icon.png`;

const actualStatus = computed<ConnectionStatus>(() => {
  if (ble.connected.value) return 'connected';
  return ble.lastConnectedDevice.value ? 'reconnect' : 'choose';
});

const effectiveStatus = computed(() => props.status ?? actualStatus.value);
const displayedDeviceName = computed(() => {
  if (props.deviceName) return props.deviceName;
  const device = ble.connectedDevice.value ?? ble.lastConnectedDevice.value;
  return device ? ble.getDeviceName(device) : props.localize('@sensor');
});
const displayedProductReference = computed(() => ble.productReference.value ?? '50-70-…');
const displayedProductName = computed(() => (
  getProductDisplayName(ble.productReference.value) ?? props.localize('@sensor')
));
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
  if (isDisconnecting.value) return props.localize('@bleDisconnecting');
  if (effectiveStatus.value === 'connected') return props.localize('@bleConnected');
  if (effectiveStatus.value === 'reconnect') return props.localize('@bleConnectionLost');
  return props.localize('@bleNotConnected');
});
const connectedNetworksLabel = computed(() => {
  const loraWanStatus = ble.loraWanJoined.value === null
    ? props.localize('@loraWanStatusUnknown')
    : props.localize(ble.loraWanJoined.value ? '@loraWanJoined' : '@loraWanNotJoined');
  return `${props.localize('@bleConnected')}. ${loraWanStatus}`;
});
const headerActionLabel = computed(() => {
  if (isDisconnecting.value) return props.localize('@bleDisconnecting');
  if (effectiveStatus.value === 'connected') return props.localize('@bleDisconnect');
  if (effectiveStatus.value === 'reconnect') return props.localize('@bleReconnect');
  return props.localize('@chooseSensor');
});
const headerActionIcon = computed(() => {
  if (effectiveStatus.value === 'connected') return logOutOutline;
  if (effectiveStatus.value === 'reconnect') return refreshOutline;
  return bluetoothOutline;
});
const headerActionDisabled = computed(() => (
  isDisconnecting.value || (ble.pairing.value && !ble.reconnecting.value)
));

const handleHeaderAction = async () => {
  if (effectiveStatus.value === 'connected') {
    await disconnectAndGoBack();
    return;
  }

  if (effectiveStatus.value === 'reconnect') {
    if (ble.reconnecting.value) {
      await ble.cancelReconnect();
      return;
    }
    await ble.reconnectToLastDevice();
    return;
  }

  await router.replace('/ble-connect');
};

const disconnectAndGoBack = async () => {
  if (isDisconnecting.value) return;

  isDisconnecting.value = true;
  await nextTick();

  try {
    await ble.cancelReconnect();
    await ble.disconnect();
    await router.replace('/ble-connect');
  } finally {
    isDisconnecting.value = false;
  }
};

</script>

<style scoped>
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
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sensor-mobile-reference {
  overflow: hidden;
  margin-top: 2px;
  font-size: 0.78rem;
  font-weight: 600;
  opacity: 0.82;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.sensor-mobile-network-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
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
