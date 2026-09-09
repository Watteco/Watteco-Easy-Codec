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
                  :disabled="isMandatoryGroup('general_params', groupName)"
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
                      v-if="param.HMI?.visual_type === 'timeSlider' || param.HMI?.visual_type === 'timeSliderHHMM'"
                      :label="param.HMI?.label"
                      :min="param.min_value"
                      :max="param.max_value"
                      :value="param.selectedValue"
                      :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                      :groupName="groupName"
                      :paramName="paramName"
                      :outputFormat="param.HMI?.outputFormat"
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
                      :unit="param.HMI?.unit"
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

                    <!-- Using the Slider component (integer) -->
                    <slider-input
                      v-if="param.HMI?.visual_type === 'slider' && param.type !== 'float'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="parseInt(param.min_value)"
                      :max="parseInt(param.max_value)"
                      :step="param.step ? parseInt(param.step) : 1"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'general_params', groupName, paramName)"
                    />

                    <!-- Using the FloatInput component via slider visual_type -->
                    <float-input
                      v-if="param.HMI?.visual_type === 'slider' && param.type === 'float'"
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
            <ion-checkbox :checked="modbusChecked || hasMandatoryGroup('modbus_params')" :disabled="hasMandatoryGroup('modbus_params')" @ionChange="onModbusCheckedChange"></ion-checkbox>
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
                  :disabled="isMandatoryGroup('modbus_params', groupName)"
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
                      v-if="param.HMI?.visual_type === 'timeSlider' || param.HMI?.visual_type === 'timeSliderHHMM'"
                      :label="param.HMI?.label"
                      :min="param.min_value"
                      :max="param.max_value"
                      :value="param.selectedValue"
                      :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                      :groupName="groupName"
                      :paramName="paramName"
                      :outputFormat="param.HMI?.outputFormat"
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
                      :unit="param.HMI?.unit"
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

                    <!-- Using the Slider component (integer) -->
                    <slider-input
                      v-if="param.HMI?.visual_type === 'slider' && param.type !== 'float'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="parseInt(param.min_value)"
                      :max="parseInt(param.max_value)"
                      :step="param.step ? parseInt(param.step) : 1"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'modbus_params', groupName, paramName)"
                    />

                    <!-- Using the FloatInput component via slider visual_type -->
                    <float-input
                      v-if="param.HMI?.visual_type === 'slider' && param.type === 'float'"
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
            <ion-checkbox :checked="batchChecked || hasMandatoryGroup('batch_params')" :disabled="hasMandatoryGroup('batch_params')" @ionChange="onBatchCheckedChange"></ion-checkbox>
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
                  :disabled="isMandatoryGroup('batch_params', groupName)"
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
                      v-if="param.HMI?.visual_type === 'timeSlider' || param.HMI?.visual_type === 'timeSliderHHMM'"
                      :label="param.HMI?.label"
                      :min="param.min_value"
                      :max="param.max_value"
                      :value="param.selectedValue"
                      :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                      :groupName="groupName"
                      :paramName="paramName"
                      :outputFormat="param.HMI?.outputFormat"
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
                      :unit="param.HMI?.unit"
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

                    <!-- Using the Slider component (integer) -->
                    <slider-input
                      v-if="param.HMI?.visual_type === 'slider' && param.type !== 'float'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="parseInt(param.min_value)"
                      :max="parseInt(param.max_value)"
                      :step="param.step ? parseInt(param.step) : 1"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'batch_params', groupName, paramName)"
                    />

                    <!-- Using the FloatInput component via slider visual_type -->
                    <float-input
                      v-if="param.HMI?.visual_type === 'slider' && param.type === 'float'"
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
            <template v-if="sensorConfig.batch_params.global_params && batchChecked">
              <ion-card class="global-batch-settings" v-for="(param, paramName) in sensorConfig.batch_params.global_params.fields" 
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
            </template>
          </div>
          
        </ion-card>

        <!-- Standard (standard_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.standard_params" class="category-card" :key="`standard-${currentLanguage}-${selectedSensor}`">
          <ion-item class="config-item">
            <ion-label>{{ localize("@standLabel") }}</ion-label>
            <ion-checkbox :checked="standardChecked || hasMandatoryGroup('standard_params')" :disabled="hasMandatoryGroup('standard_params')" @ionChange="onStandardCheckedChange"></ion-checkbox>
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
                  :disabled="isMandatoryGroup('standard_params', groupName)"
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
                      v-if="param.HMI?.visual_type === 'timeSlider' || param.HMI?.visual_type === 'timeSliderHHMM'"
                      :label="param.HMI?.label"
                      :min="param.min_value"
                      :max="param.max_value"
                      :value="param.selectedValue"
                      :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                      :groupName="groupName"
                      :paramName="paramName"
                      :outputFormat="param.HMI?.outputFormat"
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
                      :unit="param.HMI?.unit"
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

                    <!-- Using the Slider component (integer) -->
                    <slider-input
                      v-if="param.HMI?.visual_type === 'slider' && param.type !== 'float'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="parseInt(param.min_value)"
                      :max="parseInt(param.max_value)"
                      :step="param.step ? parseInt(param.step) : 1"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'standard_params', groupName, paramName)"
                    />

                    <!-- Using the FloatInput component via slider visual_type -->
                    <float-input
                      v-if="param.HMI?.visual_type === 'slider' && param.type === 'float'"
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
        <!-- Configuration (configuration_params) -->
        <ion-card v-if="sensorConfig?.configuration_params" class="category-card" :key="`configuration-${currentLanguage}-${selectedSensor}`">
          <ion-item class="config-item">
            <ion-label>{{ localize("@configurationLabel") }}</ion-label>
            <ion-checkbox :checked="configurationChecked || hasMandatoryGroup('configuration_params')" :disabled="hasMandatoryGroup('configuration_params')" @ionChange="onConfigurationCheckedChange"></ion-checkbox>
            <ion-button class="visibility-button" :class="{ invisible: !configurationChecked }" @click="toggleVisibility('configuration_params')">{{ configurationVisible ? '–' : '+' }}</ion-button>
          </ion-item>

          <div class="subcategory-card-holder" v-show="configurationVisible">
            <ion-card v-for="(paramGroup, groupName) in sensorConfig.configuration_params" 
                      :key="groupName" 
                      v-show="configurationChecked && paramGroup.label" 
                      :class="['subcategory-card', { 'full-width': hasIonRange(paramGroup.fields) }]">
              <ion-item class="config-item">
                <ion-label>{{ paramGroup.label }}</ion-label>

                <ion-checkbox 
                  :checked="paramGroupChecked[groupName] || false"
                  :disabled="isMandatoryGroup('configuration_params', groupName)"
                  @ionChange="onParamGroupCheckedChange($event, groupName, 'configuration_params')"
                ></ion-checkbox>
                <ion-button class="visibility-button" :class="{ invisible: !paramGroupChecked[groupName] }" @click="toggleSubcategoryVisibility(groupName)">{{ subcategoryVisible[groupName] ? '–' : '+' }}</ion-button>
              </ion-item>

              <ul v-show="subcategoryVisible[groupName] && paramGroupChecked[groupName] && !onlyCustomFrame(paramGroup.fields)">
                <ion-card v-for="(param, paramName) in paramGroup.fields" 
                          :key="paramName" 
                          v-show="param.hidden !== 'true' && param.HMI?.visual_type !== 'customFrame'"
                          class="config-card">
                  <ion-item class="config-item">
                    <time-slider
                      v-if="param.HMI?.visual_type === 'timeSlider' || param.HMI?.visual_type === 'timeSliderHHMM'"
                      :label="param.HMI?.label"
                      :min="param.min_value"
                      :max="param.max_value"
                      :value="param.selectedValue"
                      :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                      :groupName="groupName"
                      :paramName="paramName"
                      :outputFormat="param.HMI?.outputFormat"
                      @update:value="onParamChange($event, 'configuration_params', groupName, paramName)"
                      @update:units="onToggleChange($event, 'configuration_params', groupName, paramName)"
                    />

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
                      @update:value="onParamChange($event, 'configuration_params', groupName, paramName)"
                    />

                    <check-box
                      v-if="param.HMI?.visual_type === 'checkbox'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :groupName="groupName"
                      :paramName="paramName"
                      :inverted="param.inverted === 'true'"
                      @update:value="onParamChange($event, 'configuration_params', groupName, paramName)"
                    />

                    <custom-value
                      v-if="param.HMI?.visual_type === 'customValue'"
                      :label="localize(`${param.HMI?.label} @customFixed `) + param.valueText"
                      :value="param.value"
                      :groupName="groupName"
                      :paramName="paramName"
                    />

                    <drop-down
                      v-if="param.HMI?.visual_type === 'dropdown'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :choices="param.choices"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'configuration_params', groupName, paramName)"
                    />

                    <num-input
                      v-if="param.HMI?.visual_type === 'numInput' && param.type !== 'float'"
                      :label="param.HMI?.label"
                      :unit="param.HMI?.unit"
                      :value="param.selectedValue"
                      :min="param.min_value"
                      :max="param.max_value"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'configuration_params', groupName, paramName)"
                    />

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
                      @update:value="onParamChange($event, 'configuration_params', groupName, paramName)"
                    />

                    <slider-input
                      v-if="param.HMI?.visual_type === 'slider' && param.type !== 'float'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="parseInt(param.min_value)"
                      :max="parseInt(param.max_value)"
                      :step="param.step ? parseInt(param.step) : 1"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'configuration_params', groupName, paramName)"
                    />

                    <float-input
                      v-if="param.HMI?.visual_type === 'slider' && param.type === 'float'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="parseFloat(param.min_value)"
                      :max="parseFloat(param.max_value)"
                      :step="param.step ? parseFloat(param.step) : 0.01"
                      :precision="param.precision ? parseInt(param.precision) : 2"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'configuration_params', groupName, paramName)"
                    />

                    <text-input
                      v-if="param.HMI?.visual_type === 'textInput'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :placeholder="param.placeholder"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'configuration_params', groupName, paramName)"
                    />

                  </ion-item>
                </ion-card>
              </ul>
              <ion-card-content v-if="subcategoryVisible[groupName] && paramGroupChecked[groupName]" class="showFrameButton">                
                <ion-button @click="toggleFramesVisibility(groupName)" class="small-button">
                  {{ framesVisible[groupName] ? localize(framesCount[groupName] > 1 ? "@hideFrames" : "@hideFrame") : localize(framesCount[groupName] > 1 ? "@showFrames" : "@showFrame") }}
                </ion-button>
                <div v-show="framesVisible[groupName]" v-html="generateFramesForGroup('configuration_params', groupName)"></div>
              </ion-card-content>
            </ion-card>
          </div>
        </ion-card>

        <!-- Commande (commande_params) -->
        <ion-card v-if="sensorConfig?.commande_params" class="category-card" :key="`commande-${currentLanguage}-${selectedSensor}`">
          <ion-item class="config-item">
            <ion-label>{{ localize("@commandeLabel") }}</ion-label>
            <ion-checkbox :checked="commandeChecked || hasMandatoryGroup('commande_params')" :disabled="hasMandatoryGroup('commande_params')" @ionChange="onCommandeCheckedChange"></ion-checkbox>
            <ion-button class="visibility-button" :class="{ invisible: !commandeChecked }" @click="toggleVisibility('commande_params')">{{ commandeVisible ? '–' : '+' }}</ion-button>
          </ion-item>

          <div class="subcategory-card-holder commande-grid" v-show="commandeVisible">
            <ion-card v-for="(paramGroup, groupName) in sensorConfig.commande_params" 
                      :key="groupName" 
                      v-show="commandeChecked && paramGroup.label" 
                      class="subcategory-card commande-card">
              <ion-item class="config-item">
                <ion-label>{{ paramGroup.label }}</ion-label>

                <ion-checkbox 
                  :checked="paramGroupChecked[groupName] || false"
                  :disabled="isMandatoryGroup('commande_params', groupName)"
                  @ionChange="onParamGroupCheckedChange($event, groupName, 'commande_params')"
                ></ion-checkbox>
                <ion-button class="visibility-button" :class="{ invisible: !paramGroupChecked[groupName] }" @click="toggleSubcategoryVisibility(groupName)">{{ subcategoryVisible[groupName] ? '–' : '+' }}</ion-button>
              </ion-item>

              <ul v-show="subcategoryVisible[groupName] && paramGroupChecked[groupName] && !onlyCustomFrame(paramGroup.fields)">
                <ion-card v-for="(param, paramName) in paramGroup.fields" 
                          :key="paramName" 
                          v-show="param.hidden !== 'true' && param.HMI?.visual_type !== 'customFrame'"
                          class="config-card">
                  <ion-item class="config-item">
                    <time-slider
                      v-if="param.HMI?.visual_type === 'timeSlider' || param.HMI?.visual_type === 'timeSliderHHMM'"
                      :label="param.HMI?.label"
                      :min="param.min_value"
                      :max="param.max_value"
                      :value="param.selectedValue"
                      :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                      :groupName="groupName"
                      :paramName="paramName"
                      :outputFormat="param.HMI?.outputFormat"
                      @update:value="onParamChange($event, 'commande_params', groupName, paramName)"
                      @update:units="onToggleChange($event, 'commande_params', groupName, paramName)"
                    />

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
                      @update:value="onParamChange($event, 'commande_params', groupName, paramName)"
                    />

                    <check-box
                      v-if="param.HMI?.visual_type === 'checkbox'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :groupName="groupName"
                      :paramName="paramName"
                      :inverted="param.inverted === 'true'"
                      @update:value="onParamChange($event, 'commande_params', groupName, paramName)"
                    />

                    <custom-value
                      v-if="param.HMI?.visual_type === 'customValue'"
                      :label="localize(`${param.HMI?.label} @customFixed `) + param.valueText"
                      :value="param.value"
                      :groupName="groupName"
                      :paramName="paramName"
                    />

                    <drop-down
                      v-if="param.HMI?.visual_type === 'dropdown'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :choices="param.choices"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'commande_params', groupName, paramName)"
                    />

                    <num-input
                      v-if="param.HMI?.visual_type === 'numInput' && param.type !== 'float'"
                      :label="param.HMI?.label"
                      :unit="param.HMI?.unit"
                      :value="param.selectedValue"
                      :min="param.min_value"
                      :max="param.max_value"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'commande_params', groupName, paramName)"
                    />

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
                      @update:value="onParamChange($event, 'commande_params', groupName, paramName)"
                    />

                    <slider-input
                      v-if="param.HMI?.visual_type === 'slider' && param.type !== 'float'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="parseInt(param.min_value)"
                      :max="parseInt(param.max_value)"
                      :step="param.step ? parseInt(param.step) : 1"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'commande_params', groupName, paramName)"
                    />

                    <float-input
                      v-if="param.HMI?.visual_type === 'slider' && param.type === 'float'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="parseFloat(param.min_value)"
                      :max="parseFloat(param.max_value)"
                      :step="param.step ? parseFloat(param.step) : 0.01"
                      :precision="param.precision ? parseInt(param.precision) : 2"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'commande_params', groupName, paramName)"
                    />

                    <text-input
                      v-if="param.HMI?.visual_type === 'textInput'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :placeholder="param.placeholder"
                      :groupName="groupName"
                      :paramName="paramName"
                      :localize="localize"
                      @update:value="onParamChange($event, 'commande_params', groupName, paramName)"
                    />

                  </ion-item>
                </ion-card>
              </ul>
              <ion-card-content v-if="subcategoryVisible[groupName] && paramGroupChecked[groupName]" class="showFrameButton">                
                <ion-button @click="toggleFramesVisibility(groupName)" class="small-button">
                  {{ framesVisible[groupName] ? localize(framesCount[groupName] > 1 ? "@hideFrames" : "@hideFrame") : localize(framesCount[groupName] > 1 ? "@showFrames" : "@showFrame") }}
                </ion-button>
                <div v-show="framesVisible[groupName]" v-html="generateFramesForGroup('commande_params', groupName)"></div>
              </ion-card-content>
            </ion-card>
          </div>
        </ion-card>
      </div>

      <ion-card class="outputCard" v-show="sensorConfigLoaded && !(sensorConfig?.general_params?.outputCardHidden)">
        <ion-card-content class="output-area">
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
  IonButton
} from '@ionic/vue';
import TimeSlider from '@/components/TimeSlider.vue';
import DoubleSlider from '@/components/DoubleSlider.vue';
import CheckBox from '@/components/CheckBox.vue';
import CustomValue from '@/components/CustomValue.vue';
import CustomFrame from '@/components/CustomFrame.vue';
import DropDown from '@/components/DropDown.vue';
import NumInput from '@/components/NumInput.vue';
import FloatInput from '@/components/FloatInput.vue';
import SliderInput from '@/components/Slider.vue';
import TextInput from '@/components/TextInput.vue';
import SensorImage from '@/components/SensorImage.vue';
import axios from 'axios';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import { isLanguageCode } from '@/types/localization';
import type { LanguageCode, Translations } from '@/types/localization';

