<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-img
          id="watteco-logo"
          :src="logoSrc"
        />
        <ion-title size="large" id="watteco-title">
          BLE Connection
        </ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ble-connect-content" :fullscreen="true">
      <div class="ble-connect-container">

        <!-- Status chip -->
        <ion-chip
          :color="ble.connected.value ? 'success' : 'medium'"
          class="ble-chip"
        >
          <ion-icon :icon="bluetoothOutline" />
          <ion-label>
            {{ ble.connected.value
              ? 'Connected to ' + ble.getDeviceName(ble.connectedDevice.value!)
              : 'Not connected' }}
          </ion-label>
        </ion-chip>

        <!-- Scan button -->
        <ion-button
          v-if="!ble.connected.value && !ble.scanning.value"
          @click="ble.startAutoScan()"
          expand="block"
          class="scan-button"
        >
          <ion-icon slot="start" :icon="searchOutline" />
          Scan for devices
        </ion-button>

        <ion-button
          v-else-if="!ble.connected.value && ble.scanning.value"
          @click="ble.cancelScan()"
          expand="block"
          color="medium"
          class="scan-button"
        >
          <ion-icon slot="start" :icon="searchOutline" />
          Scanning… (Cancel)
        </ion-button>

        <!-- Device list -->
        <ion-list v-if="!ble.connected.value && ble.devices.value.length" class="device-list">
          <ion-list-header>
            <ion-label>Devices found</ion-label>
          </ion-list-header>
          <ion-item
            v-for="dev in ble.devices.value"
            :key="dev.deviceId"
            button
            @click="onDeviceSelect(dev)"
            :disabled="connecting"
          >
            <ion-icon :icon="bluetoothOutline" slot="start" color="primary" />
            <ion-label>
              <h2>{{ ble.getDeviceName(dev) }}</h2>
              <p>{{ dev.deviceId }}</p>
            </ion-label>
            <ion-spinner v-if="connecting && connectingDeviceId === dev.deviceId" slot="end" name="crescent" />
          </ion-item>
        </ion-list>

        <!-- Empty state -->
        <div
          v-if="!ble.connected.value && !ble.scanning.value && ble.devices.value.length === 0"
          class="empty-state"
        >
          <ion-icon :icon="bluetoothOutline" class="empty-icon" />
          <p>Tap <strong>Scan</strong> to find nearby BLE devices</p>
        </div>

        <!-- Connected — proceed button -->
        <div v-if="ble.connected.value" class="connected-actions">
          <ion-button expand="block" color="primary" @click="proceed" class="proceed-button">
            <ion-icon slot="start" :icon="arrowForwardOutline" />
            Open Easy Codec
          </ion-button>
          <ion-button
            expand="block"
            fill="outline"
            color="danger"
            @click="ble.disconnect()"
            class="disconnect-button"
          >
            Disconnect
          </ion-button>
        </div>

        <!-- Status message -->
        <div v-if="ble.statusMessage.value" class="status-msg">
          <ion-note>{{ ble.statusMessage.value }}</ion-note>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonChip, IonIcon, IonLabel, IonList, IonListHeader,
  IonItem, IonNote, IonSpinner, IonImg, IonToggle,
} from '@ionic/vue';
import { bluetoothOutline, searchOutline, arrowForwardOutline } from 'ionicons/icons';
import { useBle } from '@/composables/useBle';
import type { BleDevice } from '@capacitor-community/bluetooth-le';

const ble = useBle();
const router = useRouter();
const logoSrc = ref('');
const connecting = ref(false);
const connectingDeviceId = ref('');

onMounted(async () => {
  logoSrc.value = `${import.meta.env.BASE_URL}img/LOGO-WATTECO_v2021_wbg_ctr.png`;
  await ble.initialize();
});

async function onDeviceSelect(dev: BleDevice) {
  connecting.value = true;
  connectingDeviceId.value = dev.deviceId;
  await ble.connectToDevice(dev);
  connecting.value = false;
  connectingDeviceId.value = '';
}

function proceed() {
  router.replace('/tabs/downlink');
}
</script>

<style scoped>
.ble-connect-content {
  --background: #FFF7EE;
}

.ble-connect-container {
  max-width: 500px;
  margin: 0 auto;
  padding: 24px 16px;
}

.ble-chip {
  display: flex;
  margin: 0 auto 20px;
  font-size: 1rem;
}

.scan-button {
  margin-bottom: 12px;
}

.filter-toggle {
  --background: transparent;
  margin-bottom: 12px;
  font-size: 0.9rem;
}

.device-list {
  background: transparent;
  margin-bottom: 16px;
}

.device-list ion-item {
  --background: white;
  border-radius: 8px;
  margin-bottom: 6px;
  --padding-start: 12px;
}

.device-list ion-item h2 {
  font-weight: 600;
}

.device-list ion-item p {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.empty-state {
  text-align: center;
  padding: 40px 16px;
  color: var(--ion-color-medium);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 12px;
  opacity: 0.4;
}

.connected-actions {
  margin-top: 24px;
}

.proceed-button {
  margin-bottom: 12px;
  font-size: 1.1rem;
  --padding-top: 16px;
  --padding-bottom: 16px;
}

.disconnect-button {
  margin-bottom: 12px;
}

.status-msg {
  text-align: center;
  margin-top: 16px;
  font-size: 0.85em;
  color: var(--ion-color-medium);
}

/* Reuse watteco header styles */
#watteco-logo {
  width: 70px;
  height: auto;
  position: absolute;
  top: 18px;
  left: 10px;
}

#watteco-title {
  font-size: 1.2rem;
  position: relative;
  left: 90px;
  font-weight: bold;
}

ion-toolbar {
  --background: var(--ion-color-primary);
  --color: white;
  --min-height: 60px;
  --padding-top: 10px;
  --padding-bottom: 10px;
}
</style>
