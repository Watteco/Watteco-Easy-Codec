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

            <sensor-image 
              v-if="sensorImage" 
              :image="sensorImage" 
              :alt-text="selectedSensor" 
            />
          </ion-card-content>
        </ion-card>
        
      <div class="card-holder" v-show="sensorConfigLoaded">
        <!-- General (general_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.general_params" class="category-card" :key="`general-${currentLanguage}-${selectedSensor}`">
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
                      :class="['subcategory-card', { 'full-width': hasIonRange(paramGroup.fields) }]">
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
                      :inverted="param.inverted === 'true'"
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

                    <!-- Using the DropDown component -->
                    <drop-down
                      v-if="param.HMI?.visual_type === 'dropdown'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :choices="param.choices"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'general_params', groupName, paramName)"
                    />

                    <!-- Using the NumInput component -->
                    <num-input
                      v-if="param.HMI?.visual_type === 'numInput' && param.type !== 'float'"
                      :label="param.HMI?.label"     
                      :value="param.selectedValue"
                      :min="param.min_value"
                      :max="param.max_value"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'general_params', groupName, paramName)"
                    />

                    <!-- Using the FloatInput component -->
                    <float-input
                      v-if="param.HMI?.visual_type === 'numInput' && param.type === 'float'"
                      :label="param.HMI?.label"     
                      :value="param.selectedValue"
                      :min="parseFloat(param.min_value)"
                      :max="parseFloat(param.max_value)"
                      :step="param.step ? parseFloat(param.step) : 0.01"
                      :precision="param.precision ? parseInt(param.precision) : 2"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'general_params', groupName, paramName)"
                    />

                    <!-- Using the TextInput component -->
                    <text-input
                      v-if="param.HMI?.visual_type === 'textInput'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :placeholder="param.placeholder"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'general_params', groupName, paramName)"
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

        <!-- ModBus (modbus_params) -->
        <ion-card v-if="sensorConfig?.modbus_params" class="category-card" :key="`modbus-${currentLanguage}-${selectedSensor}`">
          <ion-item class="config-item">
            <ion-label>{{ localize("@modbusLabel") }}</ion-label>
            <ion-checkbox :checked="modbusChecked" @ionChange="onModbusCheckedChange"></ion-checkbox>
            <ion-button class="visibility-button" :class="{ invisible: !modbusChecked }" @click="toggleVisibility('modbus_params')">{{ modbusVisible ? '–' : '+' }}</ion-button>
          </ion-item>

          <div class="subcategory-card-holder" v-show="modbusVisible">
            <!-- Temperature, Humidity, Battery (modbus_params) -->
            <ion-card v-for="(paramGroup, groupName) in sensorConfig.modbus_params" 
                      :key="groupName" 
                      v-show="modbusChecked && paramGroup.label" 
                      :class="['subcategory-card', { 'full-width': hasIonRange(paramGroup.fields) }]">
              <ion-item class="config-item">
                <ion-label>{{ paramGroup.label }}</ion-label>

                <ion-checkbox 
                  :checked="paramGroupChecked[groupName] || false"
                  @ionChange="onParamGroupCheckedChange($event, groupName, 'modbus_params')"
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
                      @update:value="onParamChange($event, 'modbus_params', groupName, paramName)"
                      @update:units="onToggleChange($event, 'modbus_params', groupName, paramName)"
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
                      @update:value="onParamChange($event, 'modbus_params', groupName, paramName)"
                    />

                    <!-- Using the CheckBox component -->
                    <check-box
                      v-if="param.HMI?.visual_type === 'checkbox'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :groupName="groupName"
                      :paramName="paramName"
                      :inverted="param.inverted === 'true'"
                      @update:value="onParamChange($event, 'modbus_params', groupName, paramName)"
                    />

                    <!-- Using the CustomValue component -->
                    <custom-value
                      v-if="param.HMI?.visual_type === 'customValue'"
                      :label="localize(`${param.HMI?.label} @customFixed `) + param.valueText"
                      :value="param.value"
                      :groupName="groupName"
                      :paramName="paramName"
                    />

                    <!-- Using the DropDown component -->
                    <drop-down
                      v-if="param.HMI?.visual_type === 'dropdown'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :choices="param.choices"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'modbus_params', groupName, paramName)"
                    />

                    <!-- Using the NumInput component -->
                    <num-input
                      v-if="param.HMI?.visual_type === 'numInput' && param.type !== 'float'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="param.min_value"
                      :max="param.max_value"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'modbus_params', groupName, paramName)"
                    />

                    <!-- Using the FloatInput component -->
                    <float-input
                      v-if="param.HMI?.visual_type === 'numInput' && param.type === 'float'"
                      :label="param.HMI?.label"     
                      :value="param.selectedValue"
                      :min="parseFloat(param.min_value)"
                      :max="parseFloat(param.max_value)"
                      :step="param.step ? parseFloat(param.step) : 0.01"
                      :precision="param.precision ? parseInt(param.precision) : 2"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'modbus_params', groupName, paramName)"
                    />

                    <!-- Using the TextInput component -->
                    <text-input
                      v-if="param.HMI?.visual_type === 'textInput'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :placeholder="param.placeholder"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'modbus_params', groupName, paramName)"
                    />

                  </ion-item>
                </ion-card>
              </ul>
              <!-- Add frames display at the bottom of each paramGroup card -->
              <ion-card-content v-if="subcategoryVisible[groupName] && paramGroupChecked[groupName]" class="showFrameButton">                
                <ion-button @click="toggleFramesVisibility(groupName)" class="small-button">
                  {{ framesVisible[groupName] ? localize(framesCount[groupName] > 1 ? "@hideFrames" : "@hideFrame") : localize(framesCount[groupName] > 1 ? "@showFrames" : "@showFrame") }}
                </ion-button>
                <div v-show="framesVisible[groupName]" v-html="generateFramesForGroup('modbus_params', groupName)"></div>
              </ion-card-content>
            </ion-card>
          </div>
          
        </ion-card>


        <!-- Batch (batch_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.batch_params" class="category-card" :key="`batch-${currentLanguage}-${selectedSensor}`">
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
                      :class="['subcategory-card', { 'full-width': hasIonRange(paramGroup.fields) }]">
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
                      @update:value="onParamChange($event, 'batch_params', groupName, paramName)"
                    />

                    <!-- Using the CheckBox component -->
                    <check-box
                      v-if="param.HMI?.visual_type === 'checkbox'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :groupName="groupName"
                      :paramName="paramName"
                      :inverted="param.inverted === 'true'"
                      @update:value="onParamChange($event, 'batch_params', groupName, paramName)"
                    />

                    <!-- Using the CustomValue component -->
                    <custom-value
                      v-if="param.HMI?.visual_type === 'customValue'"
                      :label="localize(`${param.HMI?.label} @customFixed `) + param.valueText"
                      :value="param.value"
                      :groupName="groupName"
                      :paramName="paramName"
                    />

                    <!-- Using the DropDown component -->
                    <drop-down
                      v-if="param.HMI?.visual_type === 'dropdown'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :choices="param.choices"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'batch_params', groupName, paramName)"
                    />

                    <!-- Using the NumInput component -->
                    <num-input
                      v-if="param.HMI?.visual_type === 'numInput' && param.type !== 'float'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="param.min_value"
                      :max="param.max_value"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'batch_params', groupName, paramName)"
                    />

                    <!-- Using the FloatInput component -->
                    <float-input
                      v-if="param.HMI?.visual_type === 'numInput' && param.type === 'float'"
                      :label="param.HMI?.label"     
                      :value="param.selectedValue"
                      :min="parseFloat(param.min_value)"
                      :max="parseFloat(param.max_value)"
                      :step="param.step ? parseFloat(param.step) : 0.01"
                      :precision="param.precision ? parseInt(param.precision) : 2"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'batch_params', groupName, paramName)"
                    />

                    <!-- Using the TextInput component -->
                    <text-input
                      v-if="param.HMI?.visual_type === 'textInput'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :placeholder="param.placeholder"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'batch_params', groupName, paramName)"
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
            <ion-card class="global-batch-settings" v-if="sensorConfig.batch_params.global_params && batchChecked" v-for="(param, paramName) in sensorConfig.batch_params.global_params.fields" 
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
        <ion-card v-if="sensorConfig && sensorConfig.standard_params" class="category-card" :key="`standard-${currentLanguage}-${selectedSensor}`">
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
                      :class="['subcategory-card', { 'full-width': hasIonRange(paramGroup.fields) }]">
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
                      :inverted="param.inverted === 'true'"
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

                    <!-- Using the DropDown component -->
                    <drop-down
                      v-if="param.HMI?.visual_type === 'dropdown'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :choices="param.choices"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'standard_params', groupName, paramName)"
                    />

                    <!-- Using the NumInput component -->
                    <num-input
                      v-if="param.HMI?.visual_type === 'numInput' && param.type !== 'float'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="param.min_value"
                      :max="param.max_value"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'standard_params', groupName, paramName)"
                    />

                    <!-- Using the FloatInput component -->
                    <float-input
                      v-if="param.HMI?.visual_type === 'numInput' && param.type === 'float'"
                      :label="param.HMI?.label"     
                      :value="param.selectedValue"
                      :min="parseFloat(param.min_value)"
                      :max="parseFloat(param.max_value)"
                      :step="param.step ? parseFloat(param.step) : 0.01"
                      :precision="param.precision ? parseInt(param.precision) : 2"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'standard_params', groupName, paramName)"
                    />

                    <!-- Using the TextInput component -->
                    <text-input
                      v-if="param.HMI?.visual_type === 'textInput'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :placeholder="param.placeholder"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'standard_params', groupName, paramName)"
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

      <ion-card class="outputCard" v-show="sensorConfigLoaded && !(sensorConfig?.general_params?.outputCardHidden)">
        <ion-card-content class="output-area">
        <ion-label v-if="!ble.isNative.value" id="outputTitle">{{ localize("@port125") }}</ion-label>
        <ion-label id="outputArea">  </ion-label>

        <!-- Web: copy to clipboard (unchanged behavior) -->
        <ion-button v-if="framesAvailable && !ble.isNative.value" @click="copyFramesNoSpaces" class="half-width">{{ localize("@copyFrames") }}</ion-button>

        <!-- Native: BLE send (connection managed by BleConnectPage) -->
        <div v-if="ble.isNative.value" class="ble-panel">
          <div class="ble-actions">
            <ion-chip :color="ble.connected.value ? 'success' : 'warning'" size="small">
              {{ ble.connected.value
                ? localize('@bleConnectedTo') + ' ' + ble.getDeviceName(ble.connectedDevice.value!)
                : localize('@bleNotConnected') }}
            </ion-chip>
            <ion-button v-if="framesAvailable && ble.connected.value" @click="sendFramesBle" :disabled="ble.sending.value" class="half-width" color="primary">
              {{ ble.sending.value ? localize('@bleSending') : localize('@bleSendFrames') }}
            </ion-button>
            <ion-button @click="disconnectAndGoBack" size="small" fill="outline" color="danger">
              {{ localize('@bleDisconnect') }}
            </ion-button>
          </div>
          <div v-if="ble.statusMessage.value" class="ble-status-msg">
            <ion-text color="medium">{{ ble.statusMessage.value }}</ion-text>
          </div>
        </div>

        </ion-card-content>
      </ion-card>
    </ion-content>
  <!-- Debug panel for fe61 / fe62 -->
  <div class="debug-panel" v-show="debugVisible" style="position:fixed;right:12px;bottom:12px;z-index:1000;width:320px;max-height:40vh;overflow:auto;background:#fff;border:1px solid #ccc;border-radius:6px;padding:8px;box-shadow:0 2px 8px rgba(0,0,0,0.2)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <strong>BLE debug (fe61 / fe62)</strong>
      <div>
        <ion-button size="small" fill="outline" @click="startDebugSubscriptions" :disabled="!ble.connected.value || debugSubscribed.value">Start</ion-button>
        <ion-button size="small" fill="outline" color="danger" @click="stopDebugSubscriptions" :disabled="!debugSubscribed.value">Stop</ion-button>
        <ion-button size="small" fill="clear" @click="clearDebugLogs">Clear</ion-button>
        <ion-button size="small" fill="solid" color="tertiary" @click="autoFetchModelFirmware" :disabled="!ble.connected.value">Fetch model/fw</ion-button>
      </div>
    </div>
    <div style="font-size:12px;margin-bottom:6px">
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <input v-model="debugHex" placeholder="Hex (e.g. 01 02)" style="flex:1;padding:6px;border:1px solid #ccc;border-radius:4px;font-family:monospace;font-size:12px" />
        <ion-button size="small" fill="solid" @click="writeToFe62" :disabled="!ble.connected.value">Write FE62</ion-button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <ion-button size="small" fill="outline" @click="readFe61" :disabled="!ble.connected.value">Read FE61</ion-button>
        <ion-button size="small" fill="clear" @click="dumpServices" :disabled="!ble.connected.value">Dump services</ion-button>
      </div>
    </div>
    <div style="font-family:monospace;font-size:12px;line-height:1.2;overflow:auto;max-height:24vh">
      <div v-for="(l, idx) in debugLogs" :key="idx">{{ l }}</div>
      <div v-if="debugLogs.length === 0" style="color:#666">No messages</div>
    </div>
  </div>
  <!-- Toggle button to open debug panel (dev only) -->
  <div style="position:fixed;left:12px;bottom:12px;z-index:1100">
    <ion-button size="small" fill="solid" color="medium" @click="debugVisible = !debugVisible" style="padding:6px 8px">
      <span v-if="!debugVisible">DBG</span>
      <span v-else>✕</span>
    </ion-button>
  </div>
  <div class="language-switcher">
    <LanguageSwitcher 
      :current-language="currentLanguage"
      @update:language="changeLanguage"
    />
  </div>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted, nextTick, provide } from 'vue';
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
  IonButton,
  IonText
} from '@ionic/vue';
import { useRouter } from 'vue-router';
import { useBle } from '@/composables/useBle';
import { BleClient } from '@capacitor-community/bluetooth-le';
import TimeSlider from '@/components/TimeSlider.vue';
import DoubleSlider from '@/components/DoubleSlider.vue';
import CheckBox from '@/components/CheckBox.vue';
import CustomValue from '@/components/CustomValue.vue';
import CustomFrame from '@/components/CustomFrame.vue';
import DropDown from '@/components/DropDown.vue';
import NumInput from '@/components/NumInput.vue';
import FloatInput from '@/components/FloatInput.vue';
import TextInput from '@/components/TextInput.vue';
import SensorImage from '@/components/SensorImage.vue';
import axios from 'axios';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';

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
];

