<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="card-container">
        <div class="two-column-grid">
          <!-- Endpoint Card -->
          <ion-card class="field-card half-width">
            <ion-card-content>
              <ion-item>
                <ion-label position="stacked">{{ localize('@modbusEndpoint') }}</ion-label>
                <ion-input
                  type="number"
                  v-model="endpoint"
                  :min="0"
                  :max="9"
                  :value="0"
                ></ion-input>
              </ion-item>
            </ion-card-content>
          </ion-card>

          <!-- Slave Address Card -->
          <ion-card class="field-card half-width">
            <ion-card-content>
              <ion-item>
                <ion-label position="stacked">{{ localize('@modbusSlaveAddress') }}</ion-label>
                <ion-input
                  type="number"
                  v-model="slaveAddress"
                  :min="0"
                  :max="247"
                  :value="1"
                ></ion-input>
              </ion-item>
            </ion-card-content>
          </ion-card>

          <!-- Function Code Card -->
          <ion-card class="field-card half-width">
            <ion-card-content>
              <ion-item>
                <ion-label position="stacked">{{ localize('@functionCode') }}</ion-label>
                <ion-select 
                  v-model="functionCode" 
                  interface="popover"
                  :placeholder="selectedFunctionCodeLabel"
                >
                  <ion-select-option 
                    v-for="option in functionCodeOptions" 
                    :key="option.value" 
                    :value="option.value"
                  >
                    {{ option.label }}
                  </ion-select-option>
                </ion-select>
              </ion-item>
            </ion-card-content>
          </ion-card>

          <!-- Start Address Card -->
          <ion-card class="field-card half-width">
            <ion-card-content>
              <ion-item>
                <ion-label position="stacked">{{ localize('@startAddress') }}</ion-label>
                <ion-input
                  type="number"
                  v-model="startAddress"
                  :min="0"
                  :max="65535"
                  :value="0"
                ></ion-input>
              </ion-item>
            </ion-card-content>
          </ion-card>

          <!-- Number of Registers Card -->
          <ion-card class="field-card half-width">
            <ion-card-content>
              <ion-item>
                <ion-label position="stacked">{{ localize('@numRegisters') }}</ion-label>
                <ion-input
                  type="number"
                  v-model="numRegisters"
                  :min="1"
                  :max="125"
                  :value="1"
                ></ion-input>
              </ion-item>
            </ion-card-content>
          </ion-card>
        
          <!-- Endianness -->
          <ion-card class="field-card half-width">
            <ion-card-content>
              <ion-item>
                <ion-label position="stacked">{{ localize('@littleEndian') }}</ion-label>
                <ion-toggle position="right" v-model="isLittleEndian"></ion-toggle>
              </ion-item>
            </ion-card-content>
          </ion-card>
        </div>

        <!-- Data to Write Card -->
        <ion-card 
          class="field-card write-data-card" 
          v-if="isWriteOperation"
        >
          <ion-card-content>
            <ion-item class="write-data-item">
              <ion-label position="stacked" color="dark">{{ localize('@dataToWrite') }}</ion-label>
              <ion-input
                type="text"
                v-model="writeData"
                :placeholder="localize('@hexValueExample')"
                class="write-data-input"
              ></ion-input>
            </ion-item>
          </ion-card-content>
        </ion-card>

        <!-- Result Card -->
        <ion-card class="action-card" v-show="generatedFrame">
          <ion-card-header>
            <ion-card-title>{{ localize('@generatedFrame') }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="frame-output">{{ generatedFrame }}</div>
            <ion-button 
              expand="block"
              @click="copyFrame"
            >
              {{ localize('@copyToClipboard') }}
            </ion-button>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
    <div class="language-switcher">
      <LanguageSwitcher 
        :current-language="currentLanguage"
        @update:language="changeLanguage"
      />
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import axios from 'axios';
import {
  IonPage,
  IonContent,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonButton,
} from '@ionic/vue';

const endpoint = ref(0);
const slaveAddress = ref(1);
const functionCode = ref('0x03');
const startAddress = ref(0);
const numRegisters = ref(1);
const writeData = ref('');
const isLittleEndian = ref(false);
const generatedFrame = ref('');

const endpointMapping = {
  0: '11',
  1: '31',
  2: '51',
  3: '71',
  4: '91',
  5: 'B1',
  6: 'D1',
  7: 'F1',
  8: '13',
  9: '33'
};

watch(
  [endpoint, slaveAddress, functionCode, startAddress, numRegisters, writeData, isLittleEndian],
  () => {
    let frame = [];
    // Add endpoint prefix
    const endpointPrefix = `${endpointMapping[endpoint.value]} 05 8007 0000 41 06`;
    frame.push(endpointPrefix);
    
    frame.push(parseInt(slaveAddress.value.toString()).toString(16).padStart(2, '0'));
    frame.push(functionCode.value.substring(2).padStart(2, '0'));
    frame.push(parseInt(startAddress.value.toString()).toString(16).padStart(4, '0'));

    if (['0x03', '0x04', '0x10'].includes(functionCode.value)) {
      frame.push(parseInt(numRegisters.value.toString()).toString(16).padStart(4, '0'));
    }

    if (['0x06', '0x10'].includes(functionCode.value) && writeData.value) {
      let data = parseInt(writeData.value, 16).toString(16).padStart(4, '0');
      if (isLittleEndian.value) {
        data = data.match(/.{2}/g).reverse().join('');
      }
      frame.push(data);
    }

    generatedFrame.value = frame.join(' ').toUpperCase();
  },
  { immediate: true }
);

const copyFrame = async () => {
  try {
    await navigator.clipboard.writeText(generatedFrame.value.replace(/\s+/g, ''));
    console.log('Frame copied to clipboard');
  } catch (err) {
    console.error('Failed to copy frame:', err);
  }
};

// Language related code
const currentLanguage = ref('en');
const languages = ref({ en: {}, fr: {} });

// Import language files
import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

// Function to generate cache buster
const generateCacheBuster = () => {
  return `?v=${new Date().getTime()}`;
};

// Load localization files
const loadLocalizationFiles = async () => {
  try {
    const enResponse = await axios.get(enUS + generateCacheBuster());
    const frResponse = await axios.get(frFR + generateCacheBuster());
    languages.value.en = enResponse.data;
    languages.value.fr = frResponse.data;
  } catch (error) {
    console.error('Failed to load localization files:', error);
  }
};

// Localization helper function
const localize = (key: string): string => {
  const currentLang = languages.value[currentLanguage.value];
  if (!key.startsWith('@')) return key;
  const translationKey = key.substring(1);
  return currentLang[translationKey] || key;
};

// Change language function
const changeLanguage = (language: string) => {
  currentLanguage.value = language;
};

// Load localizations on mount
onMounted(() => {
  loadLocalizationFiles().then(() => {
    const browserLanguage = navigator.language.split('-')[0];
    if (languages.value[browserLanguage]) {
      currentLanguage.value = browserLanguage;
    }
  });
});

const functionCodeOptions = computed(() => [
  { value: '0x01', label: `0x01 - ${localize('@readCoils')}` },
  { value: '0x02', label: `0x02 - ${localize('@readDiscreteInputs')}` },
  { value: '0x03', label: `0x03 - ${localize('@readHoldingRegisters')}` },
  { value: '0x04', label: `0x04 - ${localize('@readInputRegisters')}` },
  { value: '0x05', label: `0x05 - ${localize('@writeSingleCoil')}` },
  { value: '0x06', label: `0x06 - ${localize('@writeSingleRegister')}` },
  { value: '0x0F', label: `0x0F - ${localize('@writeMultipleCoils')}` },
  { value: '0x10', label: `0x10 - ${localize('@writeMultipleRegisters')}` },
]);

const selectedFunctionCodeLabel = computed(() => {
  const option = functionCodeOptions.value.find(opt => opt.value === functionCode.value);
  return option ? option.label : '';
});

const isWriteOperation = computed(() => {
  return ['0x06', '0x10'].includes(functionCode.value);
});
</script>

<style scoped>
.card-container {
  max-width: 800px;
  margin: 20px auto;
  padding: 0 15px;
}

.field-card,
.action-card,
.output-card {
  margin: 10px 0;
  --background: var(--ion-color-darkGrey);
  --color: var(--ion-color-darkGrey-contrast);
}

.frame-output {
  font-family: 'Courier New', Courier, monospace;
  font-weight: bold;
  font-size: 1.2em;
  padding: 15px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 5px;
  margin-bottom: 15px;
  word-break: break-all;
}

ion-item {
  --background: transparent;
  --border-color: rgba(255, 255, 255, 0.1);
}

ion-button {
  margin-top: 10px;
}

ion-card-title {
  color: var(--ion-color-darkGrey-contrast);
}

ion-label {
  color: var(--ion-color-darkGrey-contrast) !important;
}

ion-input, ion-select {
  --color: var(--ion-color-darkGrey-contrast);
  --placeholder-color: rgba(255, 255, 255, 0.6);
}

ion-toggle {
  --background: rgba(255, 255, 255, 0.1);
  --background-checked: var(--ion-color-primary);
  padding: 15px 0;
}

.two-column-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 10px;
}

