<template>
  <ion-page>

    <ion-content :fullscreen="true">
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
              <!-- Loop through categories and products -->
              <template v-for="(products, category) in categorizedProducts" :key="category">
                <ion-select-option disabled>
                  {{ category }}
                </ion-select-option>
                <ion-select-option v-for="product in products" :key="product.file" :value="product.file">
                  {{ product.name }}
                </ion-select-option>
              </template>
            </ion-select>
          </ion-card-content>
        </ion-card>
        
      <div class="card-holder" v-show="sensorConfigLoaded">
        <!-- General (general_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.general_params" class="category-card" :key="`config-${currentLanguage}`">
          <ion-item class="config-item">
            <ion-label>{{ localize("@generalLabel") }}</ion-label>
            <!-- <ion-checkbox :checked="generalChecked" @ionChange="onGeneralCheckedChange"></ion-checkbox> -->
            <ion-button @click="resetToDefault" class="small-button">{{ localize("@resetToDefault") }}</ion-button>
            <ion-button class="visibility-button" :class="{ invisible: !generalChecked }" @click="toggleVisibility('general_params')">{{ generalVisible ? '–' : '+' }}</ion-button>
          </ion-item>

          <div class="subcategory-card-holder" v-show="generalVisible">
            <!-- General parameters (general_params) -->
            <ion-card v-for="(paramGroup, groupName) in sensorConfig.general_params" 
                      :key="groupName" 
                      v-show="generalChecked && paramGroup.label" 
                      :class="['subcategory-card', { 'full-width': hasIonRange(paramGroup.fields) }]"
                      :style="getCardStyle(paramGroup.fields)">
              <ion-item class="config-item">
                <ion-label>{{ paramGroup.label }}</ion-label>

                <ion-checkbox 
                  :checked="paramGroupChecked[groupName] || false"
                  @ionChange="onParamGroupCheckedChange($event, groupName, 'general_params')"
                ></ion-checkbox>
                <ion-button class="visibility-button" :class="{ invisible: !paramGroupChecked[groupName] }" @click="toggleSubcategoryVisibility(groupName)">{{ subcategoryVisible[groupName] ? '–' : '+' }}</ion-button>
              </ion-item>

              <!-- Dynamic fields -->
              <ul v-show="subcategoryVisible[groupName] && paramGroupChecked[groupName] && !onlyCustomFrame(paramGroup.fields)">
                <ion-card v-for="(param, paramName) in paramGroup.fields" 
                          :key="paramName" 
                          v-show="param.hidden !== 'true' && param.HMI?.visual_type !== 'customFrame'"
                          class="config-card">
                  <ion-item class="config-item">
                    <!-- Using the TimeSlider component -->
                    <time-slider
                      v-if="param.HMI?.visual_type === 'timeSlider'"
                      :label="param.HMI?.label"
                      :min="param.min_value"
                      :max="param.max_value"
                      :value="param.selectedValue"
                      :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                      :groupName="groupName"
                      :paramName="paramName"
                      @update:value="onParamChange($event, 'general_params', groupName, paramName)"
                      @update:units="onToggleChange($event, 'general_params', groupName, paramName)"
                    />

                    <!-- Using the DoubleSlider component -->
                    <double-slider
                      v-if="param.HMI?.visual_type === 'doubleSlider'"
                      :label="param.HMI?.label"
                      :unit="param.HMI?.unit"
                      :min="param.min_value"
                      :max="param.max_value"
                      :value="{ lower: param.selectedValue.split(' ')[0], upper: param.selectedValue.split(' ')[1] }"
                      :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                      :groupName="groupName"
                      :paramName="paramName"
                      @update:value="onParamChange($event, 'general_params', groupName, paramName)"
                    />

                    <!-- Using the CheckBox component -->
                    <check-box
                      v-if="param.HMI?.visual_type === 'checkbox'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :groupName="groupName"
                      :paramName="paramName"
                      @update:value="onParamChange($event, 'general_params', groupName, paramName)"
                    />

                    <!-- Using the CustomValue component -->
                    <custom-value
                      v-if="param.HMI?.visual_type === 'customValue'"
                      :label="localize(`${param.HMI?.label} @customFixed `) + param.valueText"
                      :value="param.value"
                      :groupName="groupName"
                      :paramName="paramName"
                    />

                    <!-- Using the CustomFrame component -->
                    <custom-frame
                      v-if="param.HMI?.visual_type === 'customFrame'"
                      :label="localize('@frameNotModifiable')"
                      :value="param.value"
                      :groupName="groupName"
                      :paramName="paramName"
                    />

                  </ion-item>
                </ion-card>
              </ul>
              <!-- Add frames display at the bottom of each paramGroup card -->
              <ion-card-content v-if="subcategoryVisible[groupName] && paramGroupChecked[groupName]" class="showFrameButton">
                <ion-button @click="toggleFramesVisibility(groupName)" class="small-button">
                  {{ framesVisible[groupName] ? localize(framesCount[groupName] > 1 ? "@hideFrames" : "@hideFrame") : localize(framesCount[groupName] > 1 ? "@showFrames" : "@showFrame") }}
                </ion-button>
                <div v-show="framesVisible[groupName]" v-html="generateFramesForGroup('general_params', groupName.toString())"></div>
              </ion-card-content>
            </ion-card>
          </div>
        </ion-card>
        
        <!-- Batch (batch_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.batch_params" class="category-card" :key="`config-${currentLanguage}`">
          <ion-item class="config-item">
            <ion-label>{{ localize("@batchLabel") }}</ion-label>
            <ion-checkbox :checked="batchChecked" @ionChange="onBatchCheckedChange"></ion-checkbox>
            <ion-button class="visibility-button" :class="{ invisible: !batchChecked }" @click="toggleVisibility('batch_params')">{{ batchVisible ? '–' : '+' }}</ion-button>
          </ion-item>

          <div class="subcategory-card-holder" v-show="batchVisible">
            <!-- Temperature, Humidity, Battery (batch_params) -->
            <ion-card v-for="(paramGroup, groupName) in sensorConfig.batch_params" 
                      :key="groupName" 
                      v-show="batchChecked && paramGroup.label" 
                      :class="['subcategory-card', { 'full-width': hasIonRange(paramGroup.fields) }]"
                      :style="getCardStyle(paramGroup.fields)">
              <ion-item class="config-item">
                <ion-label>{{ paramGroup.label }}</ion-label>

                <ion-checkbox 
                  :checked="paramGroupChecked[groupName] || false"
                  @ionChange="onParamGroupCheckedChange($event, groupName, 'batch_params')"
                ></ion-checkbox>
                <ion-button class="visibility-button" :class="{ invisible: !paramGroupChecked[groupName] }" @click="toggleSubcategoryVisibility(groupName)">{{ subcategoryVisible[groupName] ? '–' : '+' }}</ion-button>
              </ion-item>

              <!-- Dynamic fields -->
              <ul v-show="subcategoryVisible[groupName] && paramGroupChecked[groupName] && !onlyCustomFrame(paramGroup.fields)">
                <ion-card v-for="(param, paramName) in paramGroup.fields" 
                          :key="paramName" 
                          v-show="param.hidden !== 'true' && param.HMI?.visual_type !== 'customFrame'"
                          class="config-card">
                  <ion-item class="config-item">
                    <!-- Using the TimeSlider component -->
                    <time-slider
                      v-if="param.HMI?.visual_type === 'timeSlider'"
                      :label="param.HMI?.label"
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
                      :label="param.HMI?.label"
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
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :groupName="groupName"
                      :paramName="paramName"
                      @update:value="onParamChange($event, 'standard_params', groupName, paramName)"
                    />

                    <!-- Using the CustomValue component -->
                    <custom-value
                      v-if="param.HMI?.visual_type === 'customValue'"
                      :label="localize(`${param.HMI?.label} @customFixed `) + param.valueText"
                      :value="param.value"
                      :groupName="groupName"
                      :paramName="paramName"
                    />

                  </ion-item>
                </ion-card>
              </ul>
              <!-- Add frames display at the bottom of each paramGroup card -->
              <ion-card-content v-if="subcategoryVisible[groupName] && paramGroupChecked[groupName]" class="showFrameButton">                
                <ion-button @click="toggleFramesVisibility(groupName)" class="small-button">
                  {{ framesVisible[groupName] ? localize(framesCount[groupName] > 1 ? "@hideFrames" : "@hideFrame") : localize(framesCount[groupName] > 1 ? "@showFrames" : "@showFrame") }}
                </ion-button>
                <div v-show="framesVisible[groupName]" v-html="generateFramesForGroup('batch_params', groupName)"></div>
              </ion-card-content>
            </ion-card>
            <ion-card class="global-batch-settings" v-if="batchChecked" v-for="(param, paramName) in sensorConfig.batch_params.global_params.fields" 
                      :key="paramName"
                      v-show="param.hidden !== 'true'">
              <ion-item class="config-item">
                <time-slider
                  :label="param.HMI.label"
                  :min="param.min_value"
                  :max="param.max_value"
                  :value="param.selectedValue"
                  :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                  @update:value="onParamChange($event, 'batch_params', 'global_params', paramName)"
                  @update:units="onToggleChange($event, 'batch_params', 'global_params', paramName)"
                />
              </ion-item>
            </ion-card>
          </div>
          
        </ion-card>

        <!-- Standard (standard_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.standard_params" class="category-card" :key="`config-${currentLanguage}`">
          <ion-item class="config-item">
            <ion-label>{{ localize("@standLabel") }}</ion-label>
            <ion-checkbox :checked="standardChecked" @ionChange="onStandardCheckedChange"></ion-checkbox>
            <ion-button class="visibility-button" :class="{ invisible: !standardChecked }" @click="toggleVisibility('standard_params')">{{ standardVisible ? '–' : '+' }}</ion-button>
          </ion-item>

          <div class="subcategory-card-holder" v-show="standardVisible">
            <!-- Temperature, Humidity, Battery (standard_params) -->
            <ion-card v-for="(paramGroup, groupName) in sensorConfig.standard_params" 
                      :key="groupName" 
                      v-show="standardChecked && paramGroup.label" 
                      :class="['subcategory-card', { 'full-width': hasIonRange(paramGroup.fields) }]"
                      :style="getCardStyle(paramGroup.fields)">
              <ion-item class="config-item">
                <ion-label>{{ paramGroup.label }}</ion-label>

                <ion-checkbox 
                  :checked="paramGroupChecked[groupName] || false"
                  @ionChange="onParamGroupCheckedChange($event, groupName, 'standard_params')"
                ></ion-checkbox>
                <ion-button class="visibility-button" :class="{ invisible: !paramGroupChecked[groupName] }" @click="toggleSubcategoryVisibility(groupName)">{{ subcategoryVisible[groupName] ? '–' : '+' }}</ion-button>
              </ion-item>

              <!-- Dynamic fileds -->
              <ul v-show="subcategoryVisible[groupName] && paramGroupChecked[groupName] && !onlyCustomFrame(paramGroup.fields)">
                <ion-card v-for="(param, paramName) in paramGroup.fields" 
                          :key="paramName" 
                          v-show="param.hidden !== 'true' && param.HMI?.visual_type !== 'customFrame'"
                          class="config-card">
                  <ion-item class="config-item">
                    
                    <!-- Using the TimeSlider component -->
                    <time-slider
                      v-if="param.HMI?.visual_type === 'timeSlider'"
                      :label="param.HMI?.label"
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
                      :label="param.HMI?.label"
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
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :groupName="groupName"
                      :paramName="paramName"
                      @update:value="onParamChange($event, 'standard_params', groupName, paramName)"
                    />

                    <!-- Using the CustomValue component -->
                    <custom-value
                      v-if="param.HMI?.visual_type === 'customValue'"
                      :label="localize(`${param.HMI?.label} @customFixed `) + param.valueText"
                      :value="param.value"
                      :groupName="groupName"
                      :paramName="paramName"
                    />

                  </ion-item>
                </ion-card>
              </ul>
              <!-- Add frames display at the bottom of each paramGroup card -->
              <ion-card-content v-if="subcategoryVisible[groupName] && paramGroupChecked[groupName]" class="showFrameButton">
                <ion-button @click="toggleFramesVisibility(groupName)" class="small-button">
                  {{ framesVisible[groupName] ? localize(framesCount[groupName] > 1 ? "@hideFrames" : "@hideFrame") : localize(framesCount[groupName] > 1 ? "@showFrames" : "@showFrame") }}
                </ion-button>
                <div v-show="framesVisible[groupName]" v-html="generateFramesForGroup('standard_params', groupName)"></div>
              </ion-card-content>
            </ion-card>
          </div>
        </ion-card>
      </div>

      <ion-card class="outputCard">
        <ion-card-content class="sensor-select">
        <ion-label id="outputTitle">{{ localize("@port125") }}</ion-label>
        <ion-label id="outputArea">  </ion-label> 
        <ion-button v-if="framesAvailable" @click="copyFramesNoSpaces" class="half-width">{{ localize("@copyFrames") }}</ion-button>
        </ion-card-content>
      </ion-card>
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
import { ref, onMounted, computed, watch, onUnmounted, nextTick } from 'vue';
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
  IonSegmentButton,
  IonButton
} from '@ionic/vue';
import TimeSlider from '@/components/TimeSlider.vue';
import DoubleSlider from '@/components/DoubleSlider.vue';
import CheckBox from '@/components/CheckBox.vue';
import CustomValue from '@/components/CustomValue.vue';
import CustomFrame from '@/components/CustomFrame.vue';
import axios from 'axios';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'; // Import the new component

// Import language files
import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

// Import flag images
import gbFlag from '@/assets/img/flags/gb.png';
import frFlag from '@/assets/img/flags/fr.png';

// Language configuration
const availableLanguages = [
  { code: 'en', name: 'English', flag: gbFlag },
  { code: 'fr', name: 'Français', flag: frFlag },
  // Add more languages here following the same pattern
];

// Reactive variables to store application state
const availableProducts = ref([]); // Stores the list of available products
const categorizedProducts = computed(() => {
  const categories = {};
  availableProducts.value.forEach(product => {
    if (!categories[product.category]) {
      categories[product.category] = [];
    }
    categories[product.category].push(product);
  });
  return categories;
});
const selectedSensor = ref(''); // Stores the currently selected sensor
const sensorConfig = ref<any | null>(null); // Dynamic configuration for the selected sensor
const batchChecked = ref(false); // State of the batch mode checkbox
const standardChecked = ref(false); // State of the standard mode checkbox
const generalChecked = ref(true); // State of the general mode checkbox
const paramGroupChecked = ref<Record<string, boolean>>({}); // Tracks the state of group checkboxes
const outputData: never[] = []; // Output data for rendering
const outputVals: Record<string, string> = {}; // Output values derived from parameters
const paramGroupList: Record<string, any> = {}; // List of parameter groups
const currentErrors: never[] = []; // Tracks current errors
const currentLanguage = ref('en'); // Reactive variable to store the current language
const framesAvailable = ref(false);
const batchVisible = ref(true);
const standardVisible = ref(true);
const generalVisible = ref(false);
const subcategoryVisible = ref<Record<string, boolean>>({});
const framesVisible = ref<Record<string, boolean>>({});
const framesCount = ref<Record<string, number>>({});
const sensorConfigLoaded = ref(false); // Add a new reactive variable to track the loading state

// Initialize subcategoryVisible to show all subcategories by default
watch(sensorConfig, (newConfig) => {
  if (newConfig) {
    Object.keys(newConfig.batch_params || {}).forEach(groupName => {
      subcategoryVisible.value[groupName] = true;
    });
    Object.keys(newConfig.standard_params || {}).forEach(groupName => {
      subcategoryVisible.value[groupName] = true;
    });
    Object.keys(newConfig.general_params || {}).forEach(groupName => {
      subcategoryVisible.value[groupName] = true;
    });
  }
});

// Language files map
const languages = ref({ en: {}, fr: {} });

// Function to generate a cache-busting query parameter
const generateCacheBuster = () => {
  return `?v=${new Date().getTime()}`;
};

// Load localization files dynamically
const loadLocalizationFiles = async () => {
  try {
    const enResponse = await axios.get(enUS + generateCacheBuster());
    const frResponse = await axios.get(frFR + generateCacheBuster());
    languages.value.en = enResponse.data;
    languages.value.fr = frResponse.data;

    // Set initial content of outputArea after localization files are loaded
    const selectToStartText = localize("@selectToStart");
    const outputArea = document.getElementById("outputArea");
    if (outputArea) {
      outputArea.innerHTML = selectToStartText;
    }
  } catch (error) {
    console.error('Failed to load localization files:', error);
  }
};

// Computed property to get the current localization file
const localization = computed(() => {
  return languages.value[currentLanguage.value];
});

// Function to change the language
const changeLanguage = (language) => {
  currentLanguage.value = language;
  if (selectedSensor.value == '') {
    const outputArea = document.getElementById("outputArea");
    if (outputArea) {
      outputArea.innerHTML = localize("@selectToStart");
    }
  }
};

const localize = (key: string): string => {
  return key.split(' ').map(word => {
    if (word.startsWith('@')) {
      const localizedValue = localization.value[word.substring(1)];
      if (localizedValue) {
        return localizedValue;
      } else {
        console.warn(`Localization key not found: ${word}`);
        return word; // Return the key itself if no match is found
      }
    }
    return word; // Return as-is if not a localization key
  }).join(' ');
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
  if (selectedSensor.value) {
    updateOutput();
    onSensorChange({ detail: { value: selectedSensor.value } });
  }
});

// Load available products from a remote JSON file
const loadAvailableProducts = async () => {
  try {
    const response = await axios.get(`${import.meta.env.BASE_URL}config/AvailableProductList.json` + generateCacheBuster());
    availableProducts.value = response.data.products.filter(product => 
      product.apps && product.apps.includes("EasyCodec")
    );
    const selectToStartText = localize("@selectToStart");
    const outputArea = document.getElementById("outputArea");
    if (outputArea) {
      outputArea.innerHTML = selectToStartText;
    }
  } catch (error) {
    console.error("Erreur lors du chargement de AvailableProductList:", error);
  }
};

// Triggered when a new sensor is selected
const onSensorChange = (event) => {
  const selected = event.detail.value;
  selectedSensor.value = event.detail.value
  loadSensorConfig(selected);
  resetCheckboxes();
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

// Reset all checkboxes to their default states // WIP
const initializeStates = (config) => {
  const setParentAndChildStates = (parentGroup, groupName, bigGroupName) => {
    // Check parent default_state
    if (parentGroup.default_state === "true") {
      if (bigGroupName === "general_params") {
        generalChecked.value = true;
        onGeneralCheckedChange({ detail: { checked: true } });
      } else if (bigGroupName === "batch_params") {
        batchChecked.value = true;
        onBatchCheckedChange({ detail: { checked: true } });
      } else if (bigGroupName === "standard_params") {
        standardChecked.value = true;
        onStandardCheckedChange({ detail: { checked: true } });
      }
      paramGroupChecked.value[groupName] = true;
      onParamGroupCheckedChange({ detail: { checked: true } }, groupName, bigGroupName);
    }

    // Check children default_state
    if (parentGroup.fields) {
      Object.keys(parentGroup.fields).forEach((fieldName) => {
        const field = parentGroup.fields[fieldName];
        if (field.HMI && field.default_value) {
          // Initialize field value
          field.selectedValue = field.default_value;
          outputVals[fieldName] = convertToHexFrameValue(field.default_value, field);

          // Store the original max_value
          field.originalMaxValue = field.max_value;

          // Check individual default_state (if applicable)
          if (parentGroup.default_state === "true") {
            paramGroupList[fieldName] = parentGroup.fields[fieldName];
          }
        }
      });
    }
  };

  // Iterate over batch_params and standard_params
  ["batch_params", "standard_params", "general_params"].forEach((bigGroupName) => {
    if (config[bigGroupName]) {
      Object.keys(config[bigGroupName]).forEach((groupName) => {
        const parentGroup = config[bigGroupName][groupName];
        setParentAndChildStates(parentGroup, groupName, bigGroupName);
      });
    }
  });
};

// Load configuration for a specific sensor
const loadSensorConfig = async (sensorFile: string) => {
  try {
    sensorConfigLoaded.value = false; // Set loading state to false before loading
    const response = await axios.get(`${import.meta.env.BASE_URL}config/${sensorFile}.json` + generateCacheBuster());
    const rawConfig = response.data;

    // Apply localization to the configuration
    sensorConfig.value = applyLocalization(rawConfig);

    // Initialize states for checkboxes and fields
    initializeStates(sensorConfig.value);

    initParams(); // Initialize other parameters
    sensorConfigLoaded.value = true; // Set loading state to true after loading
  } catch (error) {
    console.error('Failed to load sensor config:', error);
  }
};

// Initialize default values for sensor parameters
const initParams = () => {
  if (sensorConfig.value) {
    for (const bigGroupName of ['general_params', 'batch_params', 'standard_params']) {
      const section = sensorConfig.value[bigGroupName];
      for (const groupName in section) {
        const group = section[groupName];
        if (group && group.fields) {
          for (const paramName in group.fields) {
            const param = group.fields[paramName];
            if (param && param.HMI) {
              // Respect the default values and states set by initializeStates
              param.selectedValue = param.selectedValue || param.default_value;
              param.isHours = false; // Default time state
              outputVals[paramName] = convertToHexFrameValue(param.selectedValue, param);
              updateMaxValues(bigGroupName, groupName, paramName);
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
  
  // Reset all output data and param group list when no category is selected
  if (!batchChecked.value && !standardChecked.value) {
    outputData.general_params = false;
    Object.keys(paramGroupList).forEach(key => {
      delete paramGroupList[key];
    });
    const outputArea = document.getElementById("outputArea");
    if (outputArea) {
      outputArea.innerHTML = localize("@selectAtLeastOneMode");
    }
    framesAvailable.value = false;
    return;
  }

  // Set general params
  /*outputData.general_params = true;
  outputData.confirmed = true;
  outputVals.confirmed = "00";*/
  //sensorConfig.value.general_params.fields.confirmed.enabled = true;
  //paramGroupList.confirmed = sensorConfig.value.general_params.fields.confirmed;
  
  Object.keys(sensorConfig.value).forEach((bigGroupName) => {
    // Skip processing if the category is unchecked
    if ((bigGroupName === 'batch_params' && !batchChecked.value) || 
        (bigGroupName === 'standard_params' && !standardChecked.value) ||
        (bigGroupName === 'general_params' && !generalChecked.value)) {
      // Clear all parameter groups for this category
      if (sensorConfig.value[bigGroupName]) {
        Object.keys(sensorConfig.value[bigGroupName]).forEach(groupName => {
          if (sensorConfig.value[bigGroupName][groupName]?.fields) {
            Object.keys(sensorConfig.value[bigGroupName][groupName].fields).forEach(fieldName => {
              delete paramGroupList[fieldName];
            });
          }
        });
      }
      return;
    }

    const cfgBlocks = sensorConfig.value[bigGroupName]?.cfg_block || [];
    
    cfgBlocks.forEach((cfgEntry) => {
      let frame = "";
      let tooltip = "";
      
      if (Array.isArray(cfgEntry) && cfgEntry.length === 2) {
        frame = cfgEntry[0];
        tooltip = cfgEntry[1];
      } else if (typeof cfgEntry === "string") {
        frame = cfgEntry;
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
  
  const outputArea = document.getElementById("outputArea");
  if (outputArea) {
    outputArea.innerHTML = outputFrameTxt;
  }
  framesAvailable.value = outputFrameTxt.trim() !== "";
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
  if (param.type === 'frame') return "";

  if (!value || !param) return;
  let output = '';

  if (param.type === 'string') return value;

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

  Object.keys(sensorConfig.value[category]).forEach(group => {
    if (group !== "global_params") {
      if (paramGroupChecked.value[group]) {
        Object.keys(sensorConfig.value[category][group].fields).forEach(field => {
          sensorConfig.value[category][group].fields[field].enabled = event.detail.checked;
          paramGroupList[field] = sensorConfig.value[category][group].fields[field];
        });
      }
    }
  });
  
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

// Update general mode state
const onGeneralCheckedChange = (event: CustomEvent) => {
  generalChecked.value = event.detail.checked;
  onCategoryCheckedChange(event, "general_params");
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
const onParamChange = (event, bigGroupName, groupName, paramName) => {
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
      
      // Update max values for dependent sliders
      if (sensorConfig.value[bigGroupName][groupName].fields[paramName].HMI.visual_type === 'timeSlider') {
        Object.keys(sensorConfig.value[bigGroupName]).forEach(group => {
          if (sensorConfig.value[bigGroupName][group].fields) {
            Object.keys(sensorConfig.value[bigGroupName][group].fields).forEach(field => {
              updateMaxValues(bigGroupName, group, field);
            });
          }
        });
      }
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
  document.addEventListener('click', handleCopyButtonClick);
  loadAvailableProducts();
  loadLocalizationFiles().then(() => {
    const browserLanguage = navigator.language.split('-')[0]; // Get the browser language
    if (languages.value[browserLanguage]) {
      currentLanguage.value = browserLanguage;
    } else {
      currentLanguage.value = 'en';
    }
    const selectToStartText = localize("@selectToStart");
    document.getElementById("outputArea").innerHTML = selectToStartText;
  });
});

// Remove the event listener when the component is unmounted
onUnmounted(() => {
  document.removeEventListener('click', handleCopyButtonClick);
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

const copyFrames = () => {
  const outputArea = document.getElementById("outputArea");
  if (outputArea) {
    const range = document.createRange();
    range.selectNode(outputArea);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    document.execCommand("copy");
    window.getSelection()?.removeAllRanges();
  }
};

const copyFramesNoSpaces = () => {
  const outputArea = document.getElementById("outputArea");
  if (outputArea) {
    let text = outputArea.innerText || outputArea.textContent;
    if (text) {
      text = text.replace(/ /g, '');
      navigator.clipboard.writeText(text).then(() => {
        console.log('Frames copied to clipboard without spaces');
      }).catch(err => {
        console.error('Failed to copy frames:', err);
      });
    }
  }
};

const toggleVisibility = (category: string) => {
  if (category === 'general_params') {
    generalVisible.value = !generalVisible.value;
  } else if (category === 'batch_params') {
    batchVisible.value = !batchVisible.value;
  } else if (category === 'standard_params') {
    standardVisible.value = !standardVisible.value;
  }
};

const toggleSubcategoryVisibility = (groupName: string) => {
  subcategoryVisible.value[groupName] = !subcategoryVisible.value[groupName];
};

const updateMaxValues = (bigGroupName: string, groupName: string, paramName: string) => {
  const param = sensorConfig.value[bigGroupName][groupName].fields[paramName];
  if (param.HMI.visual_type === 'timeSlider' && param.depends_on) {
    let emissionParam;
    if (bigGroupName === 'batch_params') {
      emissionParam = Object.keys(sensorConfig.value[bigGroupName].global_params.fields).find(key => 
        key === param.depends_on
      );
    } else {
      emissionParam = Object.keys(sensorConfig.value[bigGroupName][groupName].fields).find(key => 
        key === param.depends_on
      );
    }
    if (emissionParam) {
      const emissionValue = bigGroupName === 'batch_params' 
        ? parseInt(sensorConfig.value[bigGroupName].global_params.fields[emissionParam].selectedValue, 10)
        : parseInt(sensorConfig.value[bigGroupName][groupName].fields[emissionParam].selectedValue, 10);
      
      // Ensure the max_value does not exceed the originally set max_value
      const originalMaxValue = parseInt(param.originalMaxValue, 10);
      param.max_value = Math.min(emissionValue, originalMaxValue);

      if (parseInt(param.selectedValue, 10) > param.max_value) {
        param.selectedValue = param.max_value.toString();
        outputVals[paramName] = convertToHexFrameValue(param.max_value.toString(), param);
        updateOutput();
      }
    }
  }
};

// Update the generateFramesForGroup function to use localized strings for the buttons
const generateFramesForGroup = (bigGroupName: string, groupName: string) => {
  let frames = '';
  const paramGroup = sensorConfig.value[bigGroupName][groupName];
  const globalParams = sensorConfig.value[bigGroupName]?.global_params?.fields || {};
  let frameCount = 0;
  if (paramGroup && paramGroup.fields) {
    const cfgBlocks = sensorConfig.value[bigGroupName]?.cfg_block || [];
    cfgBlocks.forEach((cfgEntry: string, index: any) => {
      let frame = cfgEntry[0];
      const frameDesc = cfgEntry[1];
      let includeFrame = false;
      Object.keys(paramGroup.fields).forEach(paramName => {
        const param = paramGroup.fields[paramName];
        if (param.selectedValue) {
          if (frame.includes(`(${paramName}1)`) || frame.includes(`(${paramName}2)`)) {
            const frameValues = param.selectedValue.split(' ').map((value: string) => convertToHexFrameValue(value, param));
            frame = replaceInFrame(frame, `${paramName}1`, frameValues[0], param.enabled);
            frame = replaceInFrame(frame, `${paramName}2`, frameValues[1], param.enabled);
            includeFrame = true;
          } else if (frame.includes(`(${paramName})`)) {
            const frameValue = convertToHexFrameValue(param.selectedValue, param);
            frame = replaceInFrame(frame, paramName, frameValue || '', param.enabled);
            includeFrame = true;
          }
        } else if (param.type === 'frame') {
          if (frame.includes(`(${paramName})`)) {
            frame = replaceInFrame(frame, paramName, "", param.enabled);
            includeFrame = true;
          }
        }
      });
      Object.keys(globalParams).forEach(globalParamName => {
        const globalParam = globalParams[globalParamName];
        if (globalParam.selectedValue) {
          if (frame.includes(`(${globalParamName}1)`) || frame.includes(`(${globalParamName}2)`)) {
            const frameValues = globalParam.selectedValue.split(' ').map(value => convertToHexFrameValue(value, globalParam));
            frame = replaceInFrame(frame, `${globalParamName}1`, frameValues[0], globalParam.enabled);
            frame = replaceInFrame(frame, `${globalParamName}2`, frameValues[1], globalParam.enabled);
          } else if (frame.includes(`(${globalParamName})`)) {
            const frameValue = convertToHexFrameValue(globalParam.selectedValue, globalParam);
            frame = replaceInFrame(frame, globalParamName, frameValue, globalParam.enabled);
          }
        }
      });
      if (includeFrame) {
        const frameId = `frame-${bigGroupName}-${groupName}-${index}`;
        Object.keys(globalParams).forEach(globalParamName => {
          const globalParam = globalParams[globalParamName];
          if (globalParam.selectedValue) {
            if (frame.includes(`(${globalParamName}1)`) || frame.includes(`(${globalParamName}2)`)) {
              const frameValues = globalParam.selectedValue.split(' ').map(value => convertToHexFrameValue(value, globalParam));
              frame = replaceInFrame(frame, `${globalParamName}1`, frameValues[0], globalParam.enabled);
              frame = replaceInFrame(frame, `${globalParamName}2`, frameValues[1], globalParam.enabled);
            } else if (frame.includes(`(${globalParamName})`)) {
              const frameValue = convertToHexFrameValue(globalParam.selectedValue, globalParam);
              frame = replaceInFrame(frame, globalParamName, frameValue, globalParam.enabled);
            }
          }
        });
        if (includeFrame) {
          const frameId = `frame-${bigGroupName}-${groupName}-${index}`;
          frames += `<span class="frameArea" id="${frameId}"><span class="frame">${frame}</span>&nbsp;&nbsp;&nbsp;&nbsp;(${frameDesc}) <button class="copy-button" data-frame-id="${frameId}" data-no-spaces="true">${localize('@copyFrame')}</button></span><br>`;
        frameCount++;
        }
      }
    });
  }
  framesCount.value[groupName] = frameCount;
  return frames;
};

// Update the copyFrame function to handle copying without spaces
const copyFrame = (frameId, noSpaces = false) => {
  const frameElement = document.getElementById(frameId)?.querySelector('.frame');
  if (frameElement) {
    let frameText = frameElement.textContent || frameElement.innerText;
    if (noSpaces) {
      frameText = frameText.replace(/\s+/g, '');
    }
    navigator.clipboard.writeText(frameText).then(() => {
      console.log('Frame copied to clipboard:', frameText);
    }).catch(err => {
      console.error('Failed to copy frame:', err);
    });
  }
};

// Update the handleCopyButtonClick function to handle the new button
const handleCopyButtonClick = (event) => {
  const button = event.target.closest('.copy-button');
  if (button) {
    const frameId = button.getAttribute('data-frame-id');
    const noSpaces = button.getAttribute('data-no-spaces') === 'true';
    if (frameId) {
      copyFrame(frameId, noSpaces);
    }
  }
};

// Function to toggle the visibility of frames
const toggleFramesVisibility = (groupName) => {
  framesVisible.value[groupName] = !framesVisible.value[groupName];
};

const resetToDefault = () => {
  if (selectedSensor.value) {
    onSensorChange({ detail: { value: selectedSensor.value } });
  }
};

// Function to check if only custom-frame elements are present
const onlyCustomFrame = (fields) => {
  return Object.values(fields).every(field => field.HMI?.visual_type === 'customFrame');
};

// Function to check if a paramGroup has an ion-range component
const hasIonRange = (fields) => {
  if (!fields) return false;
  return Object.values(fields).some(field => field.HMI?.visual_type === 'timeSlider' || field.HMI?.visual_type === 'doubleSlider');
};

const getCardStyle = (fields) => {
  if (!fields) {
    return { width: '100%', margin: '10px' };
  }

  if (hasIonRange(fields)) {
    return { width: '100%', margin: '10px' };
  }

  // Get current card's container
  const currentCard = Array.from(document.querySelectorAll('.subcategory-card'))
    .find(card => {
      return Object.values(fields).some(field => 
        card.textContent?.includes(field.HMI?.label)
      );
    });

  if (!currentCard) {
    return { width: '100%', margin: '10px' };
  }

  const container = currentCard.parentElement;
  if (!container?.classList.contains('subcategory-card-holder')) {
    return { width: '100%', margin: '10px' };
  }

  // Count visible siblings with content
  const visibleSiblings = Array.from(container.children)
    .filter(el => {
      if (!el.classList.contains('subcategory-card')) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && 
            !el.classList.contains('full-width') &&
            !el.querySelector('ion-range') &&
            el.querySelector('.config-item ion-label')?.textContent?.trim().length > 0;
    });

  if (visibleSiblings.length <= 1) {
    return { width: '100%', margin: '10px' };
  } else if (visibleSiblings.length === 2) {
    return { width: 'calc(50% - 20px)', margin: '10px' };
  } else {
    return { width: 'calc(33.33% - 20px)', margin: '10px' };
  }
};
</script>

<style scoped>
.card-holder {
  display: block;
  width: 100%;
}

.sensor-select {
  display: flex;
  justify-content: space-between;
  margin: 10px 100px;
  flex-direction: column;
}

#sensor-card {
  width: 70%;
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 5;
  box-shadow: 0px 8px 20px 0px var(--ion-background-color);
}

#config-card {
  width: 33%;
  background-color: var(--ion-color-darkGrey);
  color: var(--ion-color-darkGrey-contrast);
}

.item > ion-label {
  margin: 0;
}

ion-card {
  --background: var(--ion-color-darkGrey);
  --color: var(--ion-color-darkGrey-contrast);
  border-radius: 10px;
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
  background: transparent;
}

ion-segment-button {
  --color: var(--ion-color-medium);
  --color-checked: var(--ion-color-primary);
  min-width: 120px;
}

ion-segment-button::part(indicator-background) {
  background: var(--ion-color-primary);
}

.outputCard, #sensor-card, .category-card {
  margin-left: auto;
  margin-right: auto;
}

.category-card, .sensor-card, .outputCard {
  width: 70%;
}

.category-card {
  background-color: var(--ion-color-tertiary);
}

.category-card > .config-item {
  color: var(--ion-color-tertiary-contrast);
}

.subcategory-card {
  background-color: var(--ion-color-lightGrey);
  transition: width 0.3s ease;
}

.subcategory-card > .config-item {
  color: var(--ion-color-lightGrey-contrast);
}

.subcategory-card-holder {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  width: 100%;
  justify-content: flex-start;
}

.global-batch-settings {
  width: 100%;
}

ul {
  padding-left: 0;
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
  color: var(--ion-background-color);
}

#outputTitle {
  margin-bottom: 10px;
}

#outputArea {
  font-size: smaller;
  font-family: 'Courier New', Courier, monospace;
  font-weight: bold;
}

ion-range::part(pin) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ion-background-color);
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

.visibility-button {
  --background: none;
  --box-shadow: none;
  --padding-start: 10px;
  --padding-end: 3px;
  --padding-top: 0;
  --padding-bottom: 0;
  --border-radius: 0;
  --color: var(--ion-color-primary);
  font-size: x-large;
  font-weight: bolder;
  color: black;
}

.visibility-button.invisible {
  visibility: hidden;
}

.showFrameButton {
  padding-top: 0px;
}

/* Add responsive styles for smartphones */
@media (max-width: 600px) {
  .sensor-select {
    margin: 10px 20px;
  }

  .category-card, .sensor-card, .outputCard {
    width: 95%;
  }

  #sensor-card {
    width: -webkit-fill-available;
  }

  #config-card {
    width: 100%;
  }

  ion-card-content {
    font-size: 1rem;
  }

  ion-card ul {
    padding-left: 0;
  }

  .config-item {
    flex: 1 1 100%;
    min-width: 100%;
  }

  ion-chip {
    width: 90px;
    font-size: 0.8rem;
  }

  ion-label {
    font-size: 0.9rem;
  }

  #outputArea {
    font-size: xx-small;
  }

  .language-switcher {
    bottom: 8px;
    right: 8px;
  }
}

.small-button {
  --padding-start: 5px;
  --padding-end: 5px;
  --padding-top: 2px;
  --padding-bottom: 2px;
  --border-radius: 5px;
  --height: 24px;
  font-size: x-small;
}

.button-group {
  display: flex;
  gap: 10px;
}

.half-width {
  flex: 1;
}

.loading-message {
  text-align: center;
  font-size: 1.5rem;
  color: var(--ion-color-primary);
  margin-top: 20px;
}

.subcategory-card.full-width {
  width: 100% !important;
}
</style>

<style>
.frame {
  font-family: 'Courier New', Courier, monospace;
  font-weight: bold;
  user-select: text; /* Ensure the frame part is selectable */
}

.frameArea {
  color: black;
  font-size: small;
  user-select: none; /* Prevent selection of the entire line */
}

.frameArea .frame {
  user-select: text; /* Allow selection of the frame part */
}

.copy-button {
  background: var(--ion-color-primary);
  border: none;
  color: var(--ion-background-color);
  cursor: pointer;
  font-size: small;
  margin-left: 5px;
  padding: 5px 10px;
  border-radius: 5px;
  text-decoration: none;
}

.copy-button:hover {
  background: var(--ion-color-primary-tint);
}
</style>