// BLE composable (only active on native platforms, no-op on web)
const ble = useBle();

// Debug panel: subscribe to fe61 / fe62 services and show incoming data
const debugVisible = ref(false);
const debugLogs = ref<string[]>([]);
const debugSubscribed = ref(false);

function dataViewToHex(dv: DataView | ArrayBuffer | Uint8Array | any) {
  try {
    let arr: Uint8Array;
    if (dv instanceof DataView) arr = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    else if (dv instanceof ArrayBuffer) arr = new Uint8Array(dv);
    else if (dv instanceof Uint8Array) arr = dv;
    else if (dv && dv.value instanceof DataView) arr = new Uint8Array(dv.value.buffer, dv.value.byteOffset, dv.value.byteLength);
    else if (dv && dv.value instanceof ArrayBuffer) arr = new Uint8Array(dv.value);
    else return JSON.stringify(dv);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(' ');
  } catch (e) {
    return String(dv);
  }
}

async function startDebugSubscriptions() {
  if (!ble.connected.value || !ble.connectedDevice.value) return;
  if (debugSubscribed.value) return;
  const deviceId = ble.connectedDevice.value.deviceId;
  try {
    const services: any[] = await BleClient.getServices(deviceId);
    // helper to normalize 16-bit UUIDs to full UUID
    const normalizeUuidLocal = (s: string) => {
      if (!s) return s;
      const lower = s.toLowerCase();
      if (/^[0-9a-f]{4}$/.test(lower)) return `0000${lower}-0000-1000-8000-00805f9b34fb`;
      return lower;
    };

    for (const s of services) {
      const svcUuid = (s.uuid || '').toLowerCase();
      // target Cable Replacement Service (FE60)
      if (!svcUuid.includes('fe60')) continue;
      if (!s.characteristics) continue;
      for (const c of s.characteristics) {
        const charUuid = (c.uuid || '').toLowerCase();
        // target RX/TX chars (FE61/FE62)
        if (!(charUuid.includes('fe61') || charUuid.includes('fe62'))) continue;
        const props = c.properties || {};
        const svcId = normalizeUuidLocal(s.uuid || svcUuid);
        const charId = normalizeUuidLocal(c.uuid || charUuid);
        debugLogs.value.unshift(`Found ${svcId} / ${charId} props:${Object.keys(props).filter(k=>props[k]).join(',')}`);
        try {
          if (props.notify || props.indicate) {
            await BleClient.startNotifications(deviceId, svcId, charId, (val: any) => {
              const hex = dataViewToHex(val);
              const ts = new Date().toLocaleTimeString();
              debugLogs.value.unshift(`${ts} [NOTIF ${svcId.slice(0,8)}:${charId.slice(0,8)}] ${hex}`);
              if (debugLogs.value.length > 200) debugLogs.value.pop();
            });
            // attempt an initial read to fetch any retained value
            try {
              const read = await BleClient.read(deviceId, svcId, charId);
              const hex = dataViewToHex(read);
              const ts = new Date().toLocaleTimeString();
              debugLogs.value.unshift(`${ts} [READ ${svcId.slice(0,8)}:${charId.slice(0,8)}] ${hex}`);
            } catch (e) {}
          } else {
            // no notify: try read
            try {
              const read = await BleClient.read(deviceId, svcId, charId);
              const hex = dataViewToHex(read);
              const ts = new Date().toLocaleTimeString();
              debugLogs.value.unshift(`${ts} [READ ${svcId.slice(0,8)}:${charId.slice(0,8)}] ${hex}`);
            } catch (e) {
              debugLogs.value.unshift(`Read failed ${svcId} ${charId} -> ${e?.message ?? e}`);
            }
          }
        } catch (e) {
          debugLogs.value.unshift(`Subscribe/read failed ${svcId} ${charId} -> ${e?.message ?? e}`);
        }
      }
    }
    debugSubscribed.value = true;
  } catch (e) {
    debugLogs.value.unshift(`Service discovery failed: ${e?.message ?? e}`);
  }
}