.half-width {
  margin: 0;
}

/* Ajout des styles pour le select */
ion-select::part(placeholder),
ion-select::part(text) {
  color: var(--ion-color-darkGrey-contrast);
  opacity: 1;
}

/* Style pour l'icône du select */
ion-select::part(icon) {
  color: var(--ion-color-darkGrey-contrast);
  opacity: 0.8;
}

/* Style pour les options du popover */
:root {
  --ion-color-step-150: var(--ion-color-darkGrey);
}

/* Add responsive styles for smartphones */
@media (max-width: 600px) {
  .card-container {
    padding: 0 10px;
  }

  .frame-output {
    font-size: 1em;
  }

  ion-card-content {
    padding: 10px;
  }

  .two-column-grid {
    grid-template-columns: 1fr;
  }
}

.write-data-card {
  --background: var(--ion-color-tertiary);
}

.write-data-card ion-item {
  --background: transparent;
  --border-color: rgba(0, 0, 0, 0.1);
}

.write-data-card ion-label {
  color: var(--ion-color-dark) !important;
}

.write-data-card ion-input {
  --color: var(--ion-color-dark);
  --placeholder-color: rgba(0, 0, 0, 0.6);
}

.language-switcher {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 1000;
}

@media (max-width: 600px) {
  .language-switcher {
    bottom: 8px;
    right: 8px;
  }
}
</style>
