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
        
        <!-- Batch (batch_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.batch_params" class="category-card" :key="`config-${currentLanguage}`">
          <ion-item class="config-item">
            <ion-label>{{ localize("@batchLabel") }}</ion-label>
            <ion-checkbox :checked="batchChecked" @ionChange="onBatchCheckedChange"></ion-checkbox>
            <ion-button v-if="batchChecked" class="visibility-button" @click="toggleVisibility('batch_params')">{{ batchVisible ? '–' : '+' }}</ion-button>
          </ion-item>

          <div v-show="batchVisible">
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
                <ion-button v-if="paramGroupChecked[groupName]" class="visibility-button" @click="toggleSubcategoryVisibility(groupName)">{{ subcategoryVisible[groupName] ? '–' : '+' }}</ion-button>
              </ion-item>

              <!-- Dynamic fields -->
              <ul v-show="subcategoryVisible[groupName] && paramGroupChecked[groupName]">
                <ion-card v-for="(param, paramName) in paramGroup.fields" 
                          :key="paramName" 
                          v-show="param.hidden !== 'true'"
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
                      v-if="batchChecked"
                      v-show="param.hidden !== 'true'">
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
          </div>
          
        </ion-card>

        <!-- Standard (standard_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.standard_params" class="category-card" :key="`config-${currentLanguage}`">
          <ion-item class="config-item">
            <ion-label>{{ localize("@standLabel") }}</ion-label>
            <ion-checkbox :checked="standardChecked" @ionChange="onStandardCheckedChange"></ion-checkbox>
            <ion-button v-if="standardChecked" class="visibility-button" @click="toggleVisibility('standard_params')">{{ standardVisible ? '–' : '+' }}</ion-button>
          </ion-item>

          <div v-show="standardVisible">
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
                <ion-button v-if="paramGroupChecked[groupName]" class="visibility-button" @click="toggleSubcategoryVisibility(groupName)">{{ subcategoryVisible[groupName] ? '–' : '+' }}</ion-button>
              </ion-item>

              <!-- Dynamic fileds -->
              <ul v-show="subcategoryVisible[groupName] && paramGroupChecked[groupName]">
                <ion-card v-for="(param, paramName) in paramGroup.fields" 
                          :key="paramName" 
                          v-show="param.hidden !== 'true'"
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
          </div>
        </ion-card>

        <ion-card> 
          <ion-card-content class="sensor-select">
          <ion-label id="outputTitle">{{ localize("@port125") }}</ion-label>
          <ion-label id="outputArea">  </ion-label> 
          <ion-button v-if="framesAvailable" @click="copyFrames">{{ localize("@copyFrames") }}</ion-button>
          </ion-card-content>
        </ion-card>
      </div>

    </ion-content>
  <div>
    <!-- Language Switcher -->
    <ion-segment v-model="currentLanguage" @ionChange="changeLanguage($event.detail.value)">
      <ion-segment-button value="en" class="language-button">
        <span class="language-content">
          <img src="@/assets/img/flags/gb.png" alt="English" class="flag-icon" /> English
        </span>
      </ion-segment-button>
      <ion-segment-button value="fr" class="language-button">
        <span class="language-content">
          <img src="@/assets/img/flags/fr.png" alt="Français" class="flag-icon" /> Français
        </span>
      </ion-segment-button>
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
  IonSegmentButton,
  IonButton
} from '@ionic/vue';
import TimeSlider from '@/components/TimeSlider.vue';
import DoubleSlider from '@/components/DoubleSlider.vue';
import CheckBox from '@/components/CheckBox.vue';
import axios from 'axios';

// Import language files
import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

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
const paramGroupChecked = ref<Record<string, boolean>>({}); // Tracks the state of group checkboxes
const outputData: never[] = []; // Output data for rendering
const outputVals: never[] = []; // Output values derived from parameters
const paramGroupList: never[] = []; // List of parameter groups
const currentErrors: never[] = []; // Tracks current errors
const currentLanguage = ref('en'); // Reactive variable to store the current language
const framesAvailable = ref(false);
const batchVisible = ref(true);
const standardVisible = ref(true);
const subcategoryVisible = ref<Record<string, boolean>>({});

// Initialize subcategoryVisible to show all subcategories by default
watch(sensorConfig, (newConfig) => {
  if (newConfig) {
    Object.keys(newConfig.batch_params || {}).forEach(groupName => {
      subcategoryVisible.value[groupName] = true;
    });
    Object.keys(newConfig.standard_params || {}).forEach(groupName => {
      subcategoryVisible.value[groupName] = true;
    });
  }
});

// Language files map
const languages = ref({ en: {}, fr: {} });

// Load localization files dynamically
const loadLocalizationFiles = async () => {
  try {
    const enResponse = await axios.get(enUS);
    const frResponse = await axios.get(frFR);
    languages.value.en = enResponse.data;
    languages.value.fr = frResponse.data;

    // Set initial content of outputArea after localization files are loaded
    const selectToStartText = localize("@selectToStart");
    document.getElementById("outputArea").innerHTML = selectToStartText;
  } catch (error) {
    console.error('Failed to load localization files:', error);
  }
};

// Computed property to get the current localization file
const localization = computed(() => {
  return languages.value[currentLanguage.value];
});

import { currentLanguage } from './localization'; // Import the reactive language state

// Function to change the language
const changeLanguage = (language) => {
  currentLanguage.value = language;
  if (selectedSensor.value == '') {
    document.getElementById("outputArea").innerHTML = localize("@selectToStart");
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
    const response = await axios.get(`${import.meta.env.BASE_URL}config/AvailableProductList.json`);
    availableProducts.value = response.data.products.filter(product => 
      product.apps && product.apps.includes("EasyCodec")
    );
    const selectToStartText = localize("@selectToStart");
    document.getElementById("outputArea").innerHTML = selectToStartText;
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
      if (bigGroupName === "batch_params") {
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
  ["batch_params", "standard_params"].forEach((bigGroupName) => {
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
    const response = await axios.get(`${import.meta.env.BASE_URL}config/${sensorFile}.json`);
    const rawConfig = response.data;

    // Apply localization to the configuration
    sensorConfig.value = applyLocalization(rawConfig);

    // Initialize states for checkboxes and fields
    initializeStates(sensorConfig.value);

    initParams(); // Initialize other parameters
  } catch (error) {
    console.error('Failed to load sensor config:', error);
  }
};

// Initialize default values for sensor parameters
const initParams = () => {
  if (sensorConfig.value) {
    for (const bigGroupName of ['batch_params', 'standard_params']) {
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
    document.getElementById("outputArea").innerHTML = localize("@selectAtLeastOneMode");
    framesAvailable.value = false;
    return;
  }

  // Set general params
  outputData.general_params = true;
  outputData.confirmed = true;
  outputVals.confirmed = "00";
  sensorConfig.value.confirmed.params.confirmed.enabled = true;
  paramGroupList.confirmed = sensorConfig.value.confirmed.params.confirmed;
  
  Object.keys(sensorConfig.value).forEach((bigGroupName) => {
    // Skip processing if the category is unchecked
    if ((bigGroupName === 'batch_params' && !batchChecked.value) || 
        (bigGroupName === 'standard_params' && !standardChecked.value)) {
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
  
  document.getElementById("outputArea").innerHTML = outputFrameTxt;
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
  loadAvailableProducts();
  loadLocalizationFiles().then(() => {
    currentLanguage.value = 'en';
  });
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

const toggleVisibility = (category) => {
  if (category === 'batch_params') {
    batchVisible.value = !batchVisible.value;
  } else if (category === 'standard_params') {
    standardVisible.value = !standardVisible.value;
  }
};

const toggleSubcategoryVisibility = (groupName) => {
  subcategoryVisible.value[groupName] = !subcategoryVisible.value[groupName];
};

const updateMaxValues = (bigGroupName, groupName, paramName) => {
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
  flex-direction: column;
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
  color: black;
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

#outputTitle {
  margin-bottom: 10px;
}

#outputArea {
  font-size: smaller;
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

/* Add responsive styles for smartphones */
@media (max-width: 600px) {
  .sensor-select {
    margin: 10px 20px;
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
}
</style>