async function stopDebugSubscriptions() {
  if (!ble.connectedDevice.value) return;
  const deviceId = ble.connectedDevice.value.deviceId;
  try {
    const services: any[] = await BleClient.getServices(deviceId);
    for (const s of services) {
      const svcUuid = (s.uuid || '').toLowerCase();
      if (!svcUuid.includes('fe60')) continue;
      if (!s.characteristics) continue;
      for (const c of s.characteristics) {
        const charUuid = (c.uuid || '').toLowerCase();
        if (!(charUuid.includes('fe61') || charUuid.includes('fe62'))) continue;
        const normalizeUuidLocal = (s: string) => {
          if (!s) return s;
          const lower = s.toLowerCase();
          if (/^[0-9a-f]{4}$/.test(lower)) return `0000${lower}-0000-1000-8000-00805f9b34fb`;
          return lower;
        };
        try { await BleClient.stopNotifications(deviceId, normalizeUuidLocal(s.uuid || svcUuid), normalizeUuidLocal(c.uuid || charUuid)); } catch {}
      }
    }
  } catch {}
  debugSubscribed.value = false;
}

function clearDebugLogs() { debugLogs.value = []; }

const debugHex = ref('01');

function parseHexToUint8Array(hex: string): Uint8Array | null {
  if (!hex) return new Uint8Array([]);
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2 !== 0) return null;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
  }
  return bytes;
}

