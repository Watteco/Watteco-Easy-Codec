<template>
  <div
    class="debug-panel"
    v-show="visible"
  >
    <div class="debug-header">
      <strong>BLE debug (fe61 / fe62)</strong>
      <div>
        <ion-button size="small" fill="outline" @click="$emit('start')" :disabled="!connected || subscribed">Start</ion-button>
        <ion-button size="small" fill="outline" color="danger" @click="$emit('stop')" :disabled="!subscribed">Stop</ion-button>
        <ion-button size="small" fill="clear" @click="$emit('clear')">Clear</ion-button>
        <ion-button size="small" fill="solid" color="tertiary" @click="$emit('fetch-model-firmware')" :disabled="!connected">Fetch model/fw</ion-button>
      </div>
    </div>

    <div class="debug-controls">
      <div class="input-row">
        <input
          :value="debugHex"
          @input="$emit('update:debugHex', ($event.target as HTMLInputElement).value)"
          placeholder="Hex (e.g. 01 02)"
          class="debug-input"
        />
      </div>
      <div class="input-row">
        <input
          :value="debugOtaAppKeyHex"
          @input="$emit('update:debugOtaAppKeyHex', ($event.target as HTMLInputElement).value)"
          placeholder="OTA AppKey (16 bytes hex)"
          class="debug-input"
        />
      </div>
      <div class="input-row">
        <input
          :value="debugDevEuiHex"
          @input="$emit('update:debugDevEuiHex', ($event.target as HTMLInputElement).value)"
          placeholder="DevEUI (8 bytes hex)"
          class="debug-input"
        />
      </div>

      <div class="button-row">
        <ion-button size="small" fill="solid" @click="$emit('write-fe62')" :disabled="!connected">Write FE62</ion-button>
        <ion-button size="small" fill="outline" @click="$emit('write-ff01')" :disabled="!connected">Write FF01</ion-button>
        <ion-button size="small" fill="outline" @click="$emit('write-ff02')" :disabled="!connected">Write FF02</ion-button>
      </div>
      <div class="button-row">
        <ion-button size="small" fill="outline" @click="$emit('read-fe61')" :disabled="!connected">Read FE61</ion-button>
        <ion-button size="small" fill="outline" @click="$emit('read-ff01')" :disabled="!connected">Read FF01</ion-button>
        <ion-button size="small" fill="outline" @click="$emit('read-fe21')" :disabled="!connected">Read FE21 (FE20)</ion-button>
      </div>
      <div class="button-row">
        <ion-button size="small" fill="solid" color="tertiary" @click="$emit('read-config-blob')" :disabled="!connected">Read config BLOB</ion-button>
        <ion-button size="small" fill="solid" color="success" @click="$emit('osa-challenge')" :disabled="!connected">OSA Challenge</ion-button>
        <ion-button size="small" fill="solid" color="success" @click="$emit('osa-stored-challenge')" :disabled="!connected">OSA stored key</ion-button>
        <ion-button size="small" fill="clear" @click="$emit('dump-services-only')" :disabled="!connected">Dump services only</ion-button>
        <ion-button size="small" fill="clear" @click="$emit('dump-services')" :disabled="!connected">Dump services</ion-button>
      </div>
      <div class="button-row">
        <ion-button size="small" fill="solid" color="warning" @click="$emit('test-osa-storage')">Test OSA secure store</ion-button>
        <ion-button size="small" fill="outline" @click="$emit('read-osa-storage')">Load OSA key</ion-button>
        <ion-button size="small" fill="outline" color="danger" @click="$emit('delete-osa-storage')">Delete OSA key</ion-button>
        <ion-button size="small" fill="clear" @click="$emit('purge-osa-storage')">Purge expired</ion-button>
      </div>
    </div>

    <div class="logs">
      <div v-for="(line, index) in logs" :key="index">{{ line }}</div>
      <div v-if="logs.length === 0" class="empty-logs">No messages</div>
    </div>
  </div>

  <div class="debug-toggle">
    <ion-button
      size="small"
      fill="solid"
      color="medium"
      @click="$emit('update:visible', !visible)"
      class="debug-toggle-button"
    >
      <span v-if="!visible">DBG</span>
      <span v-else>X</span>
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { IonButton } from '@ionic/vue';

defineProps<{
  visible: boolean;
  logs: string[];
  connected: boolean;
  subscribed: boolean;
  debugHex: string;
  debugOtaAppKeyHex: string;
  debugDevEuiHex: string;
}>();

defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'update:debugHex', value: string): void;
  (e: 'update:debugOtaAppKeyHex', value: string): void;
  (e: 'update:debugDevEuiHex', value: string): void;
  (e: 'start'): void;
  (e: 'stop'): void;
  (e: 'clear'): void;
  (e: 'fetch-model-firmware'): void;
  (e: 'write-fe62'): void;
  (e: 'write-ff01'): void;
  (e: 'write-ff02'): void;
  (e: 'read-fe61'): void;
  (e: 'read-ff01'): void;
  (e: 'read-fe21'): void;
  (e: 'read-config-blob'): void;
  (e: 'osa-challenge'): void;
  (e: 'osa-stored-challenge'): void;
  (e: 'dump-services-only'): void;
  (e: 'dump-services'): void;
  (e: 'test-osa-storage'): void;
  (e: 'read-osa-storage'): void;
  (e: 'delete-osa-storage'): void;
  (e: 'purge-osa-storage'): void;
}>();
</script>

<style scoped>
.debug-panel {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 1000;
  width: 320px;
  max-height: 40vh;
  overflow: auto;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.debug-controls {
  font-size: 12px;
  margin-bottom: 6px;
}

.input-row {
  margin-bottom: 6px;
}

.debug-input {
  width: 100%;
  padding: 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  box-sizing: border-box;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.logs {
  font-family: monospace;
  font-size: 12px;
  line-height: 1.2;
  overflow: auto;
  max-height: 24vh;
  white-space: pre-wrap;
}

.empty-logs {
  color: #666;
}

.debug-toggle {
  position: fixed;
  left: 12px;
  bottom: 12px;
  z-index: 1100;
}

.debug-toggle-button {
  padding: 6px 8px;
}
</style>
