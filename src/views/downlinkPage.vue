<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="card-holder">
        
        <!-- Sélecteur de capteur -->
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

        <!-- Historisation (batch_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.batch_params" class="category-card">
          <ion-item class="config-item">
            <ion-label>{{ sensorConfig.batch_params.label }}</ion-label>
            <ion-checkbox @ionChange="onBatchCheckedChange"></ion-checkbox>
          </ion-item>

          <!-- Température, Humidité, Batterie (batch_params) -->
          <ion-card v-for="(paramGroup, groupName) in sensorConfig.batch_params" 
                    :key="groupName" 
                    v-show="batchChecked && paramGroup.label" 
                    class="subcategory-card">
            <ion-item class="config-item">
              <ion-label>{{ paramGroup.label }}</ion-label>
              <ion-checkbox @ionChange="onParamGroupCheckedChange($event, groupName, 'batch_params')"></ion-checkbox>
            </ion-item>

            <!-- Champs dynamiques par groupe -->
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

        <!-- Seuil (standard_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.standard_params" class="category-card">
          <ion-item class="config-item">
            <ion-label>{{ sensorConfig.standard_params.label }}</ion-label>
            <ion-checkbox @ionChange="onStandardCheckedChange" disabled="false"></ion-checkbox>
          </ion-item>

          <!-- Température, Humidité, Batterie (standard_params) -->
          <ion-card v-for="(paramGroup, groupName) in sensorConfig.standard_params" 
                    :key="groupName" 
                    v-show="standardChecked && paramGroup.label" 
                    class="subcategory-card">
            <ion-item class="config-item">
              <ion-label>{{ paramGroup.label }}</ion-label>
              <ion-checkbox @ionChange="onParamGroupCheckedChange($event, groupName, 'standard_params')"></ion-checkbox>
            </ion-item>

            <!-- Champs dynamiques par groupe -->
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

                  <!-- Double Slider (Seuils) -->
                  <ion-range v-if="param.HMI?.visual_type === 'doubleSlider'"
                    :min="param.min_value"
                    :max="param.max_value"
                    :value="{ lower: param.default_value.split(' ')[0], upper: param.default_value.split(' ')[1] }"
                    :step="calculateSteps(param.min_value, param.max_value)"
                    pin="true"
                    snaps="true"
                    color="primary"
                    dual-knobs="true"
                    @ionChange="onParamChange($event, 'standard_params', groupName, paramName)">
                  </ion-range>

                  <!-- Checkbox -->
                  <ion-checkbox v-if="param.HMI?.visual_type === 'Checkbox'"
                                @ionChange="onParamChange($event, 'standard_params', groupName, paramName)">
                  </ion-checkbox>
                </ion-item>
              </ion-card>
            </ul>
          </ion-card>
        </ion-card>
      
        <ion-card> 
          <ion-card-content class="sensor-select">
            
          <ion-label id="outputStuff">  </ion-label> 
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AvailableProductList from '@/config/AvailableProductList.json'; // Import the JSON file
import TimeSlider from '@/components/TimeSlider.vue';
import { computed } from 'vue';

// Variables réactives
const availableProducts = ref([]); // For storing the list of products
const selectedSensor = ref('');
const sensorConfig = ref<any | null>(null); // Données dynamiques du capteur
const batchChecked = ref(false);
const standardChecked = ref(false);
const paramGroupChecked = ref<Record<string, boolean>>({}); // État des checkboxes pour chaque groupe (Température, Humidité, Batterie)
const outputStuff = [];
const outputVals = [];
const paramGroupList = [];
const currentErrors = [];

const calculateSteps = (min: number, max: number) => { //calculateSteps(param.min_value, param.max_value)
  //return 1;
  console.log(min, max);
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
  console.log("step:", roundedStep);
  return roundedStep;
}

// Fonction pour gérer le changement de capteur
const onSensorChange = (event: CustomEvent) => {
  const selected = event.detail.value;
  console.log('Selected sensor:', selected);
  loadSensorConfig(selected); // Load sensor config based on the selected sensor
};

// Fonction pour charger le JSON du capteur basé sur la sélection
const loadSensorConfig = (sensorFile) => {
  import(`@/config/${sensorFile}.json`).then((module) => {
    sensorConfig.value = module.default;
    initParams();
  }).catch((err) => {
    console.error("Failed to load sensor config:", err);
  });
};

// Fonction pour charger les produits disponibles depuis le JSON
const loadAvailableProducts = () => {
  availableProducts.value = AvailableProductList.products;
};

// Initialiser les valeurs par défaut pour chaque paramètre
const initParams = () => {
  if (sensorConfig.value) {
    for (const section of [sensorConfig.value.batch_params, sensorConfig.value.standard_params]) {
      for (const groupName in section) {
        if (section[groupName] && (section[groupName].label || groupName === "global_params")) {
          paramGroupChecked.value[groupName] = false; // Initialisation des checkboxes des groupes
          outputVals[groupName] = [section[groupName].fields];
          for (const paramName in section[groupName].fields) {
            const param = section[groupName].fields[paramName];
            if (param && param.HMI) {
              param.selectedValue = param.default_value;
              param.isHours = false; // Ajoute un état isHours pour chaque paramètre
              outputVals[paramName] = convertToHexFrameValue(param.selectedValue, param);
              console.log('Initialized param:', paramName, param.selectedValue); // Debug
            }
          }
        }
      }
    }
  }
  //console.log(outputVals);
};

const updateOutput = () => {
  let outputFrameTxt = "";

  outputStuff.general_params = true;
  outputStuff.confirmed = true;
  outputVals.confirmed = "00";
  sensorConfig.value.confirmed.params.confirmed.enabled = true
  paramGroupList.confirmed = sensorConfig.value.confirmed.params.confirmed;


  Object.keys(sensorConfig.value).forEach(bigGroupName => {
    
    // Loop through each configuration block within the bigGroupName
    Object.keys(sensorConfig.value[bigGroupName].cfg_block).forEach(key => {

      // Get the current config block
      let thisFrame = sensorConfig.value[bigGroupName].cfg_block[key] + "<br>";

      // Replace the placeholders with actual values from outputVals
      //console.log(outputVals);
      Object.keys(outputVals).forEach(valKey => {
        let enabled = paramGroupList[valKey]?.enabled
        if ((outputVals[valKey]).toString().includes(" ")) {
          //console.log(outputVals[valKey], valKey)
          thisFrame = replaceInFrame(thisFrame, valKey + '1', outputVals[valKey].toString().split(" ")[0], enabled);
          thisFrame = replaceInFrame(thisFrame, valKey + '2', outputVals[valKey].toString().split(" ")[1], enabled);
        } else {
          thisFrame = replaceInFrame(thisFrame, valKey, outputVals[valKey], enabled);
        }
      });
      if (outputStuff[bigGroupName]) {
        outputFrameTxt = outputFrameTxt + thisFrame;
      }
    });
  });
  document.getElementById("outputStuff").innerHTML = outputFrameTxt;
}

const replaceInFrame = (frame: string, key: string, value: string, enabled: string) => {
  //console.log(value, key);
  if (value !== undefined && value !== null) {
    if (frame.includes(key)) {
      frame = frame.replace(RegExp(`\\(${key}\\)`, 'g'), `${value}`);
    
      if (!enabled) {
        frame = '';
        //frame = `DISABLED(${key}) ${frame}` //Debug
      }
    }
  }
  return frame;
}

const convertToHexFrameValue = (value: string, param: { type: string; isHours: boolean; }) => {
  if (!value || !param) return 1;
  //console.log(`value: ${value}`);
  //console.log(param);
  let output = '';

  if (value.includes(" ")) {
    const val1 = parseInt(value.split(" ")[0]);
    const val2 = parseInt(value.split(" ")[1]);
    const out1 = convertToHexFrameValue(val1.toString(), param);
    const out2 = convertToHexFrameValue(val2.toString(), param);
    console.log(out1, out2);
    output = `${out1} ${out2}`
  } else {

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
  //console.log(output);
  return (output);
}

// Fonction pour gérer le changement de case à cocher
const onCategoryCheckedChange = (event: CustomEvent, category: string) => {
  if(sensorConfig.value[category].global_params) {
    Object.keys(sensorConfig.value[category].global_params.fields).forEach(field => {
      sensorConfig.value[category].global_params.fields[field].enabled = event.detail.checked;
      paramGroupList[field] = sensorConfig.value[category].global_params.fields[field];
    });
  }
  console.log(`${category} ${event.detail.checked}`);
  outputStuff[category] = event.detail.checked;
  updateOutput();
};

// Fonction pour gérer le changement de la case à cocher de batch params
const onBatchCheckedChange = (event: CustomEvent) => {
  batchChecked.value = event.detail.checked;
  onCategoryCheckedChange(event, "batch_params");
};

// Fonction pour gérer le changement de la case à cocher de standard params
const onStandardCheckedChange = (event: CustomEvent) => {
  standardChecked.value = event.detail.checked;
  onCategoryCheckedChange(event, "standard_params");
};

// Gérer les checkboxes des groupes
const onParamGroupCheckedChange = (event: CustomEvent, groupName: string, bigGroupName: string) => {
  paramGroupChecked.value[groupName] = event.detail.checked;
  Object.keys(sensorConfig.value[bigGroupName][groupName].fields).forEach(field => {
    sensorConfig.value[bigGroupName][groupName].fields[field].enabled = event.detail.checked;
    paramGroupList[field] = sensorConfig.value[bigGroupName][groupName].fields[field];
  });
  sensorConfig.value[bigGroupName][groupName].fields
  outputStuff[groupName] = event.detail.checked;
  updateOutput();
};

const onParamChange = (event: { newValue: number; detail: { value: { lower: number; upper: number; }; }; }, bigGroupName: string, groupName: string, paramName: string) => {
  // Check if groupName exists in sensorConfig
  //console.log(event);
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
      console.log(`Updated param: ${paramName} in group: ${groupName} with value: ${newVal}`);
      outputVals[paramName] = convertToHexFrameValue(newVal, sensorConfig.value[bigGroupName][groupName].fields[paramName]);
    } else {
      console.error('Invalid paramName:', paramName, 'in group:', groupName);
    }
  } else {
    console.error('Invalid groupName:', groupName);
  }
  //console.log(outputVals);
  updateOutput();
};

// Gérer les toggles pour chaque paramètre indépendamment
const onToggleChange = (event: { isHours: boolean; }, bigGroupName: string, groupName: string, paramName: string) => {
  if (sensorConfig.value[bigGroupName][groupName] && sensorConfig.value[bigGroupName][groupName].fields[paramName]) {
    const param = sensorConfig.value[bigGroupName][groupName].fields[paramName]
    param.isHours = event.isHours;
    console.log(`Updated unit: ${paramName} in group: ${groupName} with unit: ${event.isHours?"Hours":"Minutes"}`);
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
  flex: 1 1 45%; /* prend environ 45% de la largeur, ajustable */
  min-width: 200px; /* largeur minimale pour chaque item */
  margin: 10px; /* espacement entre les items */
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