async function findCharacteristic(deviceId: string, targetCharShort: string) {
  try {
    const services: any[] = await BleClient.getServices(deviceId);
    for (const s of services) {
      const svcUuid = (s.uuid || '').toLowerCase();
      if (!svcUuid.includes('fe60')) continue;
      if (!s.characteristics) continue;
      for (const c of s.characteristics) {
        const charUuid = (c.uuid || '').toLowerCase();
        if (charUuid.includes(targetCharShort)) {
          const normalize = (u: string) => (/^[0-9a-f]{4}$/i.test(u) ? `0000${u}-0000-1000-8000-00805f9b34fb` : u);
          return { service: normalize(s.uuid || svcUuid), characteristic: normalize(c.uuid || charUuid), props: c.properties || {} };
        }
      }
    }
  } catch (e) {
    debugLogs.value.unshift(`findCharacteristic failed: ${e?.message ?? e}`);
  }
  return null;
}

async function writeToCharacteristicByShort(deviceId: string, shortChar: string, data: Uint8Array) {
  const found = await findCharacteristic(deviceId, shortChar);
  if (!found) { debugLogs.value.unshift(`Char ${shortChar} not found`); return; }
  try {
    const dv = new DataView(data.buffer);
    // prefer writeWithoutResponse if available
    if (found.props.writeWithoutResponse) {
      await BleClient.writeWithoutResponse(deviceId, found.service, found.characteristic, dv);
      debugLogs.value.unshift(`${new Date().toLocaleTimeString()} [WRITE-wo ${found.characteristic.slice(0,8)}] ${Array.from(data).map(b=>b.toString(16).padStart(2,'0')).join(' ')}`);
    } else if (found.props.write) {
      await BleClient.write(deviceId, found.service, found.characteristic, dv);
      debugLogs.value.unshift(`${new Date().toLocaleTimeString()} [WRITE ${found.characteristic.slice(0,8)}] ${Array.from(data).map(b=>b.toString(16).padStart(2,'0')).join(' ')}`);
    } else {
      debugLogs.value.unshift(`Char ${found.characteristic} not writable`);
    }
  } catch (e) {
    debugLogs.value.unshift(`Write failed: ${e?.message ?? e}`);
  }
}

async function writeToFe61() {
  if (!ble.connectedDevice.value) return;
  const bytes = parseHexToUint8Array(debugHex.value);
  if (!bytes) { debugLogs.value.unshift('Invalid hex'); return; }
  await writeToCharacteristicByShort(ble.connectedDevice.value.deviceId, 'fe61', bytes);
}

async function writeToFe62() {
  if (!ble.connectedDevice.value) return;
  const bytes = parseHexToUint8Array(debugHex.value);
  if (!bytes) { debugLogs.value.unshift('Invalid hex'); return; }
  await writeToCharacteristicByShort(ble.connectedDevice.value.deviceId, 'fe62', bytes);
}

async function readCharacteristicByShort(deviceId: string, shortChar: string) {
  const found = await findCharacteristic(deviceId, shortChar);
  if (!found) { debugLogs.value.unshift(`Char ${shortChar} not found`); return; }
  try {
    const read = await BleClient.read(deviceId, found.service, found.characteristic);
    const hex = dataViewToHex(read);
    debugLogs.value.unshift(`${new Date().toLocaleTimeString()} [READ ${found.characteristic.slice(0,8)}] ${hex}`);
  } catch (e) {
    debugLogs.value.unshift(`Read failed: ${e?.message ?? e}`);
  }
}

async function readFe61() {
  if (!ble.connectedDevice.value) return;
  await readCharacteristicByShort(ble.connectedDevice.value.deviceId, 'fe61');
}

async function readFe62() {
  if (!ble.connectedDevice.value) return;
  await readCharacteristicByShort(ble.connectedDevice.value.deviceId, 'fe62');
}

