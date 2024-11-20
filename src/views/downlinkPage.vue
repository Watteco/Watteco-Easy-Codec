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
                label="Capteur"
                placeholder="Sélectionner un capteur"
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
        <ion-card v-if="sensorConfig && sensorConfig.batch_params" class="category-card">
          <ion-item class="config-item">
            <ion-label>{{ sensorConfig.batch_params.label }}</ion-label>
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
                    :step="calculateSteps(param.min_value, param.max_value)"
                    :groupName="groupName"
                    :paramName="paramName"
                    @update:value="onParamChange($event, 'batch_params', groupName, paramName)"
                    @update:units="onToggleChange($event, 'batch_params', groupName, paramName)"
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
                :step="calculateSteps(param.min_value, param.max_value)"
                @update:value="onParamChange($event, 'batch_params', 'global_params', paramName)"
                @update:units="onToggleChange($event, 'batch_params', 'global_params', paramName)"
              />
            </ion-item>
          </ion-card>
          
        </ion-card>

        <!-- Standard (standard_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.standard_params" class="category-card">
          <ion-item class="config-item">
            <ion-label>{{ sensorConfig.standard_params.label }}</ion-label>
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
                    :step="calculateSteps(param.min_value, param.max_value)"
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
                    :step="calculateSteps(param.min_value, param.max_value)"
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
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
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
  IonItem 
} from '@ionic/vue';
import TimeSlider from '@/components/TimeSlider.vue';
import DoubleSlider from '@/components/DoubleSlider.vue';
import axios from 'axios';

// Reactive variables
const availableProducts = ref([]); // For storing the list of products
const selectedSensor = ref('');
const sensorConfig = ref<any | null>(null); // Dynamic sensor data
const batchChecked = ref(false);
const standardChecked = ref(false);
const paramGroupChecked = ref<Record<string, boolean>>({}); // Checkboxes states (Temperature, Humidity, Battery)
const outputData: never[] = [];
const outputVals: never[] = [];
const paramGroupList: never[] = [];
const currentErrors: never[] = [];

const loadAvailableProducts = async () => {
  try {
    const response = await axios.get(`${import.meta.env.BASE_URL}config/AvailableProductList.json`);
    availableProducts.value = response.data.products.filter(product => 
      product.apps && product.apps.includes("EasyCodec")
    );
    document.getElementById("outputArea").innerHTML = "Sélectionnez un capteur pour commencer";
  } catch (error) {
    console.error("Erreur lors du chargement de AvailableProductList:", error);
  }
};

// Function to generate sensor change
const onSensorChange = (event: CustomEvent) => {
  const selected = event.detail.value;
  resetCheckboxes(); // Reset all checkboxes on sensor change
  loadSensorConfig(selected); // Load sensor config based on the selected sensor
};

const resetCheckboxes = () => {
  batchChecked.value = false;
  standardChecked.value = false;
  
  Object.keys(outputData).forEach(data => {
    outputData[data] = false;
  });
  Object.keys(paramGroupList).forEach(data => {
    paramGroupList[data] = false;
  });
  
  // Reset all checkboxes in paramGroupChecked
  for (const group in paramGroupChecked.value) {
    paramGroupChecked.value[group] = false;
  }
};

// Function to load selected sensors JSON
const loadSensorConfig = (sensorFile: string) => {
  axios.get(`${import.meta.env.BASE_URL}config/${sensorFile}.json`)
    .then((response) => {
      sensorConfig.value = response.data;
      initParams();
    })
    .catch((err) => {
      console.error("Failed to load sensor config:", err);
    });
};


// Initialisation of default values for each parameter
const initParams = () => {
  if (sensorConfig.value) {
    for (const section of [sensorConfig.value.batch_params, sensorConfig.value.standard_params]) {
      for (const groupName in section) {
        if (section[groupName] && (section[groupName].label || groupName === "global_params")) {
          paramGroupChecked.value[groupName] = false; // Initialisation of group checkboxes
          outputVals[groupName] = [section[groupName].fields];
          for (const paramName in section[groupName].fields) {
            const param = section[groupName].fields[paramName];
            if (param && param.HMI) {
              param.selectedValue = param.default_value;
              param.isHours = false; // Add isHours state for each parameter
              outputVals[paramName] = convertToHexFrameValue(param.selectedValue, param);
            }
          }
        }
      }
    }
  }
  updateOutput();
};

