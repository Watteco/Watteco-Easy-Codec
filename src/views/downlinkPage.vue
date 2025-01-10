<template>
  <ion-page>

    <ion-content :fullscreen="true">
      <div class="card-holder">
      <ion-card v-show="false">
        <ion-range></ion-range>
        <ion-chip></ion-chip>
        <ion-toggle></ion-toggle>
      </ion-card>
        
        <!-- Sensor selection -->
        <ion-card id="sensor-card">
          <ion-card-content class="sensor-select">
            <ion-select
                class="always-flip"
                interface="popover"
                :label="localize('@sensor')"
                :placeholder="localize('@sensorSelect')"
                @ionChange="onSensorChange"
              >
              <!-- Loop through products from JSON file -->
              <ion-select-option v-for="(product, index) in availableProducts" 
                  :key="index" 
                  :value="product.file">
                {{ product.name }}
              </ion-select-option>
            </ion-select>
          </ion-card-content>
        </ion-card>

        <!-- Batch (batch_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.batch_params" class="category-card" :key="`config-${currentLanguage}`">
          <ion-item class="config-item">
            <ion-label>{{ localize("@batchLabel") }}</ion-label>
            <ion-checkbox :checked="batchChecked" @ionChange="onBatchCheckedChange"></ion-checkbox>
          </ion-item>

          <!-- Temperature, Humidity, Battery (batch_params) -->
          <ion-card v-for="(paramGroup, groupName) in sensorConfig.batch_params" 
                    :key="groupName" 
                    v-show="batchChecked && paramGroup.label" 
                    class="subcategory-card">
            <ion-item class="config-item">
              <ion-label>{{ paramGroup.label }}</ion-label>

              <ion-checkbox 
                :checked="paramGroupChecked[groupName] || false"
                @ionChange="onParamGroupCheckedChange($event, groupName, 'batch_params')"
              ></ion-checkbox>

            </ion-item>

            <!-- Dynamic fields -->
            <ul v-if="paramGroupChecked[groupName]">
              <ion-card v-for="(param, paramName) in paramGroup.fields" 
                        :key="paramName" 
                        class="config-card">
                <ion-item class="config-item">
                  <!-- Using the TimeSlider component -->
                  <time-slider
                    v-if="param.HMI?.visual_type === 'timeSlider'"
                    :label="param.HMI?.label_long"
                    :min="param.min_value"
                    :max="param.max_value"
                    :value="param.selectedValue"
                    :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                    :groupName="groupName"
                    :paramName="paramName"
                    @update:value="onParamChange($event, 'batch_params', groupName, paramName)"
                    @update:units="onToggleChange($event, 'batch_params', groupName, paramName)"
                  />

                  <!-- Using the DoubleSlider component -->
                  <double-slider
                    v-if="param.HMI?.visual_type === 'doubleSlider'"
                    :label="param.HMI?.label_long"
                    :unit="param.HMI?.unit"
                    :min="param.min_value"
                    :max="param.max_value"
                    :value="{ lower: param.selectedValue.split(' ')[0], upper: param.selectedValue.split(' ')[1] }"
                    :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                    :groupName="groupName"
                    :paramName="paramName"
                    @update:value="onParamChange($event, 'standard_params', groupName, paramName)"
                  />

                  <!-- Using the CheckBox component -->
                  <check-box
                    v-if="param.HMI?.visual_type === 'checkbox'"
                    :label="param.HMI?.label_long"
                    :value="param.selectedValue"
                    :groupName="groupName"
                    :paramName="paramName"
                    @update:value="onParamChange($event, 'standard_params', groupName, paramName)"
                  />

                </ion-item>
              </ion-card>
            </ul>
          </ion-card>
          <ion-card v-for="(param, paramName) in sensorConfig.batch_params.global_params.fields" 
                    :key="paramName"
                    v-if="batchChecked">
            <ion-item class="config-item">
              <time-slider
                :label="param.HMI.label_long"
                :min="param.min_value"
                :max="param.max_value"
                :value="param.selectedValue"
                :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                @update:value="onParamChange($event, 'batch_params', 'global_params', paramName)"
                @update:units="onToggleChange($event, 'batch_params', 'global_params', paramName)"
              />
            </ion-item>
          </ion-card>
          
        </ion-card>

        <!-- Standard (standard_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.standard_params" class="category-card" :key="`config-${currentLanguage}`">
          <ion-item class="config-item">
            <ion-label>{{ localize("@standLabel") }}</ion-label>
            <ion-checkbox :checked="standardChecked" @ionChange="onStandardCheckedChange"></ion-checkbox>
          </ion-item>

          <!-- Temperature, Humidity, Battery (standard_params) -->
          <ion-card v-for="(paramGroup, groupName) in sensorConfig.standard_params" 
                    :key="groupName" 
                    v-show="standardChecked && paramGroup.label" 
                    class="subcategory-card">
            <ion-item class="config-item">
              <ion-label>{{ paramGroup.label }}</ion-label>

              <ion-checkbox 
                :checked="paramGroupChecked[groupName] || false"
                @ionChange="onParamGroupCheckedChange($event, groupName, 'standard_params')"
              ></ion-checkbox>

            </ion-item>

            <!-- Dynamic fileds -->
            <ul v-if="paramGroupChecked[groupName]">
              <ion-card v-for="(param, paramName) in paramGroup.fields" 
                        :key="paramName" 
                        class="config-card">
                <ion-item class="config-item">
                  
                  <!-- Using the TimeSlider component -->
                  <time-slider
                    v-if="param.HMI?.visual_type === 'timeSlider'"
                    :label="param.HMI?.label_long"
                    :min="param.min_value"
                    :max="param.max_value"
                    :value="param.selectedValue"
                    :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                    :groupName="groupName"
                    :paramName="paramName"
                    @update:value="onParamChange($event, 'standard_params', groupName, paramName)"
                    @update:units="onToggleChange($event, 'standard_params', groupName, paramName)"
                  />

                  <!-- Using the DoubleSlider component -->
                  <double-slider
                    v-if="param.HMI?.visual_type === 'doubleSlider'"
                    :label="param.HMI?.label_long"
                    :unit="param.HMI?.unit"
                    :min="param.min_value"
                    :max="param.max_value"
                    :value="{ lower: param.selectedValue.split(' ')[0], upper: param.selectedValue.split(' ')[1] }"
                    :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                    :groupName="groupName"
                    :paramName="paramName"
                    @update:value="onParamChange($event, 'standard_params', groupName, paramName)"
                  />

                  <!-- Using the CheckBox component -->
                  <check-box
                    v-if="param.HMI?.visual_type === 'checkbox'"
                    :label="param.HMI?.label_long"
                    :value="param.selectedValue"
                    :groupName="groupName"
                    :paramName="paramName"
                    @update:value="onParamChange($event, 'standard_params', groupName, paramName)"
                  />

                </ion-item>
              </ion-card>
            </ul>
          </ion-card>
        </ion-card>
      
        <ion-card> 
          <ion-card-content class="sensor-select">
            
          <ion-label id="outputArea">  </ion-label> 
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  <div>
    <!-- Language Switcher -->
    <ion-segment @ionChange="changeLanguage($event.detail.value)">
      <ion-segment-button value="en" :checked="currentLanguage === 'en'">English</ion-segment-button>
      <ion-segment-button value="fr" :checked="currentLanguage === 'fr'">Français</ion-segment-button>
    </ion-segment>
  </div>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { 
  IonTabBar, 
  IonTabButton, 
  IonTabs, 
  IonIcon, 
  IonPage, 
  IonRouterOutlet,
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonRange,
  IonToggle,
  IonChip,
  IonContent, 
  IonSelect, 
  IonSelectOption, 
  IonCard, 
  IonCardContent, 
  IonLabel, 
  IonCheckbox, 
  IonItem,
  IonSegment,
  IonSegmentButton
} from '@ionic/vue';
import TimeSlider from '@/components/TimeSlider.vue';
import DoubleSlider from '@/components/DoubleSlider.vue';
import CheckBox from '@/components/CheckBox.vue';
import axios from 'axios';

// Import language files
import enUS from '@/localisation/en_US.json';
import frFR from '@/localisation/fr_FR.json';

// Reactive variables to store application state
const availableProducts = ref([]); // Stores the list of available products
const selectedSensor = ref(''); // Stores the currently selected sensor
const sensorConfig = ref<any | null>(null); // Dynamic configuration for the selected sensor
const batchChecked = ref(false); // State of the batch mode checkbox
const standardChecked = ref(false); // State of the standard mode checkbox
const paramGroupChecked = ref<Record<string, boolean>>({}); // Tracks the state of group checkboxes
const outputData: never[] = []; // Output data for rendering
const outputVals: never[] = []; // Output values derived from parameters
const paramGroupList: never[] = []; // List of parameter groups
const currentErrors: never[] = []; // Tracks current errors
const currentLanguage = ref('en'); // Reactive variable to store the current language

// Language files map
const languages = {
  en: enUS,
  fr: frFR,
};

// Computed property to get the current localization file
const localization = computed(() => languages[currentLanguage.value]);

import { currentLanguage } from './localization'; // Import the reactive language state

// Function to change the language
const changeLanguage = (language) => {
  console.log(`Changing language to: ${language}`);
  currentLanguage.value = language;
  console.log(`Current language is now: ${currentLanguage.value}`);
};

const localize = (key: string): string => {
  if (key.startsWith('@')) {
    const localizedValue = localization.value[key.substring(1)];
    if (localizedValue) {
      return localizedValue;
    } else {
      console.warn(`Localization key not found: ${key}`);
      return key; // Return the key itself if no match is found
    }
  }
  return key; // Return as-is if not a localization key
};

const applyLocalization = (config: any): any => {
  if (typeof config === 'string') {
    return localize(config);
  } else if (Array.isArray(config)) {
    return config.map((item) => applyLocalization(item));
  } else if (typeof config === 'object' && config !== null) {
    const localizedConfig: any = {};
    for (const key in config) {
      localizedConfig[key] = applyLocalization(config[key]);
    }
    return localizedConfig;
  }
  return config;
};

watch(currentLanguage, (newLang, oldLang) => {
  console.log(`Language changed from ${oldLang} to ${newLang}`);
  console.log(selectedSensor, selectedSensor.value);
  if (selectedSensor.value) { //ChatGPT: Why this line ? Nothing happens because it seems to never be true
    updateOutput();
    onSensorChange({ detail: { value: selectedSensor.value } });
  }
});

// Load available products from a remote JSON file
const loadAvailableProducts = async () => {
  try {
    const response = await axios.get(`${import.meta.env.BASE_URL}config/AvailableProductList.json`);
    availableProducts.value = response.data.products.filter(product => 
      product.apps && product.apps.includes("EasyCodec")
    );
    document.getElementById("outputArea").innerHTML = localize("@selectToStart");
  } catch (error) {
    console.error("Erreur lors du chargement de AvailableProductList:", error);
  }
};

// Triggered when a new sensor is selected
const onSensorChange = (event) => {
  const selected = event.detail.value;
  selectedSensor.value = event.detail.value
  console.log(`Sensor selected: ${selected}`);
  resetCheckboxes();
  loadSensorConfig(selected);
};

// Reset all checkboxes to their default states
const resetCheckboxes = () => {
  batchChecked.value = false;
  standardChecked.value = false;
  
  Object.keys(outputData).forEach(data => {
    outputData[data] = false;
  });
  Object.keys(paramGroupList).forEach(data => {
    paramGroupList[data] = false;
  });
  
  for (const group in paramGroupChecked.value) {
    paramGroupChecked.value[group] = false;
  }
};

// Load configuration for a specific sensor
const loadSensorConfig = async (sensorFile: string) => {
  try {
    const response = await axios.get(`${import.meta.env.BASE_URL}config/${sensorFile}.json`);
    const rawConfig = response.data;

    // Apply localization to the configuration
    sensorConfig.value = applyLocalization(rawConfig);

    initParams(); // Initialize parameters
  } catch (error) {
    console.error('Failed to load sensor config:', error);
  }
};

// Initialize default values for sensor parameters
const initParams = () => {
  if (sensorConfig.value) {
    for (const section of [sensorConfig.value.batch_params, sensorConfig.value.standard_params]) {
      for (const groupName in section) {
        if (section[groupName] && (section[groupName].label || groupName === "global_params")) {
          paramGroupChecked.value[groupName] = false;
          outputVals[groupName] = [section[groupName].fields];
          for (const paramName in section[groupName].fields) {
            const param = section[groupName].fields[paramName];
            if (param && param.HMI) {
              param.selectedValue = param.default_value;
              param.isHours = false; // Default time state
              outputVals[paramName] = convertToHexFrameValue(param.selectedValue, param);
            }
          }
        }
      }
    }
  }
  updateOutput(); // Refresh the output display
};

// Update the output display with the generated frames
const updateOutput = () => {
  let outputFrameTxt = "";
  
  outputData.general_params = true;
  outputData.confirmed = true;
  outputVals.confirmed = "00";
  sensorConfig.value.confirmed.params.confirmed.enabled = true;
  paramGroupList.confirmed = sensorConfig.value.confirmed.params.confirmed;
  
  Object.keys(sensorConfig.value).forEach((bigGroupName) => {
    const cfgBlocks = sensorConfig.value[bigGroupName]?.cfg_block || [];
    
    cfgBlocks.forEach((cfgEntry) => {
      let frame = "";
      let tooltip = "";
      
      if (Array.isArray(cfgEntry) && cfgEntry.length === 2) {
        frame = cfgEntry[0];
        tooltip = cfgEntry[1];
      } else if (typeof cfgEntry === "string") {
        frame = cfgEntry;
      } else {
        console.warn("Unexpected cfg_block entry format:", cfgEntry);
        return;
      }
      
      Object.keys(outputVals).forEach((valKey) => {
        const enabled = paramGroupList[valKey]?.enabled;
        if (outputVals[valKey]?.toString().includes(" ")) {
          frame = replaceInFrame(frame, `${valKey}1`, outputVals[valKey].toString().split(" ")[0], enabled);
          frame = replaceInFrame(frame, `${valKey}2`, outputVals[valKey].toString().split(" ")[1], enabled);
        } else {
          frame = replaceInFrame(frame, valKey, outputVals[valKey], enabled);
        }
      });
      
      if (frame.trim()) {
        outputFrameTxt += `<span title="${localize(tooltip) || ""}">${frame}</span><br>`;
      }
    });
  });
  
  if (!batchChecked.value && !standardChecked.value) {
    outputFrameTxt = localize("@selectAtLeastOneMode");
  }
  
  document.getElementById("outputArea").innerHTML = outputFrameTxt;
};

// Replace placeholders in frame templates with actual values
const replaceInFrame = (frame: string, key: string, value: string, enabled: string) => {
  if (value !== undefined && value !== null) {
    if (frame.includes(key)) {
      frame = frame.replace(RegExp(`\\(${key}\\)`, 'g'), `${value}`);
      
      if (!enabled) {
        frame = '';
      }
    }
  }
  return frame;
};

// Convert a parameter value to a hex format for frames
const convertToHexFrameValue = (value: string, param: {
  HMI: any; type: string; isHours: boolean; 
}) => {
  if (!value || !param) return 1;
  let output = '';

  if (value.includes(" ")) {
    output = "";
    value.split(" ").forEach(function(item) {
      const val = parseInt(item);
      const out = convertToHexFrameValue(val.toString(), param);
      output = `${output} ${out}`;
    });
    output = output.trim();
  } else {
    if (param.HMI.multiplier) {
      value = (parseInt(value) * param.HMI.multiplier).toString();
    }
    if (param.type == "timeInt32") {
      if (param.isHours) {
        value = (parseInt(value) * 60).toString();
      }
      output = (parseInt(value) + 32768).toString(16).padStart(4, '0');
    } else if (param.type == "int32") {
      output = parseInt(value).toString(16).padStart(4, '0');
    } else if (param.type == "bool") {
      output = (value == "true") ? "01" : "00";
    } else {
      output = `-Error: ${value} is ${param.type}, not supported-`;
    }
  }
  return output;
};

// Update checkbox states and propagate changes to output
const onCategoryCheckedChange = (event: CustomEvent, category: string) => {
  if (sensorConfig.value[category].global_params) {
    Object.keys(sensorConfig.value[category].global_params.fields).forEach(field => {
      sensorConfig.value[category].global_params.fields[field].enabled = event.detail.checked;
      paramGroupList[field] = sensorConfig.value[category].global_params.fields[field];
    });
  }
  outputData[category] = event.detail.checked;
  updateOutput();
};

// Update batch mode state
const onBatchCheckedChange = (event: CustomEvent) => {
  batchChecked.value = event.detail.checked;
  onCategoryCheckedChange(event, "batch_params");
};

// Update standard mode state
const onStandardCheckedChange = (event: CustomEvent) => {
  standardChecked.value = event.detail.checked;
  onCategoryCheckedChange(event, "standard_params");
};

// Handle group checkbox changes
const onParamGroupCheckedChange = (event: CustomEvent, groupName: string | number, bigGroupName: string) => {
  paramGroupChecked.value[groupName] = event.detail.checked;
  Object.keys(sensorConfig.value[bigGroupName][groupName].fields).forEach(field => {
    sensorConfig.value[bigGroupName][groupName].fields[field].enabled = event.detail.checked;
    paramGroupList[field] = sensorConfig.value[bigGroupName][groupName].fields[field];
  });
  outputData[groupName] = event.detail.checked;
  updateOutput();
};

// Handle parameter value changes
const onParamChange = (event: { newValue: number | boolean; detail: { value: { lower: number; upper: number; }; }; }, bigGroupName: string, groupName: string | number, paramName: string | number) => {
  if (sensorConfig.value[bigGroupName][groupName]) {
    if (sensorConfig.value[bigGroupName][groupName].fields[paramName]) {
      let newVal = "0";
      if (event.newValue || event.newValue === false || event.newValue === 0) {
        newVal = event.newValue.toString();
      } else if (event.detail.value) {
        newVal = `${event.detail.value.lower} ${event.detail.value.upper}`;
      }
      sensorConfig.value[bigGroupName][groupName].fields[paramName].selectedValue = newVal;
      outputVals[paramName] = convertToHexFrameValue(newVal, sensorConfig.value[bigGroupName][groupName].fields[paramName]);
    } else {
      console.error('Invalid paramName:', paramName, 'in group:', groupName);
    }
  } else {
    console.error('Invalid groupName:', groupName);
  }
  updateOutput();
};

// Handle toggle changes (e.g., hours vs. minutes)
const onToggleChange = (event: { isHours: boolean; }, bigGroupName: string, groupName: string | number, paramName: string | number) => {
  if (sensorConfig.value[bigGroupName][groupName] && sensorConfig.value[bigGroupName][groupName].fields[paramName]) {
    const param = sensorConfig.value[bigGroupName][groupName].fields[paramName];
    param.isHours = event.isHours;
    outputVals[paramName] = convertToHexFrameValue(param.selectedValue, param);
  } else {
    console.error('Invalid groupName or paramName:', groupName, paramName);
  }
  updateOutput();
};

// Load available products when the component is mounted
onMounted(() => {
  loadAvailableProducts();
});

// Calculate appropriate slider step sizes
const calculateSteps = (min: number, max: number) => {
  const difference = max - min;
  if (difference < 100) {
    return 1;
  }
  const roughStep = difference / 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  let roundedStep = Math.ceil(roughStep / magnitude) * magnitude;
  if (roundedStep > 20 && roundedStep <= 50) {
    roundedStep = 20;
  }
  return roundedStep;
};
</script>

<style scoped>
.toolbar-title {
	background-color: var(--ion-color-primary);
}
  
.card-holder {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  align-content: center;
  justify-content: flex-start;
}

.sensor-select {
  display: flex;
  justify-content: space-between;
  margin: 10px 100px;
}

#sensor-card {
  width: 70%;
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 5;
  box-shadow: 0px 8px 20px 0px white;
}

#config-card {
  width: 33%;
  background-color: #555555;
}

.item > ion-label {
  margin: 0;
}

ion-card {
  --background: #555555;
  --color: #ffffff;
  border-radius: 25px;
}

ion-card-content {
  font-size: 1.2rem;
}

ion-select.always-flip::part(icon) {
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

ion-select.always-flip.select-expanded::part(icon) {
  transform: rotate(180deg);
}

ion-segment {
  background-color: white;
  border-top: solid 1px rgb(0 0 0 / 7%);
}

.category-card {
  background-color: var(--ion-color-tertiary);
}
.category-card > .config-item, .subcategory-card > .config-item{
  color: black
}

.subcategory-card {
  background-color: var(--ion-color-medium-tint);
}

.config-card-content {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.sensor-config {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
}

.config-item {
  flex: 1 1 45%;
  min-width: 200px;
  margin: 10px;
}

.config-item {
  color: white;
}

ion-range::part(pin) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;

  border-radius: 50%;
  transform: scale(1.01);

  min-width: 28px;
  height: 28px;
  transition: transform 120ms ease, background 120ms ease;

  z-index: 10;
}

ion-range::part(pin)::before {
  content: none;
}
</style>