async function dumpServices() {
  if (!ble.connectedDevice.value) return;
  try {
    const services: any[] = await BleClient.getServices(ble.connectedDevice.value.deviceId);
    debugLogs.value.unshift(`--- Services dump (${new Date().toLocaleTimeString()}) ---`);
    for (const s of services) {
      debugLogs.value.unshift(`Service ${s.uuid}`);
      if (s.characteristics) {
        for (const c of s.characteristics) {
          debugLogs.value.unshift(`  Char ${c.uuid} props:${Object.keys(c.properties||{}).filter(k=>c.properties[k]).join(',')}`);
        }
      }
    }
  } catch (e) {
    debugLogs.value.unshift(`Dump failed: ${e?.message ?? e}`);
  }
}

const modelInfo = ref<string | null>(null);
const firmwareInfo = ref<string | null>(null);

function asciiRunsFromBytes(bytes: Uint8Array) {
  // Return the full printable-string reconstructed from bytes (keep spaces and punctuation)
  let s = '';
  for (const b of bytes) {
    if (b >= 32 && b <= 126) s += String.fromCharCode(b); else s += '\0';
  }
  // collapse sequences separated by nulls into array
  return s.split('\0').filter(r => r.length >= 3);
}

function tryExtractInfoFromHex(hexStr: string) {
  const clean = hexStr.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2 !== 0) return {};
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) bytes[i/2] = parseInt(clean.substr(i,2),16);
  // Try to decode with TextDecoder first
  let decoded = '';
  try {
    decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch (e) {
    // fallback: map printable ASCII
    decoded = Array.from(bytes).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '\0').join('');
  }
  // Replace nulls with separator
  const parts = decoded.split(/\x00+/).map(p => p.trim()).filter(p => p.length > 0);
  let model: string | null = null;
  let fw: string | null = null;
  // Search for model pattern (digits-digits...)
  for (const p of parts) {
    if (!model) {
      const m = p.match(/(\d{1,3}(?:-\d{1,3}){1,})/);
      if (m) model = m[0];
    }
    if (!fw) {
      const m2 = p.match(/(\d+(?:\.\d+){1,}[\w\-\._]{2,})/);
      if (m2) fw = m2[0];
    }
  }
  // As a last resort, try to find long ascii runs in raw bytes
  if ((!model || !fw) && parts.length === 0) {
    const runs = asciiRunsFromBytes(bytes);
    for (const r of runs) {
      if (!model) {
        const m = r.match(/(\d{1,3}(?:-\d{1,3}){1,})/);
        if (m) model = m[0];
      }
      if (!fw) {
        const m2 = r.match(/(\d+(?:\.\d+){1,}[\w\-\._]{2,})/);
        if (m2) fw = m2[0];
      }
    }
  }
  return { model, fw, decoded };
}

async function autoFetchModelFirmware() {
  if (!ble.connectedDevice.value) { debugLogs.value.unshift('Not connected'); return; }
  debugLogs.value.unshift('Starting auto fetch of model & firmware...');
  modelInfo.value = null; firmwareInfo.value = null;
  const deviceId = ble.connectedDevice.value.deviceId;

  const fe61 = await findCharacteristic(deviceId, 'fe61');
  const fe62 = await findCharacteristic(deviceId, 'fe62');
  if (!fe61 || !fe62) { debugLogs.value.unshift('FE61 or FE62 not found'); return; }

  const timeoutMs = 7000;

  // buffers keyed by 4-byte identifier (bytes[2..5])
  const buffers: Record<string, number[]> = {};

  const appendToBuffer = (key: string, data: Uint8Array) => {
    if (!buffers[key]) buffers[key] = [];
    for (let i = 0; i < data.length; i++) buffers[key].push(data[i]);
  };

  const notifHandler = (val: any) => {
    const arr = (val instanceof DataView) ? new Uint8Array(val.buffer, val.byteOffset, val.byteLength) : (val && val.value instanceof DataView) ? new Uint8Array(val.value.buffer, val.value.byteOffset, val.value.byteLength) : (val instanceof ArrayBuffer) ? new Uint8Array(val) : (val instanceof Uint8Array) ? val : null;
    if (!arr || arr.length < 6) return;
    const keyBytes = arr.slice(2, 6);
    const keyHex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const payload = arr.slice(6);
    appendToBuffer(keyHex, payload);
    const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(' ');
    debugLogs.value.unshift(`${new Date().toLocaleTimeString()} [AUTO-NOTIF] ${hex}`);
  };

  try {
    await BleClient.startNotifications(deviceId, fe61.service, fe61.characteristic, notifHandler);
  } catch (e) {
    debugLogs.value.unshift(`startNotifications failed: ${e?.message ?? e}`);
  }

  const waitFor = (ms: number) => new Promise(res => setTimeout(res, ms));

  // send model request and collect fragments
  const writeModel = parseHexToUint8Array('110000000005')!;
  const modelKey = Array.from(writeModel.slice(2,6)).map(b=>b.toString(16).padStart(2,'0')).join('');
  buffers[modelKey] = [];
  await writeToCharacteristicByShort(deviceId, 'fe62', writeModel);
  let waited = 0;
  while (buffers[modelKey].length === 0 && waited < timeoutMs) { await waitFor(200); waited += 200; }
  // give a bit more time for remaining fragments
  await waitFor(300);

  // parse model
  if (buffers[modelKey] && buffers[modelKey].length > 0) {
    const bytes = new Uint8Array(buffers[modelKey]);
    const hex = Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join(' ');
    const extracted = tryExtractInfoFromHex(hex);
    if (extracted.model) modelInfo.value = extracted.model; else {
      const runs = asciiRunsFromBytes(bytes); if (runs.length>0) modelInfo.value = runs[0];
    }
  }

  // send firmware request and collect fragments
  const writeFw = parseHexToUint8Array('110000008001')!;
  const fwKey = Array.from(writeFw.slice(2,6)).map(b=>b.toString(16).padStart(2,'0')).join('');
  buffers[fwKey] = [];
  await writeToCharacteristicByShort(deviceId, 'fe62', writeFw);
  waited = 0;
  while (buffers[fwKey].length === 0 && waited < timeoutMs) { await waitFor(200); waited += 200; }
  await waitFor(300);

  if (buffers[fwKey] && buffers[fwKey].length > 0) {
    const bytes = new Uint8Array(buffers[fwKey]);
    const hex = Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join(' ');
    const extracted = tryExtractInfoFromHex(hex);
    if (extracted.fw) firmwareInfo.value = extracted.fw; else {
      const runs = asciiRunsFromBytes(bytes); if (runs.length>0) firmwareInfo.value = runs.join(' ');
    }
  }

  try { await BleClient.stopNotifications(deviceId, fe61.service, fe61.characteristic); } catch {}

  debugLogs.value.unshift('--- Auto fetch result ---');
  debugLogs.value.unshift(`Model ID: ${modelInfo.value ?? 'not found'}`);
  debugLogs.value.unshift(`Firmware: ${firmwareInfo.value ?? 'not found'}`);
}

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
const modbusChecked = ref(true); // State of the modbus mode checkbox
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
const modbusVisible = ref(true);
const generalVisible = ref(false);
const subcategoryVisible = ref<Record<string, boolean>>({});
const framesVisible = ref<Record<string, boolean>>({});
const framesCount = ref<Record<string, number>>({});
const sensorConfigLoaded = ref(false); // Add a new reactive variable to track the loading state
const sensorImage = ref(''); // Reactive variable to store the sensor image path
const isEnforcingRelationships = ref(false);