// Function to update the output area with the frames
const updateOutput = () => {
  let outputFrameTxt = "";

  outputData.general_params = true;
  outputData.confirmed = true;
  outputVals.confirmed = "00";
  sensorConfig.value.confirmed.params.confirmed.enabled = true
  paramGroupList.confirmed = sensorConfig.value.confirmed.params.confirmed;


  Object.keys(sensorConfig.value).forEach(bigGroupName => {
    
    // Loop through each configuration block within the bigGroupName
    Object.keys(sensorConfig.value[bigGroupName].cfg_block).forEach(key => {

      // Get the current config block
      let thisFrame = sensorConfig.value[bigGroupName].cfg_block[key] + "<br>";

      // Replace the placeholders with actual values from outputVals
      Object.keys(outputVals).forEach(valKey => {
        const enabled = paramGroupList[valKey]?.enabled
        if ((outputVals[valKey]).toString().includes(" ")) {
          thisFrame = replaceInFrame(thisFrame, valKey + '1', outputVals[valKey].toString().split(" ")[0], enabled);
          thisFrame = replaceInFrame(thisFrame, valKey + '2', outputVals[valKey].toString().split(" ")[1], enabled);
        } else {
          thisFrame = replaceInFrame(thisFrame, valKey, outputVals[valKey], enabled);
        }
      });
      if (outputData[bigGroupName]) {
        outputFrameTxt = outputFrameTxt + thisFrame;
      }
    });
  });
  if (!batchChecked.value && !standardChecked.value) {
    outputFrameTxt = "Veuillez sélectionner au moins un mode";
  }
  document.getElementById("outputArea").innerHTML = outputFrameTxt;
}

// Function to replace variable ID with corresponding value in a given frame
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
}

// Function to convert decimal values to hex ready for the frame
const convertToHexFrameValue = (value: string, param: {
  HMI: any; type: string; isHours: boolean; 
}) => {
  if (!value || !param) return 1;
  let output = '';

  if (value.includes(" ")) {
    output = ""
    value.split(" ").forEach(function(item) {
      const val = parseInt(item);
      const out = convertToHexFrameValue(val.toString(), param);
      output = `${output} ${out}`
    });
    output = output.trim();
  } else {
    if (param.HMI.multiplier) {
      value = (parseInt(value)*param.HMI.multiplier).toString()
    }
    if (param.type == "timeInt32") {
      if (param.isHours) {
        value = (parseInt(value) * 60).toString();
      }
      output = (parseInt(value) + 32768).toString(16).padStart(4, '0');
    } else if (param.type == "int32") {
      output = parseInt(value).toString(16).padStart(4, '0');
    } else {
      output = `-Error: ${value} is ${param.type}, not supported-`;
    }
  }
  return (output);
}

// Function to manage category checkboxes
const onCategoryCheckedChange = (event: CustomEvent, category: string) => {
  if(sensorConfig.value[category].global_params) {
    Object.keys(sensorConfig.value[category].global_params.fields).forEach(field => {
      sensorConfig.value[category].global_params.fields[field].enabled = event.detail.checked;
      paramGroupList[field] = sensorConfig.value[category].global_params.fields[field];
    });
  }
  outputData[category] = event.detail.checked;
  updateOutput();
};

// Function to manage batch checkbox
const onBatchCheckedChange = (event: CustomEvent) => {
  batchChecked.value = event.detail.checked;
  onCategoryCheckedChange(event, "batch_params");
};

// Function to manage standard checkbox
const onStandardCheckedChange = (event: CustomEvent) => {
  standardChecked.value = event.detail.checked;
  onCategoryCheckedChange(event, "standard_params");
};

// Function to manage group checkboxes
const onParamGroupCheckedChange = (event: CustomEvent, groupName: string | number, bigGroupName: string) => {
  paramGroupChecked.value[groupName] = event.detail.checked;
  Object.keys(sensorConfig.value[bigGroupName][groupName].fields).forEach(field => {
    sensorConfig.value[bigGroupName][groupName].fields[field].enabled = event.detail.checked;
    paramGroupList[field] = sensorConfig.value[bigGroupName][groupName].fields[field];
  });
  sensorConfig.value[bigGroupName][groupName].fields
  outputData[groupName] = event.detail.checked;
  updateOutput();
};

// Function to manage parameter change
const onParamChange = (event: { newValue: number; detail: { value: { lower: number; upper: number; }; }; }, bigGroupName: string, groupName: string | number, paramName: string | number) => {
  // Check if groupName exists in sensorConfig
  if (sensorConfig.value[bigGroupName][groupName]) {
    // Check if the paramName exists within the group
    if (sensorConfig.value[bigGroupName][groupName].fields[paramName]) {
      let newVal = "0";
      if (event.newValue) {
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

// Function to manage toggles
const onToggleChange = (event: { isHours: boolean; }, bigGroupName: string, groupName: string | number, paramName: string | number) => {
  if (sensorConfig.value[bigGroupName][groupName] && sensorConfig.value[bigGroupName][groupName].fields[paramName]) {
    const param = sensorConfig.value[bigGroupName][groupName].fields[paramName]
    param.isHours = event.isHours;
    outputVals[paramName] = convertToHexFrameValue(param.selectedValue, param);
  } else {
    console.error('Invalid groupName or paramName:', groupName, paramName);
  }
  updateOutput();
};

// Load available products when the component is mounted
onMounted(() => {
  loadAvailableProducts(); // Load the products into availableProducts
});

// Function to calculate slider steps
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
}
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
}

#config-card {
  width: 33%;
  background-color: #555555;
}

ion-card {
  --background: #555555;
  --color: #ffffff;
  border-radius: 25px;
}

ion-card-content {
  font-size: 1.5rem;
}

ion-select.always-flip::part(icon) {
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

ion-select.always-flip.select-expanded::part(icon) {
  transform: rotate(180deg);
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