// Import language files
import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

interface Product {
  category: string;
  file: string;
  name: string;
  apps?: string[];
}

interface AvailableProductList {
  products: Product[];
}

interface GroupRelationship {
  type: string;
  allow_none?: boolean;
  default_group?: string | number;
  groups: Array<string | number>;
}

interface SensorChangeEvent {
  detail: {
    value: string;
  };
}

interface CheckedChangeEvent {
  detail: {
    checked: boolean;
  };
}

interface ParamChangeEvent {
  newValue?: string | number | boolean;
  detail?: {
    value: {
      lower: string | number;
      upper: string | number;
    };
  };
}

interface ImageSection {
  image?: string;
  [groupName: string]: unknown;
}

type SensorImageConfig = Record<string, ImageSection | undefined>;
type ConfigBlockEntry = string | [frame: string, tooltip: string];

interface SensorParameter {
  HMI: Record<string, any>;
  type: string;
  isHours: boolean;
  inverted: string;
  default_value?: string;
  selectedValue?: string;
  max_value?: string | number;
  originalMaxValue?: string | number;
  [property: string]: unknown;
}

interface SensorParameterGroup {
  default_state?: string;
  mandatory?: boolean | string;
  fields?: Record<string, SensorParameter>;
  [property: string]: unknown;
}