// Initialize subcategoryVisible to show all subcategories by default
watch(sensorConfig, async (newConfig) => {
  if (newConfig) {
    // Check if the general_params has a folded property
    if (newConfig.general_params && newConfig.general_params.hasOwnProperty('folded')) {
      generalVisible.value = !newConfig.general_params.folded;
    }
    
    // Initialize subcategory visibility
    Object.keys(newConfig).forEach(bigGroupName => {
      if (typeof newConfig[bigGroupName] === 'object') {
        Object.keys(newConfig[bigGroupName]).forEach(groupName => {
          if (typeof newConfig[bigGroupName][groupName] === 'object' && 
              newConfig[bigGroupName][groupName].hasOwnProperty('folded')) {
            subcategoryVisible.value[groupName] = !newConfig[bigGroupName][groupName].folded;
          }
        });
      }
    });
    // Wait for the DOM to update
    await nextTick();
    
    ["batch_params", "modbus_params", "standard_params", "general_params"].forEach(section => {
      if (newConfig[section]) {
        Object.keys(newConfig[section]).forEach(groupName => {
          // Initialize subcategoryVisible based on the folded property
          const group = newConfig[section][groupName];
          subcategoryVisible.value[groupName] = group.folded ? false : true;
          framesVisible.value[groupName] = false;
        });
      }
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

// Function to change the language and persist selection
const STORAGE_KEY = 'easycodec.language';
const changeLanguage = (language) => {
  currentLanguage.value = language;
  try { localStorage.setItem(STORAGE_KEY, language); } catch (e) {}
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
const onSensorChange = async (event) => {
  // Reset all states first
  sensorConfig.value = null;
  paramGroupChecked.value = {};
  subcategoryVisible.value = {};
  framesVisible.value = {};
  framesCount.value = {};
  sensorImage.value = '';
  
  // Wait for the DOM to update
  await nextTick();
  
  const selected = event.detail.value;
  selectedSensor.value = event.detail.value;
  resetCheckboxes();
  await loadSensorConfig(selected);
};

// Reset all checkboxes to their default states
const resetCheckboxes = () => {
  batchChecked.value = false;
  standardChecked.value = false;
  modbusChecked.value = false;
  generalChecked.value = true;

  Object.keys(outputData).forEach(data => {
    outputData[data] = false;
  });
  Object.keys(paramGroupList).forEach(data => {
    paramGroupList[data] = false;
  });
  
  // Reset all group checkboxes
  paramGroupChecked.value = {};

  // Reset visibility states
  subcategoryVisible.value = {};
  framesVisible.value = {};
  framesCount.value = {};
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
      } else if (bigGroupName === "modbus_params") {
        modbusChecked.value = true;
        onModbusCheckedChange({ detail: { checked: true } });
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

  // Iterate over big groups
  ["batch_params", "modbus_params", "standard_params", "general_params"].forEach((bigGroupName) => {
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

    // Extract image path from config if available
    sensorImage.value = findSensorImage(sensorConfig.value);

    // Initialize default states first
    ["batch_params", "modbus_params", "standard_params", "general_params"].forEach((section) => {
      if (rawConfig[section]) {
        Object.keys(rawConfig[section]).forEach((groupName) => {
          const group = rawConfig[section][groupName];
          if (group.default_state === "true") {
            paramGroupChecked.value[groupName] = true;
            if (section === "general_params") generalChecked.value = true;
            if (section === "batch_params") batchChecked.value = true;
            if (section === "standard_params") standardChecked.value = true;
            if (section === "modbus_params") modbusChecked.value = true;
          }
        });
      }
    });

    // Initialize states for checkboxes and fields
    initializeStates(sensorConfig.value);

    initParams(); // Initialize other parameters
    sensorConfigLoaded.value = true; // Set loading state to true after loading
  } catch (error) {
    console.error('Failed to load sensor config:', error);
  }
};

// Function to find sensor image in the configuration
const findSensorImage = (config) => {
  if (!config) return '';
  
  // Check in all sections for an image property
  for (const sectionKey of ['general_params', 'batch_params', 'standard_params', 'modbus_params']) {
    const section = config[sectionKey];
    if (!section) continue;
    
    if (section.image) {
        return section.image;
      }

    // Check each group in the section
    for (const groupKey in section) {
      if (section[groupKey].image) {
        return section[groupKey].image;
      }
    }
  }
  
  return '';
};

// Initialize default values for sensor parameters
const initParams = () => {
  if (sensorConfig.value) {
    for (const bigGroupName of ['general_params', "standard_params", 'batch_params', 'standard_params']) {
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
  if (!batchChecked.value && !standardChecked.value && !modbusChecked.value && !(sensorConfig.value?.general_params?.outputCardOverride)) {
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
        (bigGroupName === 'modbus_params' && !modbusChecked.value) ||
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

      // Special handling for Modbus frames in the main output
      if (frame.includes('8007 0000 41 06')) {
        const frameNumber = frame.split(' ')[0];
        const groupName = `modbusFrame${frameNumber}`;
        const paramGroup = sensorConfig.value[bigGroupName][groupName];
        
        if (paramGroup && paramGroupChecked.value[groupName]) {
          const fields = {
            slave: paramGroup.fields[`mb${frameNumber}Slave`],
            functionCode: paramGroup.fields[`mb${frameNumber}FunctionCode`],
            startAddress: paramGroup.fields[`mb${frameNumber}StartAddress`],
            numRegisters: paramGroup.fields[`mb${frameNumber}NumRegisters`],
            dataToWrite: paramGroup.fields[`mb${frameNumber}DataToWrite`]
          };
          
          frame = generateModbusFrame(frame, fields, paramGroup.fields[`mb${frameNumber}Slave`]?.enabled);
        } else {
          frame = ''; // Skip this frame if group is not checked
        }
      } else {
        // Existing frame parameter replacement logic
        Object.keys(outputVals).forEach((valKey) => {
          const enabled = paramGroupList[valKey]?.enabled;
          if (outputVals[valKey]?.toString().includes(" ")) {
            frame = replaceInFrame(frame, `${valKey}1`, outputVals[valKey].toString().split(" ")[0], enabled);
            frame = replaceInFrame(frame, `${valKey}2`, outputVals[valKey].toString().split(" ")[1], enabled);
          } else {
            frame = replaceInFrame(frame, valKey, outputVals[valKey], enabled);
          }
        });
      }
      
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
  HMI: any; type: string; isHours: boolean; inverted: string;
}) => {
  if (param.type === 'frame') return "";

  if (!value || !param) return;
  let output = '';

  if (param.type === 'string') return value;
  if (param.type.startsWith('stringPad')) {
    const padLength = parseInt(param.type.replace('stringPad', ''), 10);
    return value.padStart(padLength, '0');
  }

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
    if (param.type == "timeVal") {
      if (param.isHours) {
        value = (parseInt(value) * 60).toString();
      }
      output = (parseInt(value) + 32768).toString(16).padStart(4, '0');
    } else if (param.type.startsWith("hex")) {
      const bytes = parseInt(param.type.replace("hex", ""), 10);
      output = parseInt(value).toString(16).padStart(bytes * 2, '0');
    } else if (param.type == "bool") {
      if (param.inverted === 'true') {
        // Inverted logic: true becomes 00, false becomes 01
        output = (value == "true") ? "00" : "01";
      } else {
        // Normal logic: true becomes 01, false becomes 00
        output = (value == "true") ? "01" : "00";
      }
    } else if (param.type == "float") {
      // Convert float to IEEE 754 single-precision format
      const float32Array = new Float32Array(1);
      float32Array[0] = parseFloat(value);
      const uint32Array = new Uint32Array(float32Array.buffer);
      output = uint32Array[0].toString(16).padStart(8, '0');
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

// Update ModBus mode state
const onModbusCheckedChange = (event: CustomEvent) => {
  modbusChecked.value = event.detail.checked;
  onCategoryCheckedChange(event, "modbus_params");
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

      // Check and enforce all field relationships
      enforceFieldRelationships(bigGroupName, groupName);
      
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

const enforceFieldRelationships = (bigGroupName, groupName) => {
  if (isEnforcingRelationships.value) return;
  
  isEnforcingRelationships.value = true;
  
  try {
    const group = sensorConfig.value[bigGroupName][groupName];
    let allRelationships = [...(group.field_relationships || [])];
    
    if (bigGroupName === 'general_params' && groupName === 'alto_config' && group.field_relationships) {
      allRelationships = [...allRelationships, ...(group.field_relationships || [])];
    }
    
    allRelationships.forEach(relationship => {
      const fields = sensorConfig.value[bigGroupName][groupName].fields;
      
      if (relationship.type === 'lessThan' || relationship.type === 'greaterThan') {
        const lessField = relationship.type === 'lessThan' ? fields[relationship.field1] : fields[relationship.field2];
        const greaterField = relationship.type === 'lessThan' ? fields[relationship.field2] : fields[relationship.field1];
        const lessFieldName = relationship.type === 'lessThan' ? relationship.field1 : relationship.field2;
        const greaterFieldName = relationship.type === 'lessThan' ? relationship.field2 : relationship.field1;
        
        if (lessField && greaterField) {
          const lessValue = parseFloat(lessField.selectedValue);
          const greaterValue = parseFloat(greaterField.selectedValue);
          const margin = parseFloat(relationship.margin || 0.01);
          
          if (greaterValue <= lessValue) {
            const newGreaterValue = Math.min(
              parseFloat((lessValue + margin).toFixed(greaterField.precision || 2)),
              parseFloat(greaterField.max_value)
            );
            
            if (parseFloat(greaterField.selectedValue) !== newGreaterValue) {
              greaterField.selectedValue = newGreaterValue.toString();
              outputVals[greaterFieldName] = convertToHexFrameValue(newGreaterValue.toString(), greaterField);
            }
          }
          
          const newMaxValue = parseFloat((parseFloat(greaterField.selectedValue) - margin).toFixed(lessField.precision || 2));
          if (parseFloat(lessField.max_value) !== newMaxValue) {
            lessField.max_value = newMaxValue.toString();
          }
          
          const newMinValue = parseFloat(lessField.selectedValue);
          if (parseFloat(greaterField.min_value) !== newMinValue) {
            greaterField.min_value = newMinValue.toString();
          }
        }
      }
    });
  } finally {
    isEnforcingRelationships.value = false;
  }
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
    // Prefer stored user selection, else fallback to browser detection
    const STORAGE_KEY = 'easycodec.language';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && (languages.value as any)[stored]) {
        currentLanguage.value = stored;
      } else {
        const browserLanguage = navigator.language.split('-')[0]; // Get the browser language
        currentLanguage.value = languages.value[browserLanguage] ? browserLanguage : 'en';
      }
    } catch (e) {
      const browserLanguage = navigator.language.split('-')[0];
      currentLanguage.value = languages.value[browserLanguage] ? browserLanguage : 'en';
    }
    const selectToStartText = localize("@selectToStart");
    document.getElementById("outputArea").innerHTML = selectToStartText;
  });
  // Initialize BLE on native platforms (no-op on web)
  ble.initialize();
});

// Auto start/stop debug subscriptions when connection state changes
watch(() => ble.connected.value, (connectedNow) => {
  if (connectedNow) startDebugSubscriptions(); else stopDebugSubscriptions();
});

// Remove the event listener when the component is unmounted
onUnmounted(() => {
  document.removeEventListener('click', handleCopyButtonClick);
  try { stopDebugSubscriptions(); } catch (e) {}
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
      navigator.clipboard.writeText(text).catch(err => {
        console.error('Failed to copy frames:', err);
      });
    }
  }
};

// Send frames via BLE (native only)
const sendFramesBle = () => {
  ble.sendOutputFrames();
};

// Disconnect BLE and navigate back to connection page
const router = useRouter();
const disconnectAndGoBack = async () => {
  await ble.disconnect();
  router.replace('/ble-connect');
};

const toggleVisibility = (category: string) => {
  if (category === 'general_params') {
    generalVisible.value = !generalVisible.value;
  } else if (category === 'batch_params') {
    batchVisible.value = !batchVisible.value;
  } else if (category === 'modbus_params') {
    modbusVisible.value = !modbusVisible.value;
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

const generateModbusFrame = (frame: string, fields: any, enabled: boolean) => {
  const functionCode = fields[`functionCode`]?.selectedValue;
  const slave = fields[`slave`]?.selectedValue || '1';
  const startAddress = fields[`startAddress`]?.selectedValue || '0';
  const registers = fields[`numRegisters`]?.selectedValue || '1';
  const dataToWrite = fields[`dataToWrite`]?.selectedValue || '';

  const framePrefix = frame.split(' ').slice(0, 6).join(' ');
  
  let frameContent = `${parseInt(slave).toString(16).padStart(2, '0')} ${parseInt(functionCode).toString(16).padStart(2, '0')} ${parseInt(startAddress).toString(16).padStart(4, '0')}`;
  
  if (['1', '2', '3', '4'].includes(functionCode)) {
    frameContent += ` ${parseInt(registers).toString(16).padStart(4, '0')}`;
  } else if (['5', '6'].includes(functionCode)) {
    if (dataToWrite) {
      frameContent += ` ${dataToWrite.padStart(4, '0')}`;
    }
  } else if (['15', '16'].includes(functionCode)) {
    frameContent += ` ${parseInt(registers).toString(16).padStart(4, '0')}`;
    if (dataToWrite) {
      frameContent += ` ${dataToWrite.padStart(4, '0')}`;
    }
  }
  
  const finalFrame = `${framePrefix} ${frameContent}`;
  return finalFrame;
};

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

      // Special handling for Modbus frames
      if (frame.includes('8007 0000 41 06')) {
        const frameNumber = frame.split(' ')[0];
        // Only process this frame if we're in the correct modbus frame group
        if (groupName === `modbusFrame${frameNumber}`) {
          const fields = {
            slave: paramGroup.fields[`mb${frameNumber}Slave`],
            functionCode: paramGroup.fields[`mb${frameNumber}FunctionCode`],
            startAddress: paramGroup.fields[`mb${frameNumber}StartAddress`],
            numRegisters: paramGroup.fields[`mb${frameNumber}NumRegisters`],
            dataToWrite: paramGroup.fields[`mb${frameNumber}DataToWrite`]
          };
          
          const modbusFrame = generateModbusFrame(frame, fields, paramGroup.fields[`mb${frameNumber}Slave`]?.enabled);
          if (modbusFrame) {
            const frameId = `frame-${bigGroupName}-${groupName}-${index}`;
            frames += `<span class="frameArea" id="${frameId}"><span class="frame">${modbusFrame}</span>&nbsp;&nbsp;&nbsp;&nbsp;(${frameDesc}) <button class="copy-button" data-frame-id="${frameId}" data-no-spaces="true">${localize('@copyFrame')}</button></span><br>`;
            frameCount++;
          }
        }
        return;
      }
      
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
    navigator.clipboard.writeText(frameText).catch(err => {
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

// Provide localize function to child components
provide('localize', localize);
</script>

<style scoped>
.card-holder {
  display: block;
  width: 100%;
}

.sensor-select, .output-area {
  display: flex;
  justify-content: space-between;
  margin: 10px 100px;
  flex-direction: column;
}

.sensor-select {
  align-items: center;
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

.category-card, .sensor-card, .outputCard, #sensor-card {
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
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 10px;
  width: 100%;
  padding: 10px;
}

.subcategory-card {
  width: 100% !important;
  margin: 0 !important;
  height: fit-content;
}

.subcategory-card.full-width {
  grid-column: 1 / -1;
}

.global-batch-settings {
  grid-column: 1 / -1 !important;
  width: 100% !important;
  margin: 10px 0 !important;
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

  .category-card, .sensor-card, .outputCard, #sensor-card {
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

  .output-area {
    margin: 0;
  }

  #outputArea {
    font-size: xx-small;
  }

  .language-switcher {
    bottom: 8px;
    right: 8px;
  }

  .subcategory-card-holder {
    grid-template-columns: 1fr;
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

/* BLE panel styles (only rendered on native) */
.ble-panel {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--ion-color-light-shade);
}

.ble-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.ble-status-msg {
  margin-top: 6px;
  font-size: 0.85em;
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