type SensorStateConfig = Record<
  string,
  Record<string, SensorParameterGroup> | undefined
>;

const currentLanguage = ref<LanguageCode>('en');

const languages = ref<Record<LanguageCode, Translations>>({
  en: {},
  fr: {},
});

// Reactive variables to store application state
const availableProducts = ref<Product[]>([]); // Stores the list of available products
const categorizedProducts = computed<Record<string, Product[]>>(() => {
  const categories: Record<string, Product[]> = {};
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
const configurationChecked = ref(true); // State of the configuration mode checkbox
const commandeChecked = ref(true); // State of the commande mode checkbox
const generalChecked = ref(true); // State of the general mode checkbox
const paramGroupChecked = ref<Record<string, boolean>>({}); // Tracks the state of group checkboxes
const outputData: Record<string, boolean> = {}; // Output data for rendering
const outputVals: Record<string, string> = {}; // Output values derived from parameters
const paramGroupList: Record<string, any> = {}; // List of parameter groups
const currentErrors: never[] = []; // Tracks current errors
const framesAvailable = ref(false);
const batchVisible = ref(true);
const standardVisible = ref(true);
const modbusVisible = ref(true);
const configurationVisible = ref(true);
const commandeVisible = ref(true);
const generalVisible = ref(false);
const subcategoryVisible = ref<Record<string, boolean>>({});
const framesVisible = ref<Record<string, boolean>>({});
const framesCount = ref<Record<string, number>>({});
const sensorConfigLoaded = ref(false); // Add a new reactive variable to track the loading state
const sensorImage = ref(''); // Reactive variable to store the sensor image path
const isEnforcingRelationships = ref(false);

const isTrueFlag = (value: unknown) => value === true || value === "true";

const isMandatoryGroup = (bigGroupName: string, groupName: string | number) => {
  return isTrueFlag(sensorConfig.value?.[bigGroupName]?.[groupName]?.mandatory);
};

const hasMandatoryGroup = (bigGroupName: string) => {
  const section = sensorConfig.value?.[bigGroupName];
  if (!section) return false;

  return Object.keys(section).some(groupName => {
    if (groupName === "global_params" || groupName === "cfg_block") return false;
    return isTrueFlag(section[groupName]?.mandatory);
  });
};

const setGroupEnabled = (bigGroupName: string, groupName: string | number, checked: boolean) => {
  const group = sensorConfig.value?.[bigGroupName]?.[groupName];
  if (!group?.fields) return;

  paramGroupChecked.value[groupName] = checked;
  Object.keys(group.fields).forEach(field => {
    group.fields[field].enabled = checked;
    paramGroupList[field] = group.fields[field];
  });
  outputData[groupName] = checked;
};

const getGroupRelationships = (
  bigGroupName: string,
): GroupRelationship[] => {
  const relationships =
    sensorConfig.value?.[bigGroupName]?.group_relationships;

  return Array.isArray(relationships) ? relationships : [];
};

const enforceExclusiveGroupRelationships = (
  bigGroupName: string,
  selectedGroupName: string | number,
  checked: boolean,
) => {
  if (!checked) return;

  getGroupRelationships(bigGroupName).forEach(relationship => {
    if (
      relationship.type !== "exclusive" ||
      !Array.isArray(relationship.groups) ||
      !relationship.groups.includes(selectedGroupName)
    ) {
      return;
    }

    relationship.groups.forEach(groupName => {
      if (groupName !== selectedGroupName) {
        setGroupEnabled(bigGroupName, groupName, false);
      }
    });
  });
};

const canDisableExclusiveGroup = (bigGroupName: string, groupName: string | number) => {
  return !getGroupRelationships(bigGroupName).some(relationship =>
    relationship.type === "exclusive" &&
    relationship.allow_none === false &&
    Array.isArray(relationship.groups) &&
    relationship.groups.includes(groupName) &&
    relationship.groups.every(relatedGroupName =>
      relatedGroupName === groupName || !paramGroupChecked.value[relatedGroupName]
    )
  );
};

const initializeExclusiveGroups = (bigGroupName: string) => {
  getGroupRelationships(bigGroupName).forEach(relationship => {
    if (relationship.type !== "exclusive" || !Array.isArray(relationship.groups)) return;

    const selectedGroup = relationship.allow_none === false
      ? relationship.default_group || relationship.groups[0]
      : undefined;

    relationship.groups.forEach(groupName => {
      setGroupEnabled(bigGroupName, groupName, groupName === selectedGroup);
    });
  });
};

// Initialize subcategoryVisible to show all subcategories by default
watch(sensorConfig, async (newConfig) => {
  if (newConfig) {
    // Check if general_params has its own folded property
    if (
      newConfig.general_params &&
      Object.prototype.hasOwnProperty.call(newConfig.general_params, 'folded')
    ) {
      generalVisible.value = !newConfig.general_params.folded;
    }
    
    // Initialize subcategory visibility
    Object.keys(newConfig).forEach(bigGroupName => {
      if (typeof newConfig[bigGroupName] === 'object') {
        Object.keys(newConfig[bigGroupName]).forEach(groupName => {
          const group = newConfig[bigGroupName][groupName];

          if (
            typeof group === 'object' &&
            Object.prototype.hasOwnProperty.call(group, 'folded')
          ) {
            subcategoryVisible.value[groupName] = !group.folded;
          }
        });
      }
    });
    // Wait for the DOM to update
    await nextTick();
    
    ["batch_params", "modbus_params", "standard_params", "configuration_params", "commande_params", "general_params"].forEach(section => {
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

// Function to generate a cache-busting query parameter
const generateCacheBuster = () => {
  return `?v=${new Date().getTime()}`;
};

// Load localization files dynamically
const loadLocalizationFiles = async () => {
  try {
    const enResponse = await axios.get<Translations>(enUS + generateCacheBuster());
    const frResponse = await axios.get<Translations>(frFR + generateCacheBuster());
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
const changeLanguage = (language: LanguageCode) => {
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
    const response = await axios.get<AvailableProductList>(
      `${import.meta.env.BASE_URL}config/AvailableProductList.json` + generateCacheBuster()
    );
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
const onSensorChange = async (event: SensorChangeEvent) => {
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
  selectedSensor.value = selected;
  resetCheckboxes();
  await loadSensorConfig(selected);
};

// Reset all checkboxes to their default states
const resetCheckboxes = () => {
  batchChecked.value = false;
  standardChecked.value = false;
  modbusChecked.value = false;
  configurationChecked.value = false;
  commandeChecked.value = false;
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
const initializeStates = (config: SensorStateConfig) => {
  const setParentAndChildStates = (
    parentGroup: SensorParameterGroup,
    groupName: string,
    bigGroupName: string,
  ) => {
    // Check parent default_state
    if (parentGroup.default_state === "true" || isTrueFlag(parentGroup.mandatory)) {
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
      }else if (bigGroupName === "configuration_params") {
        configurationChecked.value = true;
        onConfigurationCheckedChange({ detail: { checked: true } });
      }else if (bigGroupName === "commande_params") {
        commandeChecked.value = true;
        onCommandeCheckedChange({ detail: { checked: true } });
      }
      paramGroupChecked.value[groupName] = true;
      onParamGroupCheckedChange({ detail: { checked: true } }, groupName, bigGroupName);
    }

    // Check children default_state
    const fields = parentGroup.fields;
    if (fields) {
      Object.keys(fields).forEach((fieldName) => {
        const field = fields[fieldName];
        const defaultValue = field.default_value;
        if (field.HMI && defaultValue) {
          // Initialize field value
          field.selectedValue = defaultValue;
          outputVals[fieldName] = convertToHexFrameValue(defaultValue, field);

          // Store the original max_value
          field.originalMaxValue = field.max_value;

          // Check individual default_state (if applicable)
          if (parentGroup.default_state === "true" || isTrueFlag(parentGroup.mandatory)) {
            paramGroupList[fieldName] = field;
          }
        }
      });
    }
  };

  // Iterate over big groups
  ["batch_params", "modbus_params", "standard_params", "configuration_params", "commande_params", "general_params"].forEach((bigGroupName) => {
    const section = config[bigGroupName];
    if (section) {
      Object.keys(section).forEach((groupName) => {
        const parentGroup = section[groupName];
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
    ["batch_params", "modbus_params", "standard_params", "configuration_params", "commande_params", "general_params"].forEach((section) => {
      if (rawConfig[section]) {
        Object.keys(rawConfig[section]).forEach((groupName) => {
          const group = rawConfig[section][groupName];
          if (group.default_state === "true" || isTrueFlag(group.mandatory)) {
            paramGroupChecked.value[groupName] = true;
            if (section === "general_params") generalChecked.value = true;
            if (section === "batch_params") batchChecked.value = true;
            if (section === "standard_params") standardChecked.value = true;
            if (section === "modbus_params") modbusChecked.value = true;
            if (section === "configuration_params") configurationChecked.value = true;
            if (section === "commande_params") commandeChecked.value = true;
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
const findSensorImage = (config: SensorImageConfig | null | undefined): string => {
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
      const group = section[groupKey];
      if (
        typeof group === 'object' &&
        group !== null &&
        'image' in group &&
        typeof group.image === 'string'
      ) {
        return group.image;
      }
    }
  }
  
  return '';
};

// Initialize default values for sensor parameters
const initParams = () => {
  if (sensorConfig.value) {
    for (const bigGroupName of ['general_params', 'modbus_params', 'batch_params', 'standard_params', 'configuration_params', 'commande_params']) {
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
  
  const outputArea = document.getElementById("outputArea");
  if (!sensorConfig.value) {
    if (outputArea) {
      outputArea.innerHTML = localize("@selectAtLeastOneMode");
    }
    framesAvailable.value = false;
    return;
  }

  Object.keys(sensorConfig.value).forEach((bigGroupName) => {
  // Skip processing if the category is unchecked
    if ((bigGroupName === 'batch_params' && !batchChecked.value) || 
        (bigGroupName === 'modbus_params' && !modbusChecked.value) ||
        (bigGroupName === 'standard_params' && !standardChecked.value) ||
        (bigGroupName === 'general_params' && !generalChecked.value)||
        (bigGroupName === 'configuration_params' && !configurationChecked.value)||
        (bigGroupName === 'commande_params' && !commandeChecked.value)) 
         {
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
    
    cfgBlocks.forEach((cfgEntry: ConfigBlockEntry) => {
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
  if (outputArea) {
    outputArea.innerHTML = outputFrameTxt.trim() === "" ? localize("@selectAtLeastOneMode") : outputFrameTxt;
  }
  framesAvailable.value = outputFrameTxt.trim() !== "";
};

// Replace placeholders in frame templates with actual values
const replaceInFrame = (frame: string, key: string, value: string, enabled: string) => {
  if (value !== undefined && value !== null) {
    if (frame.includes(key)) {
      frame = frame.replace(RegExp(`\\(${key}\\)`, 'g'), `${value}`);
      
      // Only drop the frame when the referenced field is explicitly disabled.
      if (!enabled) {
        frame = '';
      }
    }
  }
  return frame;
};
//Convert minutes to utc minutes
const localMinutesToUtcMinutes = (localMinutes: number) => {
  const now = new Date();
  const localDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    Math.floor(localMinutes / 60),
    localMinutes % 60
  );
  return localDate.getUTCHours() * 60 + localDate.getUTCMinutes();
};
// Convert a parameter value to a hex format for frames
const convertToHexFrameValue = (value: string, param:{
  HMI: any; type: string; isHours: boolean; inverted: string;
}): string => {
  if (param.type === 'frame') return "";

  if (!value) return "";
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
      if (param.HMI?.outputFormat === 'HHMM') {
        const totalMinutes = localMinutesToUtcMinutes(parseInt(value, 10));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        output = hours.toString(16).padStart(2, '0') + minutes.toString(16).padStart(2, '0');
      } else {
        if (param.isHours) {
          value = (parseInt(value) * 60).toString();
        }
        output = (parseInt(value) + 32768).toString(16).padStart(4, '0');
      }
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
const onCategoryCheckedChange = (event: CheckedChangeEvent, category: string) => {
  if (sensorConfig.value[category].global_params) {
    Object.keys(sensorConfig.value[category].global_params.fields).forEach(field => {
      sensorConfig.value[category].global_params.fields[field].enabled = event.detail.checked;
      paramGroupList[field] = sensorConfig.value[category].global_params.fields[field];
    });
  }

  Object.keys(sensorConfig.value[category]).forEach(group => {
    if (group !== "global_params" && group !== "cfg_block") {
      const groupObject = sensorConfig.value[category][group];
      if (groupObject && groupObject.fields) {
        setGroupEnabled(category, group, isTrueFlag(groupObject.mandatory) || event.detail.checked);
      }
    }
  });

  if (event.detail.checked) {
    initializeExclusiveGroups(category);
  }
  
  outputData[category] = event.detail.checked;
  updateOutput();
};

// Update batch mode state
const onBatchCheckedChange = (event: CheckedChangeEvent) => {
  const checked = hasMandatoryGroup("batch_params") || event.detail.checked;
  batchChecked.value = checked;
  onCategoryCheckedChange({ detail: { checked } }, "batch_params");
};

// Update standard mode state
const onStandardCheckedChange = (event: CheckedChangeEvent) => {
  const checked = hasMandatoryGroup("standard_params") || event.detail.checked;
  standardChecked.value = checked;
  onCategoryCheckedChange({ detail: { checked } }, "standard_params");
};

// Update ModBus mode state
const onModbusCheckedChange = (event: CheckedChangeEvent) => {
  const checked = hasMandatoryGroup("modbus_params") || event.detail.checked;
  modbusChecked.value = checked;
  onCategoryCheckedChange({ detail: { checked } }, "modbus_params");
};

// Update configuration mode state
const onConfigurationCheckedChange = (event: CheckedChangeEvent) => {
  const checked = hasMandatoryGroup("configuration_params") || event.detail.checked;
  configurationChecked.value = checked;
  onCategoryCheckedChange({ detail: { checked } }, "configuration_params");
};

// Update commande mode state
const onCommandeCheckedChange = (event: CheckedChangeEvent) => {
  const checked = hasMandatoryGroup("commande_params") || event.detail.checked;
  commandeChecked.value = checked;
  onCategoryCheckedChange({ detail: { checked } }, "commande_params");
};

// Update general mode state
const onGeneralCheckedChange = (event: CheckedChangeEvent) => {
  generalChecked.value = event.detail.checked;
  onCategoryCheckedChange(event, "general_params");
};

// Handle group checkbox changes
const onParamGroupCheckedChange = (event: CheckedChangeEvent, groupName: string | number, bigGroupName: string) => {
  const requestedChecked = isMandatoryGroup(bigGroupName, groupName) || event.detail.checked;
  const checked = requestedChecked || !canDisableExclusiveGroup(bigGroupName, groupName);

  enforceExclusiveGroupRelationships(bigGroupName, groupName, checked);
  setGroupEnabled(bigGroupName, groupName, checked);
  updateOutput();
};

// Handle parameter value changes
const onParamChange = (
  event: ParamChangeEvent,
  bigGroupName: string,
  groupName: string | number,
  paramName: string | number,
) => {
  if (sensorConfig.value[bigGroupName][groupName]) {
    if (sensorConfig.value[bigGroupName][groupName].fields[paramName]) {
      let newVal = "0";
      if (event.newValue || event.newValue === false || event.newValue === 0) {
        newVal = event.newValue.toString();
      } else if (event.detail?.value) {
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

const enforceFieldRelationships = (
  bigGroupName: string,
  groupName: string | number,
) => {
  if (isEnforcingRelationships.value) return;
  
  isEnforcingRelationships.value = true;
  
  try {
    const group = sensorConfig.value[bigGroupName][groupName];
    const allRelationships = [...(group.field_relationships || [])];
    
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
    const browserLanguage = navigator.language.split('-')[0]; // Get the browser language
    if (isLanguageCode(browserLanguage)) {
      currentLanguage.value = browserLanguage;
    } else {
      currentLanguage.value = 'en';
    }
    const selectToStartText = localize("@selectToStart");
    const outputArea = document.getElementById("outputArea");
    if (outputArea) {
      outputArea.innerHTML = selectToStartText;
    }
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
      navigator.clipboard.writeText(text).catch(err => {
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
  } else if (category === 'modbus_params') {
    modbusVisible.value = !modbusVisible.value;
  } else if (category === 'configuration_params') {
    configurationVisible.value = !configurationVisible.value;
  } else if (category === 'commande_params') {
    commandeVisible.value = !commandeVisible.value;
  } else if (category === 'standard_params') {
    standardVisible.value = !standardVisible.value;
  }
};

const toggleSubcategoryVisibility = (groupName: string | number) => {
  const key = String(groupName);
  subcategoryVisible.value[key] = !subcategoryVisible.value[key];
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

const generateFramesForGroup = (bigGroupName: string, groupName: string | number) => {
  const groupKey = String(groupName);
  let frames = '';
  const paramGroup = sensorConfig.value[bigGroupName][groupKey];
  const globalParams = sensorConfig.value[bigGroupName]?.global_params?.fields || {};
  const cfgBlocks = sensorConfig.value[bigGroupName]?.cfg_block || [];
  let frameCount = 0;

  if (paramGroup) {
    cfgBlocks.forEach((cfgEntry: any, index: any) => {
      let frame = cfgEntry[0];
      const frameDesc = cfgEntry[1];
      let includeFrame = false;
      const hasPlaceholder = frame.includes('(') && frame.includes(')');

      if (!hasPlaceholder) {
        includeFrame = true;
      }

      // Special handling for Modbus frames
      if (frame.includes('8007 0000 41 06')) {
        const frameNumber = frame.split(' ')[0];
        if (groupKey === `modbusFrame${frameNumber}` && paramGroup.fields) {
          const fields = {
            slave: paramGroup.fields[`mb${frameNumber}Slave`],
            functionCode: paramGroup.fields[`mb${frameNumber}FunctionCode`],
            startAddress: paramGroup.fields[`mb${frameNumber}StartAddress`],
            numRegisters: paramGroup.fields[`mb${frameNumber}NumRegisters`],
            dataToWrite: paramGroup.fields[`mb${frameNumber}DataToWrite`]
          };
          const modbusFrame = generateModbusFrame(frame, fields, paramGroup.fields[`mb${frameNumber}Slave`]?.enabled);
          if (modbusFrame) {
            const frameId = `frame-${bigGroupName}-${groupKey}-${index}`;
            frames += `<span class="frameArea" id="${frameId}"><span class="frame">${modbusFrame}</span>&nbsp;&nbsp;&nbsp;&nbsp;(${frameDesc}) <button class="copy-button" data-frame-id="${frameId}" data-no-spaces="true">${localize('@copyFrame')}</button></span><br>`;
            frameCount++;
          }
        }
        return;
      }

      if (paramGroup.fields) {
        Object.keys(paramGroup.fields).forEach(paramName => {
          const param = paramGroup.fields[paramName];
          if (!param) return;

          const hasValue = param.selectedValue !== undefined && param.selectedValue !== null && (param.selectedValue !== '' || param.type === 'bool');
          if (hasValue) {
            if (frame.includes(`(${paramName}1)`) || frame.includes(`(${paramName}2)`)) {
              const frameValues = param.selectedValue.toString().split(' ').map((value: string) => convertToHexFrameValue(value, param));
              frame = replaceInFrame(frame, `${paramName}1`, frameValues[0], param.enabled);
              frame = replaceInFrame(frame, `${paramName}2`, frameValues[1], param.enabled);
              includeFrame = true;
            } else if (frame.includes(`(${paramName})`)) {
              const frameValue = convertToHexFrameValue(param.selectedValue, param);
              frame = replaceInFrame(frame, paramName, frameValue || '', param.enabled);
              includeFrame = true;
            }
          } else if (param.type === 'frame' && frame.includes(`(${paramName})`)) {
            frame = replaceInFrame(frame, paramName, "", param.enabled);
            includeFrame = true;
          }
        });
      }

      Object.keys(globalParams).forEach(globalParamName => {
        const globalParam = globalParams[globalParamName];
        if (!globalParam || !globalParam.selectedValue) return;

        if (frame.includes(`(${globalParamName}1)`) || frame.includes(`(${globalParamName}2)`)) {
          const frameValues = globalParam.selectedValue
            .split(' ')
            .map((value: string) => convertToHexFrameValue(value, globalParam));
          frame = replaceInFrame(frame, `${globalParamName}1`, frameValues[0], globalParam.enabled);
          frame = replaceInFrame(frame, `${globalParamName}2`, frameValues[1], globalParam.enabled);
          includeFrame = true;
        } else if (frame.includes(`(${globalParamName})`)) {
          const frameValue = convertToHexFrameValue(globalParam.selectedValue, globalParam);
          frame = replaceInFrame(frame, globalParamName, frameValue, globalParam.enabled);
          includeFrame = true;
        }
      });

      if (includeFrame) {
        const frameId = `frame-${bigGroupName}-${groupKey}-${index}`;
        frames += `<span class="frameArea" id="${frameId}"><span class="frame">${frame}</span>&nbsp;&nbsp;&nbsp;&nbsp;(${frameDesc}) <button class="copy-button" data-frame-id="${frameId}" data-no-spaces="true">${localize('@copyFrame')}</button></span><br>`;
        frameCount++;
      }
    });
  }

  framesCount.value[groupKey] = frameCount;
  return frames;
};

// Update the copyFrame function to handle copying without spaces
const copyFrame = (frameId: string, noSpaces = false) => {
  const frameElement = document
    .getElementById(frameId)
    ?.querySelector<HTMLElement>('.frame');
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
const handleCopyButtonClick = (event: MouseEvent) => {
  if (!(event.target instanceof Element)) return;

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
const toggleFramesVisibility = (groupName: string | number) => {
  const key = String(groupName);
  framesVisible.value[key] = !framesVisible.value[key];
};

const resetToDefault = () => {
  if (selectedSensor.value) {
    onSensorChange({ detail: { value: selectedSensor.value } });
  }
};

// Function to check if only custom-frame elements are present
const onlyCustomFrame = (fields: Record<string, SensorParameter>) => {
  return Object.values(fields).every(field => field.HMI?.visual_type === 'customFrame');
};

// Function to check if a paramGroup has an ion-range component
const hasIonRange = (fields?: Record<string, SensorParameter>) => {
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

.commande-grid {
  grid-template-columns: repeat(2, minmax(320px, 1fr));
}

.subcategory-card {
  width: 100% !important;
  margin: 0 !important;
  height: fit-content;
}

.commande-card {
  width: 100% !important;
  min-height: 120px;
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
