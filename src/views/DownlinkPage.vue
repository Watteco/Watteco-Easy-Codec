<template>
  <ion-page>

    <sensor-mobile-navigation
      v-if="ble.isNative.value"
      active-page="config"
      :localize="localize"
    />

    <ion-content
      :fullscreen="true"
      :class="['sensor-config-content', { 'native-with-sensor-navigation': ble.isNative.value }]"
    >
      <ion-card v-show="false">
        <ion-range></ion-range>
        <ion-chip></ion-chip>
        <ion-toggle></ion-toggle>
      </ion-card>

        <!-- Sensor selection -->
        <ion-card v-if="!ble.isNative.value || sensorImage" id="sensor-card">
          <ion-card-content class="sensor-select">
            <ion-select
                v-if="!ble.isNative.value"
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
        <ion-card
          class="category-card saved-config-menu"
          :class="{ 'saved-config-menu--open': savedConfigurationsVisible }"
        >
          <div class="config-item collapsible-header" @click="savedConfigurationsVisible = !savedConfigurationsVisible">
            <ion-button
              class="visibility-button"
              :aria-expanded="savedConfigurationsVisible"
              @click.stop="savedConfigurationsVisible = !savedConfigurationsVisible"
            >
              <ion-icon
                slot="icon-only"
                :icon="chevronForwardOutline"
                :class="{ 'chevron-expanded': savedConfigurationsVisible }"
              />
            </ion-button>
            <ion-label>{{ localize('@loadSaveConfigurations') }}</ion-label>
            <span class="saved-config-count" :aria-label="localize('@savedConfigurations')">
              {{ savedConfigurations.length }}
            </span>
          </div>

          <ion-card-content v-show="savedConfigurationsVisible" class="saved-config-panel">
            <div class="saved-config-picker">
              <ion-select
                v-if="savedConfigurations.length > 0"
                class="saved-config-select"
                interface="popover"
                fill="outline"
                :label="localize('@savedConfigurations')"
                label-placement="stacked"
                :value="selectedSavedConfigurationId"
                :placeholder="localize('@selectSavedConfiguration')"
                @ionChange="selectedSavedConfigurationId = $event.detail.value"
              >
                <ion-select-option value="">{{ localize('@newConfiguration') }}</ion-select-option>
                <ion-select-option
                  v-for="configuration in savedConfigurations"
                  :key="configuration.id"
                  :value="configuration.id"
                >
                  {{ configuration.name }}
                </ion-select-option>
              </ion-select>
              <p v-else class="saved-config-empty">{{ localize('@noSavedConfiguration') }}</p>

              <ion-button
                class="saved-config-action--load"
                expand="block"
                :disabled="!selectedSavedConfiguration"
                :aria-label="selectedSavedConfiguration
                  ? localize('@loadNamedConfiguration').replace('{name}', selectedSavedConfiguration.name)
                  : localize('@selectConfigurationToLoad')"
                @click="loadSelectedConfiguration"
              >
                <ion-icon slot="start" :icon="checkmarkCircleOutline" />
                {{ localize('@loadConfiguration') }}
              </ion-button>
            </div>

            <div class="saved-config-actions">
              <ion-button
                class="saved-config-action--save"
                size="small"
                fill="outline"
                @click="saveCurrentConfiguration"
              >
                <ion-icon slot="start" :icon="saveOutline" />
                {{ localize('@saveConfiguration') }}
              </ion-button>
              <ion-button
                class="saved-config-action--import"
                size="small"
                fill="outline"
                @click="openConfigurationImport"
              >
                <ion-icon slot="start" :icon="downloadOutline" />
                {{ localize('@importConfiguration') }}
              </ion-button>
              <ion-button
                class="saved-config-action--more"
                size="small"
                fill="outline"
                :disabled="!selectedSavedConfiguration"
                :aria-label="localize('@configurationActions')"
                @click="openSavedConfigurationActions"
              >
                <ion-icon slot="icon-only" :icon="ellipsisVerticalOutline" />
              </ion-button>
              <input
                ref="savedConfigurationFileInput"
                class="saved-config-file-input"
                type="file"
                accept=".json,application/json"
                @change="importConfigurationFile"
              />
            </div>
          </ion-card-content>
        </ion-card>

        <!-- General (general_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.general_params" class="category-card" :key="`general-${currentLanguage}-${selectedSensor}`">
          <div class="config-item collapsible-header" :class="{ 'collapsible-header--disabled': !generalChecked }" @click="onCategoryHeaderClick('general_params', generalChecked)">
            <ion-button class="visibility-button" :class="{ invisible: !generalChecked }" :aria-expanded="generalVisible" @click.stop="toggleVisibility('general_params')">
              <ion-icon slot="icon-only" :icon="chevronForwardOutline" :class="{ 'chevron-expanded': generalVisible }" />
            </ion-button>
            <ion-label>{{ localize("@generalLabel") }}</ion-label>
            <!-- <ion-checkbox :checked="generalChecked" @ionChange="onGeneralCheckedChange"></ion-checkbox> -->
            <ion-button
              @click.stop="resetToDefault"
              class="small-button reset-button"
              :aria-label="localize('@resetToDefault')"
            >
              <ion-icon slot="start" :icon="refreshOutline" />
              <span class="reset-button-label">{{ localize("@resetToDefault") }}</span>
            </ion-button>
          </div>

          <div class="subcategory-card-holder" v-show="generalVisible && generalChecked">
            <!-- General parameters (general_params) -->
            <ion-card v-for="(paramGroup, groupName) in sensorConfig.general_params" 
                      :key="groupName" 
                      v-show="generalChecked && paramGroup.label" 
                      :class="['subcategory-card', { 'full-width': hasIonRange(paramGroup.fields) }]">
              <div class="config-item collapsible-header" :class="{ 'collapsible-header--disabled': !paramGroupChecked[groupName] || !hasUserVisibleFields(paramGroup.fields) }" @click="onSubcategoryHeaderClick(groupName, paramGroup)">
                <ion-button class="visibility-button" :class="{ invisible: !paramGroupChecked[groupName] || !hasUserVisibleFields(paramGroup.fields) }" :aria-expanded="subcategoryVisible[groupName]" @click.stop="toggleSubcategoryVisibility(groupName)">
                  <ion-icon slot="icon-only" :icon="chevronForwardOutline" :class="{ 'chevron-expanded': subcategoryVisible[groupName] }" />
                </ion-button>
                <ion-label
                  :class="{ 'frame-long-press-target': isNativeApp }"
                  @pointerdown="startFrameLongPress(groupName)"
                  @pointerup="cancelFrameLongPress"
                  @pointercancel="cancelFrameLongPress"
                  @pointerleave="cancelFrameLongPress"
                  @contextmenu="preventNativeContextMenu"
                >
                  <span class="group-title">{{ paramGroup.label }}</span>
                  <span v-if="paramGroup.subtitle" class="group-subtitle">{{ paramGroup.subtitle }}</span>
                </ion-label>

                <div class="header-toggle" @click.stop>
                <ion-toggle
                  :checked="paramGroupChecked[groupName] || false"
                  :disabled="isMandatoryGroup('general_params', groupName)"
                  @ionChange="onParamGroupCheckedChange($event, groupName, 'general_params')"
                />
                </div>
              </div>

              <!-- Dynamic fields -->
              <ul v-show="subcategoryVisible[groupName] && paramGroupChecked[groupName] && hasUserVisibleFields(paramGroup.fields)">
                <ion-card v-for="(param, paramName) in paramGroup.fields" 
                          :key="paramName" 
                          v-show="isParameterVisible('general_params', groupName, paramName, param)"
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
                      :max-duration="param.dynamicMaxValue"
                      :allow-seconds="param.HMI?.allow_seconds === true"
                      :seconds-min="param.HMI?.seconds_min ?? 1"
                      :seconds-step="param.HMI?.seconds_step ?? 1"
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

                    <pattern-input
                      v-if="param.HMI?.visual_type === 'pattern'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :bit-count="param.bit_count"
                      :allow-empty="param.allow_empty === true || param.allow_empty === 'true'"
                      :group-name="groupName"
                      :param-name="paramName"
                      :localize="localize"
                      :state-visual-preference-key="stateVisualPreferenceKey"
                      @update:value="onParamChange($event, 'general_params', groupName, paramName)"
                    />

                    <occurrence-input
                      v-if="param.HMI?.visual_type === 'occurrences'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="param.min_value"
                      :max="param.max_value"
                      :group-name="groupName"
                      :param-name="paramName"
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
              <ion-card-content v-if="subcategoryVisible[groupName] && paramGroupChecked[groupName] && (!isNativeApp || framesVisible[groupName])" :class="['showFrameButton', { 'native-frame-controls': isNativeApp }]">
                <ion-button v-if="!isNativeApp" @click="toggleFramesVisibility(groupName)" class="small-button">
                  {{ framesVisible[groupName] ? localize(framesCount[groupName] > 1 ? "@hideFrames" : "@hideFrame") : localize(framesCount[groupName] > 1 ? "@showFrames" : "@showFrame") }}
                </ion-button>
                <ion-button v-else fill="clear" class="frame-icon-button" :aria-label="frameToggleLabel(groupName)" @click="toggleFramesVisibility(groupName)">
                  <ion-icon slot="icon-only" :icon="closeOutline" />
                </ion-button>
                <div v-show="framesVisible[groupName]" class="frames-output" v-html="generateFramesForGroup('general_params', groupName.toString())"></div>
              </ion-card-content>
            </ion-card>
          </div>
        </ion-card>

        <!-- ModBus (modbus_params) -->
        <ion-card v-if="sensorConfig?.modbus_params" class="category-card" :key="`modbus-${currentLanguage}-${selectedSensor}`">
          <div class="config-item collapsible-header" :class="{ 'collapsible-header--disabled': !modbusChecked }" @click="onCategoryHeaderClick('modbus_params', modbusChecked)">
            <ion-button class="visibility-button" :class="{ invisible: !modbusChecked }" :aria-expanded="modbusVisible" @click.stop="toggleVisibility('modbus_params')">
              <ion-icon slot="icon-only" :icon="chevronForwardOutline" :class="{ 'chevron-expanded': modbusVisible }" />
            </ion-button>
            <ion-label>{{ localize("@modbusLabel") }}</ion-label>
            <div class="header-toggle" @click.stop>
              <ion-toggle :checked="modbusChecked || hasMandatoryGroup('modbus_params')" :disabled="hasMandatoryGroup('modbus_params')" @ionChange="onModbusCheckedChange" />
            </div>
          </div>

          <div class="subcategory-card-holder" v-show="modbusVisible && modbusChecked">
            <!-- Temperature, Humidity, Battery (modbus_params) -->
            <ion-card v-for="(paramGroup, groupName) in sensorConfig.modbus_params" 
                      :key="groupName" 
                      v-show="modbusChecked && paramGroup.label" 
                      :class="['subcategory-card', { 'full-width': hasIonRange(paramGroup.fields) }]">
              <div class="config-item collapsible-header" :class="{ 'collapsible-header--disabled': !paramGroupChecked[groupName] || !hasUserVisibleFields(paramGroup.fields) }" @click="onSubcategoryHeaderClick(groupName, paramGroup)">
                <ion-button class="visibility-button" :class="{ invisible: !paramGroupChecked[groupName] || !hasUserVisibleFields(paramGroup.fields) }" :aria-expanded="subcategoryVisible[groupName]" @click.stop="toggleSubcategoryVisibility(groupName)">
                  <ion-icon slot="icon-only" :icon="chevronForwardOutline" :class="{ 'chevron-expanded': subcategoryVisible[groupName] }" />
                </ion-button>
                <ion-label
                  :class="{ 'frame-long-press-target': isNativeApp }"
                  @pointerdown="startFrameLongPress(groupName)"
                  @pointerup="cancelFrameLongPress"
                  @pointercancel="cancelFrameLongPress"
                  @pointerleave="cancelFrameLongPress"
                  @contextmenu="preventNativeContextMenu"
                >
                  <span class="group-title">{{ paramGroup.label }}</span>
                  <span v-if="paramGroup.subtitle" class="group-subtitle">{{ paramGroup.subtitle }}</span>
                </ion-label>

                <div class="header-toggle" @click.stop>
                <ion-toggle
                  :checked="paramGroupChecked[groupName] || false"
                  :disabled="isMandatoryGroup('modbus_params', groupName)"
                  @ionChange="onParamGroupCheckedChange($event, groupName, 'modbus_params')"
                />
                </div>
              </div>

              <!-- Dynamic fields -->
              <ul v-show="subcategoryVisible[groupName] && paramGroupChecked[groupName] && hasUserVisibleFields(paramGroup.fields)">
                <ion-card v-for="(param, paramName) in paramGroup.fields" 
                          :key="paramName" 
                          v-show="isParameterVisible('modbus_params', groupName, paramName, param)"
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
                      :max-duration="param.dynamicMaxValue"
                      :allow-seconds="param.HMI?.allow_seconds === true"
                      :seconds-min="param.HMI?.seconds_min ?? 1"
                      :seconds-step="param.HMI?.seconds_step ?? 1"
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

                    <pattern-input
                      v-if="param.HMI?.visual_type === 'pattern'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :bit-count="param.bit_count"
                      :allow-empty="param.allow_empty === true || param.allow_empty === 'true'"
                      :group-name="groupName"
                      :param-name="paramName"
                      :localize="localize"
                      :state-visual-preference-key="stateVisualPreferenceKey"
                      @update:value="onParamChange($event, 'modbus_params', groupName, paramName)"
                    />

                    <occurrence-input
                      v-if="param.HMI?.visual_type === 'occurrences'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="param.min_value"
                      :max="param.max_value"
                      :group-name="groupName"
                      :param-name="paramName"
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
              <ion-card-content v-if="subcategoryVisible[groupName] && paramGroupChecked[groupName] && (!isNativeApp || framesVisible[groupName])" :class="['showFrameButton', { 'native-frame-controls': isNativeApp }]">
                <ion-button v-if="!isNativeApp" @click="toggleFramesVisibility(groupName)" class="small-button">
                  {{ framesVisible[groupName] ? localize(framesCount[groupName] > 1 ? "@hideFrames" : "@hideFrame") : localize(framesCount[groupName] > 1 ? "@showFrames" : "@showFrame") }}
                </ion-button>
                <ion-button v-else fill="clear" class="frame-icon-button" :aria-label="frameToggleLabel(groupName)" @click="toggleFramesVisibility(groupName)">
                  <ion-icon slot="icon-only" :icon="closeOutline" />
                </ion-button>
                <div v-show="framesVisible[groupName]" class="frames-output" v-html="generateFramesForGroup('modbus_params', groupName)"></div>
              </ion-card-content>
            </ion-card>
          </div>
          
        </ion-card>


        <!-- Batch (batch_params) -->
        <ion-card v-if="sensorConfig && sensorConfig.batch_params" class="category-card" :key="`batch-${currentLanguage}-${selectedSensor}`">
          <div class="config-item collapsible-header" :class="{ 'collapsible-header--disabled': !batchChecked }" @click="onCategoryHeaderClick('batch_params', batchChecked)">
            <ion-button class="visibility-button" :class="{ invisible: !batchChecked }" :aria-expanded="batchVisible" @click.stop="toggleVisibility('batch_params')">
              <ion-icon slot="icon-only" :icon="chevronForwardOutline" :class="{ 'chevron-expanded': batchVisible }" />
            </ion-button>
            <ion-label>{{ localize("@batchLabel") }}</ion-label>
            <div class="header-toggle" @click.stop>
              <ion-toggle :checked="batchChecked || hasMandatoryGroup('batch_params')" :disabled="hasMandatoryGroup('batch_params')" @ionChange="onBatchCheckedChange" />
            </div>
          </div>

          <div class="subcategory-card-holder" v-show="batchVisible && batchChecked">
            <!-- Temperature, Humidity, Battery (batch_params) -->
            <ion-card v-for="(paramGroup, groupName) in sensorConfig.batch_params" 
                      :key="groupName" 
                      v-show="batchChecked && paramGroup.label" 
                      :class="['subcategory-card', { 'full-width': hasIonRange(paramGroup.fields) }]">
              <div class="config-item collapsible-header" :class="{ 'collapsible-header--disabled': !paramGroupChecked[groupName] || !hasUserVisibleFields(paramGroup.fields) }" @click="onSubcategoryHeaderClick(groupName, paramGroup)">
                <ion-button class="visibility-button" :class="{ invisible: !paramGroupChecked[groupName] || !hasUserVisibleFields(paramGroup.fields) }" :aria-expanded="subcategoryVisible[groupName]" @click.stop="toggleSubcategoryVisibility(groupName)">
                  <ion-icon slot="icon-only" :icon="chevronForwardOutline" :class="{ 'chevron-expanded': subcategoryVisible[groupName] }" />
                </ion-button>
                <ion-label
                  :class="{ 'frame-long-press-target': isNativeApp }"
                  @pointerdown="startFrameLongPress(groupName)"
                  @pointerup="cancelFrameLongPress"
                  @pointercancel="cancelFrameLongPress"
                  @pointerleave="cancelFrameLongPress"
                  @contextmenu="preventNativeContextMenu"
                >
                  <span class="group-title">{{ paramGroup.label }}</span>
                  <span v-if="paramGroup.subtitle" class="group-subtitle">{{ paramGroup.subtitle }}</span>
                </ion-label>

                <div class="header-toggle" @click.stop>
                <ion-toggle
                  :checked="paramGroupChecked[groupName] || false"
                  :disabled="isMandatoryGroup('batch_params', groupName)"
                  @ionChange="onParamGroupCheckedChange($event, groupName, 'batch_params')"
                />
                </div>
              </div>

              <!-- Dynamic fields -->
              <ul v-show="subcategoryVisible[groupName] && paramGroupChecked[groupName] && hasUserVisibleFields(paramGroup.fields)">
                <ion-card v-for="(param, paramName) in paramGroup.fields" 
                          :key="paramName" 
                          v-show="isParameterVisible('batch_params', groupName, paramName, param)"
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
                      :max-duration="param.dynamicMaxValue"
                      :allow-seconds="param.HMI?.allow_seconds === true"
                      :seconds-min="param.HMI?.seconds_min ?? 1"
                      :seconds-step="param.HMI?.seconds_step ?? 1"
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

                    <pattern-input
                      v-if="param.HMI?.visual_type === 'pattern'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :bit-count="param.bit_count"
                      :allow-empty="param.allow_empty === true || param.allow_empty === 'true'"
                      :group-name="groupName"
                      :param-name="paramName"
                      :localize="localize"
                      :state-visual-preference-key="stateVisualPreferenceKey"
                      @update:value="onParamChange($event, 'batch_params', groupName, paramName)"
                    />

                    <occurrence-input
                      v-if="param.HMI?.visual_type === 'occurrences'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="param.min_value"
                      :max="param.max_value"
                      :group-name="groupName"
                      :param-name="paramName"
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
              <ion-card-content v-if="subcategoryVisible[groupName] && paramGroupChecked[groupName] && (!isNativeApp || framesVisible[groupName])" :class="['showFrameButton', { 'native-frame-controls': isNativeApp }]">
                <ion-button v-if="!isNativeApp" @click="toggleFramesVisibility(groupName)" class="small-button">
                  {{ framesVisible[groupName] ? localize(framesCount[groupName] > 1 ? "@hideFrames" : "@hideFrame") : localize(framesCount[groupName] > 1 ? "@showFrames" : "@showFrame") }}
                </ion-button>
                <ion-button v-else fill="clear" class="frame-icon-button" :aria-label="frameToggleLabel(groupName)" @click="toggleFramesVisibility(groupName)">
                  <ion-icon slot="icon-only" :icon="closeOutline" />
                </ion-button>
                <div v-show="framesVisible[groupName]" class="frames-output" v-html="generateFramesForGroup('batch_params', groupName)"></div>
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
          <div class="config-item collapsible-header" :class="{ 'collapsible-header--disabled': !standardChecked }" @click="onCategoryHeaderClick('standard_params', standardChecked)">
            <ion-button class="visibility-button" :class="{ invisible: !standardChecked }" :aria-expanded="standardVisible" @click.stop="toggleVisibility('standard_params')">
              <ion-icon slot="icon-only" :icon="chevronForwardOutline" :class="{ 'chevron-expanded': standardVisible }" />
            </ion-button>
            <ion-label>{{ localize("@standLabel") }}</ion-label>
            <div class="header-toggle" @click.stop>
              <ion-toggle :checked="standardChecked || hasMandatoryGroup('standard_params')" :disabled="hasMandatoryGroup('standard_params')" @ionChange="onStandardCheckedChange" />
            </div>
          </div>

          <div class="subcategory-card-holder" v-show="standardVisible && standardChecked">
            <!-- Temperature, Humidity, Battery (standard_params) -->
            <ion-card v-for="(paramGroup, groupName) in sensorConfig.standard_params" 
                      :key="groupName" 
                      v-show="standardChecked && paramGroup.label" 
                      :class="['subcategory-card', { 'full-width': hasIonRange(paramGroup.fields) }]">
              <div class="config-item collapsible-header" :class="{ 'collapsible-header--disabled': !paramGroupChecked[groupName] || !hasUserVisibleFields(paramGroup.fields) }" @click="onSubcategoryHeaderClick(groupName, paramGroup)">
                <ion-button class="visibility-button" :class="{ invisible: !paramGroupChecked[groupName] || !hasUserVisibleFields(paramGroup.fields) }" :aria-expanded="subcategoryVisible[groupName]" @click.stop="toggleSubcategoryVisibility(groupName)">
                  <ion-icon slot="icon-only" :icon="chevronForwardOutline" :class="{ 'chevron-expanded': subcategoryVisible[groupName] }" />
                </ion-button>
                <ion-label
                  :class="{ 'frame-long-press-target': isNativeApp }"
                  @pointerdown="startFrameLongPress(groupName)"
                  @pointerup="cancelFrameLongPress"
                  @pointercancel="cancelFrameLongPress"
                  @pointerleave="cancelFrameLongPress"
                  @contextmenu="preventNativeContextMenu"
                >
                  <span class="group-title">{{ paramGroup.label }}</span>
                  <span v-if="paramGroup.subtitle" class="group-subtitle">{{ paramGroup.subtitle }}</span>
                </ion-label>

                <div class="header-toggle" @click.stop>
                <ion-toggle
                  :checked="paramGroupChecked[groupName] || false"
                  :disabled="isMandatoryGroup('standard_params', groupName)"
                  @ionChange="onParamGroupCheckedChange($event, groupName, 'standard_params')"
                />
                </div>
              </div>

              <!-- Dynamic fileds -->
              <ul v-show="subcategoryVisible[groupName] && paramGroupChecked[groupName] && hasUserVisibleFields(paramGroup.fields)">
                <ion-card v-for="(param, paramName) in paramGroup.fields" 
                          :key="paramName" 
                          v-show="isParameterVisible('standard_params', groupName, paramName, param)"
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
                      :max-duration="param.dynamicMaxValue"
                      :allow-seconds="param.HMI?.allow_seconds === true"
                      :seconds-min="param.HMI?.seconds_min ?? 1"
                      :seconds-step="param.HMI?.seconds_step ?? 1"
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

                    <pattern-input
                      v-if="param.HMI?.visual_type === 'pattern'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :bit-count="param.bit_count"
                      :allow-empty="param.allow_empty === true || param.allow_empty === 'true'"
                      :group-name="groupName"
                      :param-name="paramName"
                      :localize="localize"
                      :state-visual-preference-key="stateVisualPreferenceKey"
                      @update:value="onParamChange($event, 'standard_params', groupName, paramName)"
                    />

                    <occurrence-input
                      v-if="param.HMI?.visual_type === 'occurrences'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="param.min_value"
                      :max="param.max_value"
                      :group-name="groupName"
                      :param-name="paramName"
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
              <ion-card-content v-if="subcategoryVisible[groupName] && paramGroupChecked[groupName] && (!isNativeApp || framesVisible[groupName])" :class="['showFrameButton', { 'native-frame-controls': isNativeApp }]">
                <ion-button v-if="!isNativeApp" @click="toggleFramesVisibility(groupName)" class="small-button">
                  {{ framesVisible[groupName] ? localize(framesCount[groupName] > 1 ? "@hideFrames" : "@hideFrame") : localize(framesCount[groupName] > 1 ? "@showFrames" : "@showFrame") }}
                </ion-button>
                <ion-button v-else fill="clear" class="frame-icon-button" :aria-label="frameToggleLabel(groupName)" @click="toggleFramesVisibility(groupName)">
                  <ion-icon slot="icon-only" :icon="closeOutline" />
                </ion-button>
                <div v-show="framesVisible[groupName]" class="frames-output" v-html="generateFramesForGroup('standard_params', groupName)"></div>
              </ion-card-content>
            </ion-card>
          </div>
        </ion-card>
        <!-- Configuration (configuration_params) -->
        <ion-card v-if="sensorConfig?.configuration_params" class="category-card" :key="`configuration-${currentLanguage}-${selectedSensor}`">
          <div class="config-item collapsible-header" :class="{ 'collapsible-header--disabled': !configurationChecked }" @click="onCategoryHeaderClick('configuration_params', configurationChecked)">
            <ion-button class="visibility-button" :class="{ invisible: !configurationChecked }" :aria-expanded="configurationVisible" @click.stop="toggleVisibility('configuration_params')">
              <ion-icon slot="icon-only" :icon="chevronForwardOutline" :class="{ 'chevron-expanded': configurationVisible }" />
            </ion-button>
            <ion-label>{{ localize("@configurationLabel") }}</ion-label>
            <div class="header-toggle" @click.stop>
              <ion-toggle :checked="configurationChecked || hasMandatoryGroup('configuration_params')" :disabled="hasMandatoryGroup('configuration_params')" @ionChange="onConfigurationCheckedChange" />
            </div>
          </div>

          <div class="subcategory-card-holder" v-show="configurationVisible && configurationChecked">
            <ion-card v-for="(paramGroup, groupName) in sensorConfig.configuration_params" 
                      :key="groupName" 
                      v-show="configurationChecked && paramGroup.label" 
                      :class="['subcategory-card', { 'full-width': hasIonRange(paramGroup.fields) }]">
              <div class="config-item collapsible-header" :class="{ 'collapsible-header--disabled': !paramGroupChecked[groupName] || !hasUserVisibleFields(paramGroup.fields) }" @click="onSubcategoryHeaderClick(groupName, paramGroup)">
                <ion-button class="visibility-button" :class="{ invisible: !paramGroupChecked[groupName] || !hasUserVisibleFields(paramGroup.fields) }" :aria-expanded="subcategoryVisible[groupName]" @click.stop="toggleSubcategoryVisibility(groupName)">
                  <ion-icon slot="icon-only" :icon="chevronForwardOutline" :class="{ 'chevron-expanded': subcategoryVisible[groupName] }" />
                </ion-button>
                <ion-label
                  :class="{ 'frame-long-press-target': isNativeApp }"
                  @pointerdown="startFrameLongPress(groupName)"
                  @pointerup="cancelFrameLongPress"
                  @pointercancel="cancelFrameLongPress"
                  @pointerleave="cancelFrameLongPress"
                  @contextmenu="preventNativeContextMenu"
                >
                  <span class="group-title">{{ paramGroup.label }}</span>
                  <span v-if="paramGroup.subtitle" class="group-subtitle">{{ paramGroup.subtitle }}</span>
                </ion-label>

                <div class="header-toggle" @click.stop>
                <ion-toggle
                  :checked="paramGroupChecked[groupName] || false"
                  :disabled="isMandatoryGroup('configuration_params', groupName)"
                  @ionChange="onParamGroupCheckedChange($event, groupName, 'configuration_params')"
                />
                </div>
              </div>

              <ul v-show="subcategoryVisible[groupName] && paramGroupChecked[groupName] && hasUserVisibleFields(paramGroup.fields)">
                <ion-card v-for="(param, paramName) in paramGroup.fields" 
                          :key="paramName" 
                          v-show="isParameterVisible('configuration_params', groupName, paramName, param)"
                          class="config-card">
                  <ion-item class="config-item">
                    <time-slider
                      v-if="param.HMI?.visual_type === 'timeSlider' || param.HMI?.visual_type === 'timeSliderHHMM'"
                      :label="param.HMI?.label"
                      :min="param.min_value"
                      :max="param.max_value"
                      :value="param.selectedValue"
                      :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                      :max-duration="param.dynamicMaxValue"
                      :allow-seconds="param.HMI?.allow_seconds === true"
                      :seconds-min="param.HMI?.seconds_min ?? 1"
                      :seconds-step="param.HMI?.seconds_step ?? 1"
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

                    <pattern-input
                      v-if="param.HMI?.visual_type === 'pattern'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :bit-count="param.bit_count"
                      :allow-empty="param.allow_empty === true || param.allow_empty === 'true'"
                      :group-name="groupName"
                      :param-name="paramName"
                      :localize="localize"
                      :state-visual-preference-key="stateVisualPreferenceKey"
                      @update:value="onParamChange($event, 'configuration_params', groupName, paramName)"
                    />

                    <occurrence-input
                      v-if="param.HMI?.visual_type === 'occurrences'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="param.min_value"
                      :max="param.max_value"
                      :group-name="groupName"
                      :param-name="paramName"
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
              <ion-card-content v-if="subcategoryVisible[groupName] && paramGroupChecked[groupName] && (!isNativeApp || framesVisible[groupName])" :class="['showFrameButton', { 'native-frame-controls': isNativeApp }]">
                <ion-button v-if="!isNativeApp" @click="toggleFramesVisibility(groupName)" class="small-button">
                  {{ framesVisible[groupName] ? localize(framesCount[groupName] > 1 ? "@hideFrames" : "@hideFrame") : localize(framesCount[groupName] > 1 ? "@showFrames" : "@showFrame") }}
                </ion-button>
                <ion-button v-else fill="clear" class="frame-icon-button" :aria-label="frameToggleLabel(groupName)" @click="toggleFramesVisibility(groupName)">
                  <ion-icon slot="icon-only" :icon="closeOutline" />
                </ion-button>
                <div v-show="framesVisible[groupName]" class="frames-output" v-html="generateFramesForGroup('configuration_params', groupName)"></div>
              </ion-card-content>
            </ion-card>
          </div>
        </ion-card>

        <!-- Commande (commande_params) -->
        <ion-card v-if="sensorConfig?.commande_params" class="category-card" :key="`commande-${currentLanguage}-${selectedSensor}`">
          <div class="config-item collapsible-header" :class="{ 'collapsible-header--disabled': !commandeChecked }" @click="onCategoryHeaderClick('commande_params', commandeChecked)">
            <ion-button class="visibility-button" :class="{ invisible: !commandeChecked }" :aria-expanded="commandeVisible" @click.stop="toggleVisibility('commande_params')">
              <ion-icon slot="icon-only" :icon="chevronForwardOutline" :class="{ 'chevron-expanded': commandeVisible }" />
            </ion-button>
            <ion-label>{{ localize("@commandeLabel") }}</ion-label>
            <div class="header-toggle" @click.stop>
              <ion-toggle :checked="commandeChecked || hasMandatoryGroup('commande_params')" :disabled="hasMandatoryGroup('commande_params')" @ionChange="onCommandeCheckedChange" />
            </div>
          </div>

          <div class="subcategory-card-holder commande-grid" v-show="commandeVisible && commandeChecked">
            <ion-card v-for="(paramGroup, groupName) in sensorConfig.commande_params" 
                      :key="groupName" 
                      v-show="commandeChecked && paramGroup.label" 
                      class="subcategory-card commande-card">
              <div class="config-item collapsible-header" :class="{ 'collapsible-header--disabled': !paramGroupChecked[groupName] || !hasUserVisibleFields(paramGroup.fields) }" @click="onSubcategoryHeaderClick(groupName, paramGroup)">
                <ion-button class="visibility-button" :class="{ invisible: !paramGroupChecked[groupName] || !hasUserVisibleFields(paramGroup.fields) }" :aria-expanded="subcategoryVisible[groupName]" @click.stop="toggleSubcategoryVisibility(groupName)">
                  <ion-icon slot="icon-only" :icon="chevronForwardOutline" :class="{ 'chevron-expanded': subcategoryVisible[groupName] }" />
                </ion-button>
                <ion-label
                  :class="{ 'frame-long-press-target': isNativeApp }"
                  @pointerdown="startFrameLongPress(groupName)"
                  @pointerup="cancelFrameLongPress"
                  @pointercancel="cancelFrameLongPress"
                  @pointerleave="cancelFrameLongPress"
                  @contextmenu="preventNativeContextMenu"
                >
                  <span class="group-title">{{ paramGroup.label }}</span>
                  <span v-if="paramGroup.subtitle" class="group-subtitle">{{ paramGroup.subtitle }}</span>
                </ion-label>

                <div class="header-toggle" @click.stop>
                <ion-toggle
                  :checked="paramGroupChecked[groupName] || false"
                  :disabled="isMandatoryGroup('commande_params', groupName)"
                  @ionChange="onParamGroupCheckedChange($event, groupName, 'commande_params')"
                />
                </div>
              </div>

              <ul v-show="subcategoryVisible[groupName] && paramGroupChecked[groupName] && hasUserVisibleFields(paramGroup.fields)">
                <ion-card v-for="(param, paramName) in paramGroup.fields" 
                          :key="paramName" 
                          v-show="isParameterVisible('commande_params', groupName, paramName, param)"
                          class="config-card">
                  <ion-item class="config-item">
                    <time-slider
                      v-if="param.HMI?.visual_type === 'timeSlider' || param.HMI?.visual_type === 'timeSliderHHMM'"
                      :label="param.HMI?.label"
                      :min="param.min_value"
                      :max="param.max_value"
                      :value="param.selectedValue"
                      :step="`${param.step ? param.step : calculateSteps(param.min_value, param.max_value) }`"
                      :max-duration="param.dynamicMaxValue"
                      :allow-seconds="param.HMI?.allow_seconds === true"
                      :seconds-min="param.HMI?.seconds_min ?? 1"
                      :seconds-step="param.HMI?.seconds_step ?? 1"
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

                    <pattern-input
                      v-if="param.HMI?.visual_type === 'pattern'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :bit-count="param.bit_count"
                      :allow-empty="param.allow_empty === true || param.allow_empty === 'true'"
                      :group-name="groupName"
                      :param-name="paramName"
                      :localize="localize"
                      :state-visual-preference-key="stateVisualPreferenceKey"
                      @update:value="onParamChange($event, 'commande_params', groupName, paramName)"
                    />

                    <occurrence-input
                      v-if="param.HMI?.visual_type === 'occurrences'"
                      :label="param.HMI?.label"
                      :value="param.selectedValue"
                      :min="param.min_value"
                      :max="param.max_value"
                      :group-name="groupName"
                      :param-name="paramName"
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
              <ion-card-content v-if="subcategoryVisible[groupName] && paramGroupChecked[groupName] && (!isNativeApp || framesVisible[groupName])" :class="['showFrameButton', { 'native-frame-controls': isNativeApp }]">
                <ion-button v-if="!isNativeApp" @click="toggleFramesVisibility(groupName)" class="small-button">
                  {{ framesVisible[groupName] ? localize(framesCount[groupName] > 1 ? "@hideFrames" : "@hideFrame") : localize(framesCount[groupName] > 1 ? "@showFrames" : "@showFrame") }}
                </ion-button>
                <ion-button v-else fill="clear" class="frame-icon-button" :aria-label="frameToggleLabel(groupName)" @click="toggleFramesVisibility(groupName)">
                  <ion-icon slot="icon-only" :icon="closeOutline" />
                </ion-button>
                <div v-show="framesVisible[groupName]" class="frames-output" v-html="generateFramesForGroup('commande_params', groupName)"></div>
              </ion-card-content>
            </ion-card>
          </div>
        </ion-card>
      </div>

      <ion-card class="outputCard" v-show="sensorConfigLoaded && !(sensorConfig?.general_params?.outputCardHidden)">
        <ion-card-content class="output-area">
        <ion-label v-if="!ble.isNative.value" id="outputTitle">{{ localize("@port125") }}</ion-label>
        <ion-label id="outputArea" v-show="!bleHideInProd">  </ion-label>

        <!-- Web: copy to clipboard (unchanged behavior) -->
        <ion-button v-if="framesAvailable && !ble.isNative.value" @click="copyFramesNoSpaces" class="half-width">{{ localize("@copyFrames") }}</ion-button>

        <!-- Native: BLE send (connection managed by BleConnectPage) -->
        <div v-if="ble.isNative.value" class="ble-panel">
          <ion-button
            v-if="supportsReportingConfigurationRead"
            class="ble-read-configuration"
            expand="block"
            fill="outline"
            :disabled="!ble.connected.value || ble.sending.value || ble.pairing.value"
            @click="readCurrentConfigurationBle"
          >
            <ion-icon
              slot="start"
              :icon="configurationOsaAuthenticated === true ? lockOpenOutline : lockClosed"
            />
            {{ configurationReadInProgress
              ? localize('@bleReadingSensorConfiguration')
              : localize('@bleReadSensorConfiguration') }}
          </ion-button>
          <div class="ble-actions">
            <div v-if="framesAvailable" class="ble-action">
              <ion-button
                @click="sendDefaultConfigurationBle"
                :disabled="!ble.connected.value || ble.sending.value || ble.pairing.value"
                expand="block"
                :color="configurationSendSuccessMode === 'default' ? 'success' : 'primary'"
              >
                <ion-icon
                  slot="start"
                  :icon="configurationSendSuccessMode === 'default'
                    ? checkmarkCircleOutline
                    : configurationOsaAuthenticated === true ? lockOpenOutline : lockClosed"
                />
                {{ configurationSendMode === 'default' && ble.pairing.value
                  ? 'Pairing…'
                  : configurationSendMode === 'default' && ble.osaAuthenticating.value
                    ? localize('@bleAuthenticating')
                    : configurationSendMode === 'default' && ble.sending.value
                      ? localize('@bleSending')
                      : configurationSendSuccessMode === 'default'
                        ? localize('@bleConfigurationSent')
                        : localize('@bleWriteDefaultConfig') }}
              </ion-button>
              <ion-checkbox
                v-if="developerModeEnabled"
                class="ble-activation-option"
                label-placement="end"
                justify="start"
                :checked="activateConfigurationAfterSend"
                :disabled="!ble.connected.value || ble.sending.value || ble.pairing.value"
                @ionChange="activateConfigurationAfterSend = $event.detail.checked"
              >
                {{ localize('@bleActivateDefaultAfterSend') }}
              </ion-checkbox>
              <ion-button v-if="developerModeEnabled" size="small" fill="clear" class="ble-preview-toggle" @click="toggleDefaultConfigurationPreview">
                <ion-icon slot="start" :icon="defaultConfigurationPreviewVisible ? eyeOffOutline : eyeOutline" />
                {{ localize(defaultConfigurationPreviewVisible ? '@bleHideBlobPreview' : '@bleShowBlobPreview') }}
              </ion-button>
              <pre v-if="developerModeEnabled && defaultConfigurationPreviewVisible" class="ble-payload-preview">{{ defaultConfigurationPreview }}</pre>
            </div>
            <div v-if="framesAvailable" class="ble-action">
              <div class="ble-send-button-wrap">
                <ion-button
                  @click="sendCurrentConfigurationBle"
                  :disabled="!ble.connected.value || ble.sending.value || ble.pairing.value"
                  expand="block"
                  :color="configurationSendSuccessMode === 'current' ? 'success' : 'secondary'"
                >
                  <ion-icon
                    slot="start"
                    :icon="configurationSendSuccessMode === 'current'
                      ? checkmarkCircleOutline
                      : configurationOsaAuthenticated === true ? lockOpenOutline : lockClosed"
                  />
                  {{ configurationSendMode === 'current' && ble.pairing.value
                    ? 'Pairing…'
                    : configurationSendMode === 'current' && ble.osaAuthenticating.value
                      ? localize('@bleAuthenticating')
                      : configurationSendMode === 'current' && ble.sending.value
                        ? localize('@bleSending')
                        : configurationSendSuccessMode === 'current'
                          ? localize('@bleConfigurationSent')
                          : localize('@bleWriteCurrentConfig') }}
                </ion-button>
                <span
                  v-if="configurationSendMode === 'current' && currentConfigurationProgress.total > 0"
                  class="ble-send-button-fill"
                  :style="{ width: `${100 * currentConfigurationProgress.sent / currentConfigurationProgress.total}%` }"
                  aria-hidden="true"
                />
              </div>
              <ion-button v-if="developerModeEnabled" size="small" fill="clear" class="ble-preview-toggle" @click="toggleCurrentConfigurationPreview">
                <ion-icon slot="start" :icon="currentConfigurationPreviewVisible ? eyeOffOutline : eyeOutline" />
                {{ localize(currentConfigurationPreviewVisible ? '@bleHideAppTxPreview' : '@bleShowAppTxPreview') }}
              </ion-button>
              <pre v-if="developerModeEnabled && currentConfigurationPreviewVisible" class="ble-payload-preview">{{ currentConfigurationPreview }}</pre>
            </div>
          </div>
          <div v-if="configurationSendSuccessMode" class="ble-send-success" role="status" aria-live="polite">
            <ion-icon :icon="checkmarkCircleOutline" aria-hidden="true" />
            <span>{{ localize('@bleConfigurationSentMessage') }}</span>
          </div>
          <div
            v-if="configurationReadResult"
            :class="configurationReadHasWarnings ? 'ble-send-warning' : 'ble-send-success'"
            :role="configurationReadHasWarnings ? 'alert' : 'status'"
            aria-live="polite"
          >
            <div :class="configurationReadHasWarnings ? 'ble-send-warning-title' : ''">
              <ion-icon
                :icon="configurationReadHasWarnings ? alertCircleOutline : checkmarkCircleOutline"
                aria-hidden="true"
              />
              <strong>
                {{ configurationReadResult.matchedFrameCount }}
                {{ localize('@bleReportingConfigurationsLoaded') }}
              </strong>
            </div>
            <template v-if="configurationReadHasWarnings">
              <p>{{ localize(paramGroupChecked.remove_config
                ? '@bleIncompatibleConfigurationsWillBeRemoved'
                : '@bleIncompatibleConfigurationsMayConflict') }}</p>
              <ul class="ble-send-failures">
                <li v-if="configurationReadResult.unmatchedFrames.length > 0">
                  <strong>{{ localize('@bleUnknownReportingConfigurations') }}</strong>
                  <span>{{ configurationReadResult.unmatchedFrames.length }}</span>
                </li>
                <li v-for="conflict in configurationReadResult.conflicts" :key="`conflict-${conflict.fieldName}`">
                  <strong>{{ conflict.fieldName }}</strong>
                  <span>{{ conflict.values.join(' / ') }}</span>
                </li>
                <li v-if="configurationReadResult.exclusiveGroupConflicts.length > 0">
                  <strong>{{ localize('@bleExclusiveConfigurationConflict') }}</strong>
                  <span>{{ configurationReadResult.exclusiveGroupConflicts.flat().join(' / ') }}</span>
                </li>
                <li v-if="configurationReadResult.unsupportedValues.length > 0">
                  <strong>{{ localize('@bleUnsupportedConfigurationValues') }}</strong>
                  <span>{{ configurationReadResult.unsupportedValues.map(value => `${value.fieldName}: ${value.rawHex}`).join(', ') }}</span>
                </li>
                <li v-if="configurationReadResult.invalidFrames.length > 0">
                  <strong>{{ localize('@bleInvalidReportingResponses') }}</strong>
                  <span>{{ configurationReadResult.invalidFrames.length }}</span>
                </li>
              </ul>
              <div v-if="developerModeEnabled" class="ble-reporting-diagnostics">
                <strong>{{ localize('@bleReportingConfigurationDiagnostics') }}</strong>
                <ul>
                  <li
                    v-for="(frame, index) in configurationReadResult.unmatchedFrameDetails"
                    :key="`unmatched-frame-${index}`"
                  >
                    <code>{{ frame.hex }}</code>
                    <span v-if="frame.reason === 'length-mismatch'">
                      {{ localize('@bleReportingFrameLengthMismatch') }}
                      ({{ frame.normalizedLength }} / {{ frame.expectedLengths.join(', ') }})
                    </span>
                    <span v-else>{{ localize('@bleReportingFrameFixedBytesMismatch') }}</span>
                  </li>
                  <li
                    v-for="(frame, index) in configurationReadResult.invalidFrames"
                    :key="`invalid-frame-${index}`"
                  >
                    <code>{{ frame.hex }}</code>
                    <span>{{ frame.status === undefined
                      ? localize('@bleReportingFrameMalformed')
                      : `${localize('@bleReportingFrameRejected')} - ${formatConfigurationStatus(frame.status)}` }}</span>
                  </li>
                  <li
                    v-for="(value, index) in configurationReadResult.unsupportedValues"
                    :key="`unsupported-value-${index}`"
                  >
                    <code>{{ value.frameHex }}</code>
                    <span>
                      {{ value.fieldName }} ({{ value.rawHex }}) -
                      {{ localize(value.reason === 'seconds-not-representable'
                        ? '@bleReportingSecondsNotRepresentable'
                        : '@bleReportingValueOutOfRange') }}
                    </span>
                  </li>
                </ul>
              </div>
            </template>
          </div>
          <div
            v-if="currentConfigurationSendResult && (currentConfigurationSendResult.state === 'partial' || currentConfigurationSendResult.state === 'failed')"
            class="ble-send-warning"
            role="alert"
            aria-live="polite"
          >
            <div class="ble-send-warning-title">
              <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
              <strong>{{ localize(currentConfigurationSendResult.state === 'partial'
                ? '@bleConfigurationCompletedWithErrors'
                : '@bleConfigurationInterrupted') }}</strong>
            </div>
            <p>
              {{ currentConfigurationSendResult.processed }}/{{ currentConfigurationSendResult.total }}
              {{ localize('@bleConfigurationStepsCompleted') }}.
              <template v-if="currentConfigurationSendResult.state === 'partial'">
                {{ localize('@bleConfigurationOtherSettingsSent') }}
              </template>
            </p>
            <ul class="ble-send-failures">
              <li v-for="failure in configurationFailureResults" :key="`${failure.index}-${failure.outcome}`">
                <strong>{{ failure.frame.label || `${localize('@bleConfigurationSetting')} ${failure.index}` }}</strong>
                <span>{{ describeConfigurationFrameFailure(failure) }}</span>
              </li>
            </ul>
            <ion-button size="small" fill="outline" color="warning" @click="copyCurrentConfigurationDiagnostic">
              {{ localize('@bleConfigurationCopyDiagnostic') }}
            </ion-button>
          </div>
          <div v-if="ble.pairing.value" class="ble-status-msg">
            <ion-text color="warning">Confirm the secure Bluetooth pairing on Android to continue.</ion-text>
          </div>
          <div v-if="ble.statusMessage.value && !bleHideInProd" class="ble-status-msg">
            <ion-text color="medium">{{ ble.statusMessage.value }}</ion-text>
          </div>
        </div>

        </ion-card-content>
      </ion-card>
    </ion-content>

  <div v-if="!ble.isNative.value" class="language-switcher">
    <LanguageSwitcher 
      :current-language="currentLanguage"
      @update:language="changeLanguage"
    />
  </div>

  <div v-if="developerModeEnabled && ble.isNative.value" class="app-frame-debug-corner">
    <div v-show="appFrameDebugVisible" class="app-frame-debug-panel">
      <div class="app-frame-debug-header">
        <strong>APP TX / RX</strong>
        <ion-button size="small" fill="clear" @click="ble.clearConfigurationFrameLogs()">
          Clear
        </ion-button>
      </div>
      <div class="app-frame-debug-logs" aria-live="polite">
        <div v-for="(line, index) in ble.configurationFrameLogs.value" :key="`${index}-${line}`">
          {{ line }}
        </div>
        <div v-if="ble.configurationFrameLogs.value.length === 0" class="app-frame-debug-empty">
          No APP frames yet
        </div>
      </div>
    </div>
    <ion-button
      size="small"
      fill="solid"
      color="medium"
      class="app-frame-debug-toggle"
      :aria-expanded="appFrameDebugVisible"
      @click="appFrameDebugVisible = !appFrameDebugVisible"
    >
      {{ appFrameDebugVisible ? 'Close' : 'APP TX/RX' }}
    </ion-button>
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
  IonSpinner,
  IonText,
  onIonViewDidEnter,
  actionSheetController,
  alertController,
  toastController,
} from '@ionic/vue';
import { alertCircleOutline, checkmarkCircleOutline, chevronForwardOutline, closeOutline, downloadOutline, ellipsisVerticalOutline, eyeOffOutline, eyeOutline, lockClosed, lockOpenOutline, pushOutline, refreshOutline, saveOutline, shareSocialOutline, trashOutline } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useBle } from '@/composables/useBle';
import { useBleDebugCredentials, updateDebugDevEuiFromDeviceName } from '@/composables/useBleDebug';
import { playSensorPageTransition } from '@/utils/sensorPageTransition';
import TimeSlider from '@/components/TimeSlider.vue';
import DoubleSlider from '@/components/DoubleSlider.vue';
import CheckBox from '@/components/CheckBox.vue';
import CustomValue from '@/components/CustomValue.vue';
import CustomFrame from '@/components/CustomFrame.vue';
import DropDown from '@/components/DropDown.vue';
import PatternInput from '@/components/PatternInput.vue';
import OccurrenceInput from '@/components/OccurrenceInput.vue';
import NumInput from '@/components/NumInput.vue';
import FloatInput from '@/components/FloatInput.vue';
import SliderInput from '@/components/Slider.vue';
import TextInput from '@/components/TextInput.vue';
import SensorImage from '@/components/SensorImage.vue';
import SensorMobileNavigation from '@/components/sensor/SensorMobileNavigation.vue';
import axios from 'axios';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import { useLanguage } from '@/composables/useLanguage';
import { useDeveloperMode } from '@/composables/useDeveloperMode';
import type { LanguageCode, Translations } from '@/types/localization';
import { getProductConfigurationFile, getProductDisplayName } from '@/utils/productMeasurements';
import {
  findPatternReportingContext,
  isPatternReportingFieldVisible,
  shouldIncludePatternReportingFrame,
  type PatternReportingContext,
  type PatternReportingField,
  type PatternReportingSection,
} from '@/utils/patternReporting';
import { readAdminDeviceStatus } from '@/utils/BLE/adminStatus';
import { readFirmwareVersion } from '@/utils/BLE/deviceInformation';
import { getAppFrameStatusName } from '@/utils/BLE/appFrameResponseRules';
import {
  parseReportingConfigurations,
  type ReportingConfigurationParseResult,
  type ReportingConfigurationSectionName,
} from '@/utils/BLE/reportingConfiguration';
import type {
  ConfigurationFrameResult,
  CurrentConfigurationSendResult,
} from '@/utils/BLE/appFrames';
import { presentAuthorizationDeniedAlert } from '@/utils/authorizationAlert';
import { appVersion } from '@/utils/appVersion';
import { encodeTimeValueHex, timeValueToSeconds } from '@/utils/timeValue';
import {
  CONFIGURATION_SECTION_NAMES,
  SAVED_CONFIGURATION_FORMAT,
  SAVED_CONFIGURATION_SCHEMA_VERSION,
  captureConfigurationSections,
  configurationLoadReportCount,
  createConfigurationId,
  deleteSavedConfiguration,
  parseSavedConfiguration,
  readSavedConfigurations,
  reconcileSavedConfiguration,
  writeSavedConfiguration,
  type ConfigurationSectionName,
  type SavedConfiguration,
} from '@/utils/savedConfigurations';

// Import language files
import enUS from '/localisation/en_US.json?url';
import frFR from '/localisation/fr_FR.json?url';

onIonViewDidEnter(() => {
  playSensorPageTransition('config', '.sensor-config-content');
  void refreshConfigurationOsaStatus();
});

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
  dynamicMaxValue?: string | number;
  [property: string]: unknown;
}

interface SensorParameterGroup {
  label?: string;
  subtitle?: string;
  default_state?: string;
  mandatory?: boolean | string;
  fields?: Record<string, SensorParameter>;
  [property: string]: unknown;
}

type SensorStateConfig = Record<
  string,
  Record<string, SensorParameterGroup> | undefined
>;

const { currentLanguage, changeLanguage } = useLanguage();

const languages = ref<Record<LanguageCode, Translations>>({
  en: {},
  fr: {},
});

const { developerModeEnabled } = useDeveloperMode();
const isNativeApp = Capacitor.isNativePlatform();
const bleHideInProd = computed(() => (
  isNativeApp && !developerModeEnabled.value
));

// BLE composable (only active on native platforms, no-op on web)
const ble = useBle();

const { debugOtaAppKeyHex, debugDevEuiHex } = useBleDebugCredentials();
const configurationOsaAuthenticated = ref<boolean | null>(null);
const configurationFirmwareLongName = ref<string | null>(null);
const configurationFirmwareVersion = ref<string | null>(null);
const appFrameDebugVisible = ref(false);
let configurationFirmwareVersionPromise: Promise<void> | undefined;

async function refreshConfigurationOsaStatus(): Promise<void> {
  const deviceId = ble.connectedDevice.value?.deviceId;
  if (!ble.connected.value || !deviceId) {
    configurationOsaAuthenticated.value = null;
    configurationFirmwareLongName.value = null;
    configurationFirmwareVersion.value = null;
    return;
  }
  try {
    const status = await readAdminDeviceStatus(deviceId, line => console.debug(line));
    configurationOsaAuthenticated.value = status.osaAuthenticated;
    configurationFirmwareLongName.value = status.firmwareLongName;
    ble.setOsaAuthenticated(status.osaAuthenticated);
  } catch {
    configurationOsaAuthenticated.value = null;
    configurationFirmwareLongName.value = null;
    ble.setOsaAuthenticated(null);
  }
}

async function refreshConfigurationFirmwareVersion(): Promise<void> {
  if (configurationFirmwareVersion.value) return;
  if (configurationFirmwareVersionPromise) return configurationFirmwareVersionPromise;
  const deviceId = ble.connectedDevice.value?.deviceId;
  if (!ble.connected.value || !deviceId || configurationOsaAuthenticated.value !== true) return;

  configurationFirmwareVersionPromise = (async () => {
    try {
      const firmwareVersion = await readFirmwareVersion(
        deviceId,
        line => console.debug(line),
      );
      if (ble.connectedDevice.value?.deviceId === deviceId) {
        configurationFirmwareVersion.value = firmwareVersion;
      }
    } catch (error) {
      console.debug('Failed to read firmware version for configuration diagnostic', error);
    } finally {
      configurationFirmwareVersionPromise = undefined;
    }
  })();
  return configurationFirmwareVersionPromise;
}

watch(
  () => ble.connectedDevice.value?.name,
  deviceName => updateDebugDevEuiFromDeviceName(deviceName),
  { immediate: true }
);

watch(
  () => ble.connected.value,
  connectedNow => {
    if (connectedNow) void refreshConfigurationOsaStatus();
    else {
      configurationOsaAuthenticated.value = null;
      configurationFirmwareLongName.value = null;
      configurationFirmwareVersion.value = null;
      configurationFirmwareVersionPromise = undefined;
    }
  },
  { immediate: true }
);

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
const stateVisualPreferenceKey = computed(() => (
  ble.connectedDevice.value?.deviceId
  ?? ble.lastConnectedDevice.value?.deviceId
  ?? ble.productReference.value
  ?? (selectedSensor.value || 'default')
));
const REPORTING_CONFIGURATION_READ_PRODUCTS = new Set([
  "50-70-260-Pulse-Sens'O-Neo",
  "50-70-260-671-HygroTemp'O-Neo",
  "50-70-304-Pulse-Sens'O-Lite-Neo",
  "50-70-307-Temp'O-Neo-PT1000",
]);
const supportsReportingConfigurationRead = computed(() => (
  REPORTING_CONFIGURATION_READ_PRODUCTS.has(selectedSensor.value)
));
const pageInitialized = ref(false);
const sensorConfig = ref<any | null>(null); // Dynamic configuration for the selected sensor
const allSavedConfigurations = ref<SavedConfiguration[]>(readSavedConfigurations());
const selectedSavedConfigurationId = ref('');
const savedConfigurationFileInput = ref<HTMLInputElement | null>(null);
const savedConfigurations = computed(() => allSavedConfigurations.value.filter(configuration => (
  configuration.product.configurationFile === selectedSensor.value
)));
const selectedSavedConfiguration = computed(() => savedConfigurations.value.find(
  configuration => configuration.id === selectedSavedConfigurationId.value,
) ?? null);
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
const configurationSendMode = ref<'default' | 'current' | null>(null);
const currentConfigurationProgress = ref({ sent: 0, total: 0 });
const configurationSendSuccessMode = ref<'default' | 'current' | null>(null);
const currentConfigurationSendResult = ref<CurrentConfigurationSendResult | null>(null);
const configurationReadInProgress = ref(false);
const configurationReadResult = ref<ReportingConfigurationParseResult | null>(null);
const configurationReadHasWarnings = computed(() => {
  const result = configurationReadResult.value;
  return !!result && (
    result.unmatchedFrames.length > 0
    || result.conflicts.length > 0
    || result.exclusiveGroupConflicts.length > 0
    || result.invalidFrames.length > 0
    || result.unsupportedValues.length > 0
  );
});
let configurationSendSuccessTimer: ReturnType<typeof setTimeout> | undefined;
let configurationReadSuccessTimer: ReturnType<typeof setTimeout> | undefined;
const defaultConfigurationPreviewVisible = ref(false);
const currentConfigurationPreviewVisible = ref(false);
const defaultConfigurationPreview = ref('');
const currentConfigurationPreview = ref('');
// Production always applies the BLOB. Developer mode keeps an opt-out for diagnostics.
const activateConfigurationAfterSend = ref(true);
watch(developerModeEnabled, enabled => {
  if (!enabled) activateConfigurationAfterSend.value = true;
});
const shouldActivateConfigurationAfterSend = computed(() => (
  !developerModeEnabled.value || activateConfigurationAfterSend.value
));
const batchVisible = ref(true);
const savedConfigurationsVisible = ref(false);
const standardVisible = ref(true);
const modbusVisible = ref(true);
const configurationVisible = ref(true);
const commandeVisible = ref(true);
const generalVisible = ref(false);
const subcategoryVisible = ref<Record<string, boolean>>({});
const framesVisible = ref<Record<string, boolean>>({});
const framesCount = ref<Record<string, number>>({});
const FRAME_LONG_PRESS_DELAY_MS = 650;
let frameLongPressTimer: ReturnType<typeof setTimeout> | undefined;
let suppressSubcategoryHeaderClickUntil = 0;
const sensorConfigLoaded = ref(false); // Add a new reactive variable to track the loading state
const sensorImage = ref(''); // Reactive variable to store the sensor image path
const isEnforcingRelationships = ref(false);

const isTrueFlag = (value: unknown) => value === true || value === "true";

const getPatternReportingContext = (
  bigGroupName: string,
  groupName: string | number,
): PatternReportingContext | null => {
  const section = sensorConfig.value?.[bigGroupName] as PatternReportingSection | undefined;
  return findPatternReportingContext(section, String(groupName));
};

const isParameterVisible = (
  bigGroupName: string,
  groupName: string | number,
  paramName: string | number,
  param: SensorParameter,
): boolean => {
  if (param.hidden === 'true' || param.HMI?.visual_type === 'customFrame') return false;
  const context = getPatternReportingContext(bigGroupName, groupName);
  const fields = sensorConfig.value?.[bigGroupName]?.[groupName]?.fields as
    | Record<string, PatternReportingField>
    | undefined;
  return !context || !fields
    ? true
    : isPatternReportingFieldVisible(context, String(paramName), fields);
};

const shouldIncludeConfiguredFrame = (
  bigGroupName: string,
  frame: string,
  onlyGroupName?: string | number,
): boolean => {
  const section = sensorConfig.value?.[bigGroupName] as PatternReportingSection | undefined;
  if (!section) return true;
  const groupNames = onlyGroupName === undefined
    ? Object.keys(section)
    : [String(onlyGroupName)];

  return groupNames.every(groupName => {
    const context = findPatternReportingContext(section, groupName);
    const fields = (section[groupName] as SensorParameterGroup | undefined)?.fields as
      | Record<string, PatternReportingField>
      | undefined;
    return !context || !fields || shouldIncludePatternReportingFrame(context, frame, fields);
  });
};

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
  } else {
    const outputArea = document.getElementById("outputArea");
    if (outputArea) outputArea.innerHTML = localize("@selectToStart");
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
  selectedSavedConfigurationId.value = '';
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

const selectNativeSensor = async (productReference = ble.productReference.value) => {
  if (!ble.isNative.value || !pageInitialized.value || !productReference) return;

  const sensorFile = getProductConfigurationFile(productReference);
  if (!sensorFile) {
    console.warn(`No Easy Codec configuration found for product ${productReference}`);
    return;
  }
  if (selectedSensor.value === sensorFile && sensorConfig.value) return;

  await onSensorChange({ detail: { value: sensorFile } });
};

watch(ble.productReference, (productReference) => {
  void selectNativeSensor(productReference);
});

// Reset all checkboxes to their default states
const resetCheckboxes = () => {
  batchChecked.value = false;
  standardChecked.value = false;
  modbusChecked.value = false;
  configurationChecked.value = false;
  commandeChecked.value = false;
  generalChecked.value = true;
  currentConfigurationSendResult.value = null;
  configurationReadResult.value = null;
  if (configurationReadSuccessTimer) {
    clearTimeout(configurationReadSuccessTimer);
    configurationReadSuccessTimer = undefined;
  }

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
  if (configurationSendMode.value === null) currentConfigurationSendResult.value = null;
  
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

      if (!shouldIncludeConfiguredFrame(bigGroupName, frame)) return;

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
  if (defaultConfigurationPreviewVisible.value || currentConfigurationPreviewVisible.value) {
    refreshConfigurationPreviews();
  }
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

  if (param.type === 'timeVal') {
    if (param.HMI?.outputFormat === 'HHMM') {
      const totalMinutes = localMinutesToUtcMinutes(parseInt(value, 10));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return hours.toString(16).padStart(2, '0') + minutes.toString(16).padStart(2, '0');
    }
    if (param.isHours && /^\d+$/.test(value)) {
      value = (parseInt(value) * 60).toString();
    }
    return encodeTimeValueHex(value) ?? `-Error: ${value} is not a valid timeVal-`;
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
    if (param.type.startsWith("hex")) {
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
onMounted(async () => {
  document.addEventListener('click', handleCopyButtonClick);
  // Initialize BLE on native platforms (no-op on web)
  ble.initialize();

  await Promise.all([loadAvailableProducts(), loadLocalizationFiles()]);
  const selectToStartText = localize("@selectToStart");
  const outputArea = document.getElementById("outputArea");
  if (outputArea) {
    outputArea.innerHTML = selectToStartText;
  }

  pageInitialized.value = true;
  await selectNativeSensor();
});

// Remove the event listener when the component is unmounted
onUnmounted(() => {
  document.removeEventListener('click', handleCopyButtonClick);
  cancelFrameLongPress();
  if (configurationSendSuccessTimer) clearTimeout(configurationSendSuccessTimer);
  if (configurationReadSuccessTimer) clearTimeout(configurationReadSuccessTimer);
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

const configurationFailureResults = computed(() => (
  currentConfigurationSendResult.value?.frames.filter(result => (
    result.outcome === 'device-error'
    || result.outcome === 'timeout'
    || result.outcome === 'transport-error'
  )) ?? []
));

const formatConfigurationStatus = (status: number): string => {
  const code = status.toString(16).padStart(2, '0').toUpperCase();
  const translatedStatuses = new Set([
    '7E', '80', '81', '82', '85', '86', '87', '88', '89', '8C', '8D', '94', 'C0', 'C1', 'C2', 'C3',
  ]);
  const description = translatedStatuses.has(code)
    ? localize(`@bleConfigurationStatus${code}`)
    : localize('@bleConfigurationUnknownError');
  return `${description} (0x${code})`;
};

const describeConfigurationFrameFailure = (result: ConfigurationFrameResult): string => {
  if (result.outcome === 'timeout') return localize('@bleConfigurationNotConfirmed');
  if (result.outcome === 'transport-error') return localize('@bleConfigurationTransportError');
  if (result.status === undefined) return localize('@bleConfigurationMalformedResponse');
  return `${localize('@bleConfigurationRejected')} - ${formatConfigurationStatus(result.status)}`;
};

const getConfigurationProductName = (): string => {
  const product = availableProducts.value.find(candidate => candidate.file === selectedSensor.value);
  return getProductDisplayName(ble.productReference.value)
    || product?.name
    || ble.connectedDevice.value?.name
    || selectedSensor.value;
};

const buildCurrentConfigurationDiagnostic = (): string => {
  const result = currentConfigurationSendResult.value;
  if (!result) return '';
  const successfulFrameCount = Math.max(
    0,
    result.processed - configurationFailureResults.value.length,
  );

  const lines = [
    `Watteco Easy Codec ${appVersion}`,
    `Product: ${getConfigurationProductName()}`,
    `ProductID: ${ble.productReference.value ?? 'unknown'}`,
    `BLE device: ${ble.connectedDevice.value?.name ?? ble.connectedDevice.value?.deviceId ?? 'unknown'}`,
    `Firmware version: ${configurationFirmwareVersion.value ?? 'unknown'}`,
    `Firmware long name: ${configurationFirmwareLongName.value ?? 'unknown'}`,
    `Date: ${new Date().toISOString()}`,
    '',
    `Configuration result: ${result.state}`,
    `Processed: ${result.processed}/${result.total}`,
    `Success: ${successfulFrameCount}/${result.total}`,
  ];

  for (const failure of configurationFailureResults.value) {
    const statusCode = failure.status === undefined
      ? 'n/a'
      : `0x${failure.status.toString(16).padStart(2, '0').toUpperCase()}`;
    const statusName = failure.status === undefined
      ? null
      : getAppFrameStatusName(failure.status);
    lines.push(
      '',
      `Step: ${failure.index}/${failure.total}`,
      `Setting: ${failure.frame.label || `#${failure.index}`}`,
      `Outcome: ${failure.outcome}`,
      `Status: ${statusCode}${statusName ? ` - ${statusName}` : ''}`,
      ...(failure.errorAttributeId === undefined
        ? []
        : [`Attribute: 0x${failure.errorAttributeId.toString(16).padStart(4, '0').toUpperCase()}`]),
      `TX: ${failure.frame.hex}`,
      `RX: ${failure.responseHex ?? 'none'}`,
      ...(failure.errorMessage ? [`Error: ${failure.errorMessage}`] : []),
    );
  }

  return lines.join('\n');
};

const copyCurrentConfigurationDiagnostic = async () => {
  await refreshConfigurationFirmwareVersion();
  const diagnostic = buildCurrentConfigurationDiagnostic();
  if (!diagnostic) return;
  try {
    await navigator.clipboard.writeText(diagnostic);
    await presentSavedConfigurationToast(localize('@bleConfigurationDiagnosticCopied'));
  } catch (error) {
    console.error('Failed to copy configuration diagnostic:', error);
  }
};

// Send frames via BLE (native only)
const handleConfigurationSendResult = async (
  sentFrameCount: number,
  mode: 'default' | 'current',
) => {
  if (sentFrameCount > 0) {
    configurationOsaAuthenticated.value = true;
    configurationSendSuccessMode.value = mode;
    if (configurationSendSuccessTimer) clearTimeout(configurationSendSuccessTimer);
    configurationSendSuccessTimer = setTimeout(() => {
      configurationSendSuccessMode.value = null;
      configurationSendSuccessTimer = undefined;
    }, 5000);
  }
  if (sentFrameCount === -2) {
    configurationOsaAuthenticated.value = false;
    await presentAuthorizationDeniedAlert(localize);
  }
};

const getBlobOnlyConfigurations = (): readonly (readonly string[])[] => (
  Array.isArray(sensorConfig.value?.blob_only_configurations)
    ? sensorConfig.value.blob_only_configurations
    : []
);

const refreshConfigurationPreviews = () => {
  if (defaultConfigurationPreviewVisible.value) {
    try {
      defaultConfigurationPreview.value = ble
        .getDefaultConfigurationPreview(getBlobOnlyConfigurations())
        .join('\n');
    } catch (error: any) {
      defaultConfigurationPreview.value = error?.message ?? String(error);
    }
  }
  if (currentConfigurationPreviewVisible.value) {
    currentConfigurationPreview.value = ble.getCurrentConfigurationPreview().join('\n');
  }
};

const toggleDefaultConfigurationPreview = () => {
  defaultConfigurationPreviewVisible.value = !defaultConfigurationPreviewVisible.value;
  refreshConfigurationPreviews();
};

const toggleCurrentConfigurationPreview = () => {
  currentConfigurationPreviewVisible.value = !currentConfigurationPreviewVisible.value;
  refreshConfigurationPreviews();
};

const sendDefaultConfigurationBle = async () => {
  configurationSendSuccessMode.value = null;
  configurationSendMode.value = 'default';
  try {
    const sentFrameCount = await ble.sendOutputFrames(
      debugOtaAppKeyHex.value,
      debugDevEuiHex.value,
      shouldActivateConfigurationAfterSend.value,
      getBlobOnlyConfigurations()
    );
    await handleConfigurationSendResult(sentFrameCount, 'default');
  } finally {
    configurationSendMode.value = null;
  }
};

const sendCurrentConfigurationBle = async () => {
  configurationSendSuccessMode.value = null;
  currentConfigurationSendResult.value = null;
  currentConfigurationProgress.value = { sent: 0, total: 0 };
  configurationSendMode.value = 'current';
  if (developerModeEnabled.value) appFrameDebugVisible.value = true;
  try {
    const result = await ble.sendCurrentConfigurationFrames(
      debugOtaAppKeyHex.value,
      debugDevEuiHex.value,
      (sent, total) => { currentConfigurationProgress.value = { sent, total }; },
    );
    currentConfigurationSendResult.value = result;
    if (result.state === 'success') {
      await handleConfigurationSendResult(result.processed, 'current');
    } else if (result.state === 'authorization-denied') {
      configurationOsaAuthenticated.value = false;
      await presentAuthorizationDeniedAlert(localize);
    } else if (result.processed > 0) {
      configurationOsaAuthenticated.value = true;
    }
    if (result.processed > 0) void refreshConfigurationFirmwareVersion();
  } finally {
    configurationSendMode.value = null;
  }
};

const setReportingSectionFromSensor = (
  sectionName: ReportingConfigurationSectionName,
  matchedGroups: Set<string>,
) => {
  const section = sensorConfig.value?.[sectionName];
  if (!section) return;
  const enabled = matchedGroups.size > 0;
  if (sectionName === 'batch_params') onBatchCheckedChange({ detail: { checked: enabled } });
  else onStandardCheckedChange({ detail: { checked: enabled } });

  Object.keys(section).forEach(groupName => {
    if (groupName === 'cfg_block' || groupName === 'global_params' || groupName === 'group_relationships') return;
    if (section[groupName]?.fields) {
      setGroupEnabled(sectionName, groupName, matchedGroups.has(groupName));
    }
  });
};

const inferPatternReportingFieldValues = (result: ReportingConfigurationParseResult) => {
  result.matchedGroups.forEach(({ sectionName, groupName }) => {
    const context = getPatternReportingContext(sectionName, groupName);
    if (!context) return;

    if (result.fieldValues[context.patternFieldName] !== undefined) {
      result.fieldValues[context.controlFieldName] = 'false';
    } else if (result.fieldValues[context.controlFieldName] !== undefined) {
      result.fieldValues[context.patternFieldName] = '0 0';
    }
  });
};

const applyReportingConfigurationRead = (result: ReportingConfigurationParseResult) => {
  inferPatternReportingFieldValues(result);
  const groupsBySection: Record<ReportingConfigurationSectionName, Set<string>> = {
    batch_params: new Set<string>(),
    standard_params: new Set<string>(),
  };
  result.matchedGroups.forEach(({ sectionName, groupName }) => {
    groupsBySection[sectionName].add(groupName);
  });
  setReportingSectionFromSensor('batch_params', groupsBySection.batch_params);
  setReportingSectionFromSensor('standard_params', groupsBySection.standard_params);

  for (const sectionName of ['batch_params', 'standard_params'] as const) {
    const section = sensorConfig.value?.[sectionName];
    if (!section) continue;
    for (const [groupName, candidate] of Object.entries(section)) {
      const group = candidate as SensorParameterGroup;
      if (!group?.fields) continue;
      for (const fieldName of Object.keys(group.fields)) {
        const value = result.fieldValues[fieldName];
        if (value !== undefined) onParamChange({ newValue: value }, sectionName, groupName, fieldName);
      }
    }
  }
  updateOutput();
};

const readCurrentConfigurationBle = async () => {
  if (!sensorConfig.value || configurationReadInProgress.value) return;
  configurationReadInProgress.value = true;
  configurationReadResult.value = null;
  if (configurationReadSuccessTimer) {
    clearTimeout(configurationReadSuccessTimer);
    configurationReadSuccessTimer = undefined;
  }
  if (developerModeEnabled.value) appFrameDebugVisible.value = true;
  try {
    const readResult = await ble.readCurrentReportingConfigurations(
      debugOtaAppKeyHex.value,
      debugDevEuiHex.value,
    );
    if (readResult.state === 'authorization-denied') {
      configurationOsaAuthenticated.value = false;
      await presentAuthorizationDeniedAlert(localize);
      return;
    }
    if (readResult.state !== 'success') {
      const alert = await alertController.create({
        header: localize('@bleConfigurationReadFailed'),
        message: readResult.errorMessage || localize('@bleConfigurationReadNoResponse'),
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }
    configurationOsaAuthenticated.value = true;
    const parsed = parseReportingConfigurations(sensorConfig.value, readResult.frames);
    if (parsed.matchedFrameCount + parsed.unmatchedFrames.length > 0) {
      applyReportingConfigurationRead(parsed);
    }
    configurationReadResult.value = parsed;
    if (!configurationReadHasWarnings.value) {
      configurationReadSuccessTimer = setTimeout(() => {
        configurationReadResult.value = null;
        configurationReadSuccessTimer = undefined;
      }, 5000);
    }
  } finally {
    configurationReadInProgress.value = false;
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

const onCategoryHeaderClick = (category: string, enabled: boolean) => {
  if (!enabled) return;
  toggleVisibility(category);
};

const toggleSubcategoryVisibility = (groupName: string | number) => {
  const key = String(groupName);
  subcategoryVisible.value[key] = !subcategoryVisible.value[key];
};

const onSubcategoryHeaderClick = (groupName: string | number, group: SensorParameterGroup) => {
  if (
    Date.now() < suppressSubcategoryHeaderClickUntil
    || !paramGroupChecked.value[String(groupName)]
    || !hasUserVisibleFields(group.fields)
  ) return;

  toggleSubcategoryVisibility(groupName);
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
        ? sensorConfig.value[bigGroupName].global_params.fields[emissionParam].selectedValue
        : sensorConfig.value[bigGroupName][groupName].fields[emissionParam].selectedValue;
      const emissionSeconds = timeValueToSeconds(emissionValue);
      const originalMaximum = param.originalMaxValue ?? param.max_value;
      const originalMaximumSeconds = timeValueToSeconds(originalMaximum);
      if (emissionSeconds === null || originalMaximumSeconds === null) return;

      param.dynamicMaxValue = emissionSeconds < originalMaximumSeconds
        ? emissionValue
        : originalMaximum;

      const selectedSeconds = timeValueToSeconds(param.selectedValue);
      const maximumSeconds = Math.min(emissionSeconds, originalMaximumSeconds);
      if (selectedSeconds !== null && selectedSeconds > maximumSeconds) {
        param.selectedValue = String(param.dynamicMaxValue);
        outputVals[paramName] = convertToHexFrameValue(param.selectedValue, param);
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

      if (!shouldIncludeConfiguredFrame(bigGroupName, frame, groupKey)) return;

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

const cancelFrameLongPress = () => {
  if (frameLongPressTimer !== undefined) {
    clearTimeout(frameLongPressTimer);
    frameLongPressTimer = undefined;
  }
};

const startFrameLongPress = (groupName: string | number) => {
  if (!isNativeApp) return;

  const key = String(groupName);
  cancelFrameLongPress();

  if (!paramGroupChecked.value[key] || framesVisible.value[key]) return;

  frameLongPressTimer = setTimeout(() => {
    subcategoryVisible.value[key] = true;
    framesVisible.value[key] = true;
    suppressSubcategoryHeaderClickUntil = Date.now() + 500;
    frameLongPressTimer = undefined;
  }, FRAME_LONG_PRESS_DELAY_MS);
};

const preventNativeContextMenu = (event: Event) => {
  if (isNativeApp) event.preventDefault();
};

const frameToggleLabel = (groupName: string | number) => {
  const key = String(groupName);
  const translationKey = framesVisible.value[key]
    ? (framesCount.value[key] > 1 ? '@hideFrames' : '@hideFrame')
    : (framesCount.value[key] > 1 ? '@showFrames' : '@showFrame');

  return localize(translationKey);
};

const resetToDefault = () => {
  if (selectedSensor.value) {
    onSensorChange({ detail: { value: selectedSensor.value } });
  }
};

const getSectionEnabledState = (): Partial<Record<ConfigurationSectionName, boolean>> => ({
  general_params: generalChecked.value,
  batch_params: batchChecked.value,
  modbus_params: modbusChecked.value,
  standard_params: standardChecked.value,
  configuration_params: configurationChecked.value,
  commande_params: commandeChecked.value,
});

const presentSavedConfigurationToast = async (
  message: string,
  color: 'success' | 'danger' = 'success',
) => {
  const mobileTabs = ble.isNative.value
    ? document.getElementById('sensor-mobile-tabs') ?? undefined
    : undefined;
  const toast = await toastController.create({
    message,
    color,
    duration: 2200,
    position: 'bottom',
    ...(mobileTabs ? { positionAnchor: mobileTabs } : {}),
  });
  await toast.present();
};

const getDefaultConfigurationName = (): string => {
  const product = availableProducts.value.find(candidate => candidate.file === selectedSensor.value);
  const sensorName = getProductDisplayName(ble.productReference.value)
    || product?.name.replace(/\s*\(50-\d{2,3}[^)]*\).*$/i, '').trim()
    || ble.connectedDevice.value?.name
    || selectedSensor.value;
  const locale = currentLanguage.value === 'fr' ? 'fr-FR' : 'en-GB';
  const timestamp = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());
  return `${timestamp} - ${sensorName}`.slice(0, 80);
};

const saveCurrentConfiguration = async () => {
  if (!sensorConfig.value || !selectedSensor.value) return;
  const selectedConfiguration = allSavedConfigurations.value.find(
    configuration => configuration.id === selectedSavedConfigurationId.value,
  );
  const alert = await alertController.create({
    header: localize(selectedConfiguration ? '@updateConfigurationTitle' : '@saveConfigurationTitle'),
    inputs: [{
      name: 'name',
      type: 'text',
      value: selectedConfiguration?.name ?? getDefaultConfigurationName(),
      label: localize('@configurationName'),
      placeholder: localize('@configurationNamePlaceholder'),
      attributes: { maxlength: 80 },
    }],
    buttons: [
      { text: localize('@cancel'), role: 'cancel' },
      { text: localize('@confirm'), role: 'confirm' },
    ],
  });
  await alert.present();
  const result = await alert.onDidDismiss();
  if (result.role !== 'confirm') return;

  const name = String(result.data?.values?.name ?? '').trim();
  if (!name) return;
  const now = new Date().toISOString();
  const product = availableProducts.value.find(candidate => candidate.file === selectedSensor.value);
  const configuration: SavedConfiguration = {
    format: SAVED_CONFIGURATION_FORMAT,
    schemaVersion: SAVED_CONFIGURATION_SCHEMA_VERSION,
    id: selectedConfiguration ? selectedConfiguration.id : createConfigurationId(),
    name,
    createdAt: selectedConfiguration ? selectedConfiguration.createdAt : now,
    updatedAt: now,
    appVersion,
    product: {
      configurationFile: selectedSensor.value,
      ...(ble.productReference.value ? { reference: ble.productReference.value } : {}),
      ...(product?.name ? { displayName: product.name } : {}),
    },
    sections: captureConfigurationSections(
      sensorConfig.value,
      getSectionEnabledState(),
      paramGroupChecked.value,
    ),
  };

  try {
    allSavedConfigurations.value = writeSavedConfiguration(configuration);
    selectedSavedConfigurationId.value = configuration.id;
    await presentSavedConfigurationToast(localize('@configurationSaved'));
  } catch (error) {
    console.error('Failed to save configuration locally:', error);
    await presentSavedConfigurationToast(localize('@configurationSaveFailed'), 'danger');
  }
};

const applySectionEnabledState = (sectionName: ConfigurationSectionName, enabled: boolean) => {
  const event = { detail: { checked: enabled } };
  if (sectionName === 'general_params') onGeneralCheckedChange(event);
  else if (sectionName === 'batch_params') onBatchCheckedChange(event);
  else if (sectionName === 'modbus_params') onModbusCheckedChange(event);
  else if (sectionName === 'standard_params') onStandardCheckedChange(event);
  else if (sectionName === 'configuration_params') onConfigurationCheckedChange(event);
  else if (sectionName === 'commande_params') onCommandeCheckedChange(event);
};

const loadSelectedConfiguration = async () => {
  const saved = allSavedConfigurations.value.find(
    configuration => configuration.id === selectedSavedConfigurationId.value,
  );
  if (!saved) return;

  const savedId = saved.id;
  await onSensorChange({ detail: { value: saved.product.configurationFile } });
  if (!sensorConfig.value) return;

  const reconciled = reconcileSavedConfiguration(saved, sensorConfig.value);
  CONFIGURATION_SECTION_NAMES.forEach(sectionName => {
    const section = reconciled.sections[sectionName];
    if (section) applySectionEnabledState(sectionName, section.enabled);
  });

  CONFIGURATION_SECTION_NAMES.forEach(sectionName => {
    const section = reconciled.sections[sectionName];
    if (!section) return;
    const groups = Object.entries(section.groups);
    groups.filter(([, group]) => group.enabled).forEach(([groupName]) => {
      onParamGroupCheckedChange({ detail: { checked: true } }, groupName, sectionName);
    });
    groups.filter(([, group]) => !group.enabled).forEach(([groupName]) => {
      onParamGroupCheckedChange({ detail: { checked: false } }, groupName, sectionName);
    });
    groups.forEach(([groupName, group]) => {
      Object.entries(group.values).forEach(([fieldName, value]) => {
        onParamChange({ newValue: value }, sectionName, groupName, fieldName);
      });
    });
  });

  selectedSavedConfigurationId.value = savedId;
  updateOutput();
  await presentSavedConfigurationToast(localize('@configurationLoaded'));

  if (configurationLoadReportCount(reconciled.report) > 0) {
    const warning = await alertController.create({
      header: localize('@configurationLoadWarningTitle'),
      message: localize('@configurationLoadWarning'),
      buttons: [localize('@confirm')],
    });
    await warning.present();
  }
};

const configurationExportFilename = (configuration: SavedConfiguration): string => {
  const safeName = configuration.name
    .split('')
    .filter(character => character.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 70);
  return `${safeName || 'easy-codec-configuration'}.json`;
};

const downloadConfigurationFile = (file: File) => {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const saveConfigurationFileOnDevice = async (
  serialized: string,
  filename: string,
) => {
  if (Capacitor.getPlatform() === 'android') {
    const permission = await Filesystem.requestPermissions();
    if (permission.publicStorage !== 'granted') {
      await presentSavedConfigurationToast(
        localize('@configurationStoragePermissionDenied'),
        'danger',
      );
      return;
    }
  }

  const path = `Easy Codec/${filename}`;
  await Filesystem.writeFile({
    path,
    data: serialized,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  await presentSavedConfigurationToast(
    localize('@configurationSavedToDocuments').replace('{name}', filename),
  );
};

const shareConfigurationFile = async (
  selected: SavedConfiguration,
  serialized: string,
  filename: string,
) => {
  let nativeTemporaryFileCreated = false;

  try {
    await Filesystem.writeFile({
      path: filename,
      data: serialized,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    nativeTemporaryFileCreated = true;
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    await Share.share({
      title: selected.name,
      text: localize('@configurationShareText'),
      files: [uri],
      dialogTitle: localize('@shareConfigurationFile'),
    });
    await presentSavedConfigurationToast(
      localize('@configurationShared').replace('{name}', filename),
    );
  } finally {
    if (nativeTemporaryFileCreated) {
      try {
        await Filesystem.deleteFile({ path: filename, directory: Directory.Cache });
      } catch (error) {
        console.warn('Failed to delete temporary configuration export:', error);
      }
    }
  }
};

const exportSelectedConfiguration = async () => {
  const selected = allSavedConfigurations.value.find(
    configuration => configuration.id === selectedSavedConfigurationId.value,
  );
  if (!selected) return;

  const serialized = JSON.stringify(selected, null, 2);
  const filename = configurationExportFilename(selected);

  try {
    if (ble.isNative.value) {
      const actionSheet = await actionSheetController.create({
        header: localize('@exportConfigurationTitle'),
        buttons: [
          {
            text: localize('@saveConfigurationFileOnDevice'),
            icon: saveOutline,
            role: 'save-on-device',
          },
          {
            text: localize('@shareConfigurationFile'),
            icon: shareSocialOutline,
            role: 'share',
          },
          {
            text: localize('@cancel'),
            role: 'cancel',
          },
        ],
      });
      await actionSheet.present();
      const { role } = await actionSheet.onDidDismiss();

      if (role === 'save-on-device') {
        await saveConfigurationFileOnDevice(serialized, filename);
      } else if (role === 'share') {
        await shareConfigurationFile(selected, serialized, filename);
      }
    } else {
      const file = new File([serialized], filename, { type: 'application/json' });
      downloadConfigurationFile(file);
      await presentSavedConfigurationToast(
        localize('@configurationDownloaded').replace('{name}', filename),
      );
    }
  } catch (error) {
    console.error('Failed to export configuration:', error);
    await presentSavedConfigurationToast(localize('@configurationExportFailed'), 'danger');
  }
};

const openSavedConfigurationActions = async () => {
  const selected = selectedSavedConfiguration.value;
  if (!selected) return;

  const actionSheet = await actionSheetController.create({
    header: selected.name,
    buttons: [
      {
        text: localize('@exportConfiguration'),
        icon: pushOutline,
        data: { action: 'export' },
      },
      {
        text: localize('@deleteConfiguration'),
        icon: trashOutline,
        role: 'destructive',
        data: { action: 'delete' },
      },
      {
        text: localize('@cancel'),
        role: 'cancel',
      },
    ],
  });
  await actionSheet.present();
  const result = await actionSheet.onDidDismiss();
  if (result.data?.action === 'export') await exportSelectedConfiguration();
  else if (result.data?.action === 'delete') await confirmDeleteSelectedConfiguration();
};

const openConfigurationImport = () => {
  savedConfigurationFileInput.value?.click();
};

const presentConfigurationImportError = async (messageKey: string) => {
  const alert = await alertController.create({
    header: localize('@configurationImportFailedTitle'),
    message: localize(messageKey),
    buttons: [localize('@confirm')],
  });
  await alert.present();
};

const importConfigurationFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  try {
    if (file.size > 1_000_000) {
      await presentConfigurationImportError('@configurationImportInvalid');
      return;
    }
    const parsed = parseSavedConfiguration(await file.text());
    if (!parsed) {
      await presentConfigurationImportError('@configurationImportInvalid');
      return;
    }
    if (parsed.product.configurationFile !== selectedSensor.value) {
      await presentConfigurationImportError('@configurationImportWrongProduct');
      return;
    }

    const idAlreadyExists = allSavedConfigurations.value.some(
      configuration => configuration.id === parsed.id,
    );
    const imported: SavedConfiguration = {
      ...parsed,
      id: idAlreadyExists ? createConfigurationId() : parsed.id,
      updatedAt: new Date().toISOString(),
    };
    allSavedConfigurations.value = writeSavedConfiguration(imported);
    selectedSavedConfigurationId.value = imported.id;
    await presentSavedConfigurationToast(localize('@configurationImported'));
  } catch (error) {
    console.error('Failed to import configuration:', error);
    await presentConfigurationImportError('@configurationImportInvalid');
  }
};

const confirmDeleteSelectedConfiguration = async () => {
  const selected = allSavedConfigurations.value.find(
    configuration => configuration.id === selectedSavedConfigurationId.value,
  );
  if (!selected) return;

  const alert = await alertController.create({
    header: localize('@deleteConfigurationTitle'),
    message: localize('@deleteConfigurationMessage'),
    buttons: [
      { text: localize('@cancel'), role: 'cancel' },
      { text: localize('@deleteConfiguration'), role: 'destructive' },
    ],
  });
  await alert.present();
  const result = await alert.onDidDismiss();
  if (result.role !== 'destructive') return;

  try {
    allSavedConfigurations.value = deleteSavedConfiguration(selected.id);
    selectedSavedConfigurationId.value = '';
    await presentSavedConfigurationToast(localize('@configurationDeleted'));
  } catch (error) {
    console.error('Failed to delete local configuration:', error);
    await presentSavedConfigurationToast(localize('@configurationDeleteFailed'), 'danger');
  }
};

// Technical custom frames do not count as expandable user-facing content.
const hasUserVisibleFields = (fields?: Record<string, SensorParameter>) => {
  if (!fields) return false;
  return Object.values(fields).some(
    field => field.hidden !== 'true' && field.HMI?.visual_type !== 'customFrame',
  );
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
ion-content {
  --background: var(--ion-background-color, #fff7ee);
}

.native-with-sensor-navigation {
  --padding-top: calc(82px + env(safe-area-inset-top));
  --padding-bottom: calc(62px + env(safe-area-inset-bottom));
}

.card-holder {
  display: block;
  width: 100%;
  padding-bottom: 8px;
}

.sensor-select, .output-area {
  display: flex;
  justify-content: space-between;
  flex-direction: column;
}

.sensor-select {
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
}

#sensor-card {
  width: min(88%, 1180px);
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 20;
  margin-top: 14px;
  margin-bottom: 20px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  box-shadow: var(--app-card-shadow);
  --background: color-mix(in srgb, var(--app-surface) 97%, transparent);
  backdrop-filter: blur(12px);
}

.saved-config-menu:not(.saved-config-menu--open) > .config-item {
  border-bottom-color: transparent;
}

.saved-config-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 8px;
  border-radius: 999px;
  color: var(--ion-color-primary-shade);
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  font-size: 0.78rem;
  font-weight: 750;
}

.saved-config-panel {
  display: block;
  padding: 14px 16px 16px 20px;
  background: var(--app-surface-subtle);
}

.saved-config-picker {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(240px, auto);
  align-items: end;
  gap: 8px 14px;
}

.saved-config-select {
  width: 100%;
  min-width: 0;
  --border-color: var(--app-border-strong);
  --highlight-color-focused: var(--ion-color-primary);
}

.saved-config-empty {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.saved-config-action--load {
  min-width: 0;
  margin: 0;
  font-weight: 750;
}

.saved-config-action--load::part(native) {
  padding-inline: 18px;
}

.saved-config-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--app-border);
}

.saved-config-action--more {
  flex: 0 0 auto;
}

.saved-config-file-input {
  display: none;
}

@media (max-width: 760px) {
  .saved-config-panel {
    padding: 12px 14px 14px;
  }

  .saved-config-picker {
    grid-template-columns: 1fr;
  }

  .saved-config-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "save save"
      "import more";
    gap: 6px;
  }

  .saved-config-actions ion-button {
    width: 100%;
    margin: 0;
  }

  .saved-config-action--save { grid-area: save; }
  .saved-config-action--import { grid-area: import; }
  .saved-config-action--more { grid-area: more; }
}

#sensor-card ion-select {
  width: min(100%, 720px);
  min-height: 48px;
  padding-inline: 14px;
  border: 1px solid var(--app-border-strong);
  border-radius: 10px;
  background: var(--app-surface-subtle);
  font-weight: 650;
  --highlight-color-focused: var(--ion-color-primary);
  --highlight-color-valid: var(--ion-color-primary);
}

@media (min-width: 601px) {
  #sensor-card .sensor-select {
    align-items: stretch;
    padding: 7px 18px;
  }

  #sensor-card ion-select {
    width: 100%;
    padding-inline: 14px;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
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
  --background: var(--app-surface);
  --color: var(--app-text);
  border-radius: 14px;
}

ion-card-content {
  font-size: 1rem;
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
  width: min(88%, 1180px);
}

.category-card {
  margin-top: 18px;
  margin-bottom: 18px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  box-shadow: var(--app-card-shadow);
  --background: var(--app-surface);
}

.category-card > .config-item {
  margin: 0;
  min-height: 64px;
  padding: 6px 12px 6px 2px;
  color: var(--app-text);
  border-left: 5px solid var(--ion-color-primary);
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface);
  --background: var(--app-surface);
  --padding-start: 0;
  --inner-padding-end: 0;
  --min-height: 64px;
}

.category-card > .config-item ion-label {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.subcategory-card {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  box-shadow: none;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  --background: var(--app-surface);
}

.subcategory-card > .config-item {
  margin: 0;
  min-height: 52px;
  padding: 2px 12px 2px 0;
  color: var(--app-text);
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface);
  --background: var(--app-surface);
  --padding-start: 0;
  --inner-padding-end: 0;
  --min-height: 52px;
}

.collapsible-header {
  display: flex;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
}

.collapsible-header--disabled {
  cursor: default;
}

.collapsible-header > ion-label {
  flex: 1;
  min-width: 0;
}

.header-toggle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  align-self: center;
  height: 32px;
  margin-left: auto;
}

.header-toggle ion-toggle {
  margin: 0;
  --track-background: rgba(var(--ion-color-primary-rgb), 0.22);
  --track-background-checked: var(--ion-color-primary);
  --handle-background: #fff;
  --handle-background-checked: #fff;
}

.subcategory-card > .config-item ion-label {
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.25;
}

.group-title,
.group-subtitle {
  display: block;
}

.group-subtitle {
  margin-top: 2px;
  color: var(--ion-color-medium);
  font-size: 0.78rem;
  font-weight: 400;
  line-height: 1.25;
}

.subcategory-card-holder {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 8px;
  width: 100%;
  padding: 12px 12px 14px 20px;
  background: var(--app-surface-subtle);
}

.category-card > .config-item .visibility-button ion-icon {
  font-size: 1.15rem;
}

.subcategory-card > .config-item .visibility-button ion-icon {
  font-size: 0.9rem;
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
  margin: 0;
  padding: 0 12px;
  list-style: none;
  background: var(--app-surface);
}

.config-card {
  margin: 0;
  border: 0;
  border-bottom: 1px solid var(--app-border);
  border-radius: 0;
  box-shadow: none;
  --background: var(--app-surface);
}

.config-card:last-child {
  border-bottom: 0;
}

.config-card > .config-item,
.global-batch-settings > .config-item {
  width: auto;
  margin: 0;
  padding: 12px 14px;
  color: var(--app-text);
  --background: transparent;
  --min-height: 48px;
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
  color: var(--app-text);
}

#outputTitle {
  margin-bottom: 10px;
}

#outputArea {
  overflow-wrap: anywhere;
  font-size: 0.78rem;
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
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  margin: 0 4px 0 0;
  --background: transparent;
  --background-hover: rgba(var(--ion-color-primary-rgb), 0.1);
  --background-activated: rgba(var(--ion-color-primary-rgb), 0.14);
  --box-shadow: none;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
  --border-radius: 50%;
  --color: var(--ion-color-primary);
}

.visibility-button ion-icon {
  font-size: 1rem;
  transition: transform 180ms ease;
}

.visibility-button ion-icon.chevron-expanded {
  transform: rotate(90deg);
}

.visibility-button.invisible {
  visibility: hidden;
}

.showFrameButton {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--app-border);
  background: var(--app-surface);
}

.native-frame-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  padding: 5px 8px 7px;
}

.frame-long-press-target {
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.frame-icon-button {
  width: 40px;
  height: 40px;
  margin: 0;
  --background: rgba(var(--ion-color-primary-rgb), 0.1);
  --background-hover: rgba(var(--ion-color-primary-rgb), 0.18);
  --border-radius: 50%;
  --box-shadow: none;
  --color: var(--ion-color-primary);
  --padding-start: 0;
  --padding-end: 0;
}

.frame-icon-button ion-icon {
  font-size: 1.2rem;
}

.frames-output {
  flex-basis: 100%;
  min-width: 0;
}

/* Add responsive styles for smartphones */
@media (max-width: 600px) {
  .card-holder {
    padding-inline: 0;
  }

  .sensor-select {
    gap: 8px;
    padding: 9px 10px;
  }

  .category-card, .sensor-card, .outputCard, #sensor-card {
    width: calc(100% - 16px);
  }

  #sensor-card {
    top: 0;
    margin-top: 8px;
    margin-bottom: 18px;
    border-radius: 12px;
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
    min-width: 0;
  }

  ion-chip {
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
    gap: 8px;
    padding: 10px 8px 12px 14px;
  }

  .category-card {
    margin-top: 10px;
    margin-bottom: 10px;
    border-radius: 12px;
  }

  .category-card > .config-item {
    padding-left: 2px;
  }

  .category-card > .config-item ion-label {
    font-size: 0.95rem;
  }

  .config-card > .config-item,
  .global-batch-settings > .config-item {
    padding: 13px 10px;
  }

  ul {
    padding: 0 10px;
  }

  .reset-button {
    width: 38px;
    min-height: 38px;
    margin-inline: 4px;
    --padding-start: 0;
    --padding-end: 0;
    --border-radius: 50%;
  }

  .reset-button ion-icon {
    margin: 0;
    font-size: 1.1rem;
  }

  .reset-button-label {
    display: none;
  }
}

.small-button {
  min-height: 32px;
  --padding-start: 10px;
  --padding-end: 10px;
  --padding-top: 5px;
  --padding-bottom: 5px;
  --border-radius: 9px;
  font-size: 0.72rem;
  font-weight: 650;
  text-transform: none;
}

.reset-button ion-icon {
  font-size: 1rem;
}

.button-group {
  display: flex;
  gap: 10px;
}

.half-width {
  flex: 1;
}

.outputCard {
  margin-top: 16px;
  margin-bottom: 24px;
  border: 1px solid rgba(91, 80, 68, 0.12);
  box-shadow: 0 8px 24px rgba(74, 51, 31, 0.08);
}

.output-area {
  gap: 10px;
  margin: 0;
  padding: 18px;
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

.ble-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: flex-start;
}

.ble-read-configuration {
  margin: 0 0 10px;
}

.ble-action {
  flex: 1 1 240px;
}

.ble-send-button-wrap {
  position: relative;
}

.ble-send-button-fill {
  position: absolute;
  inset: 2px auto 2px 2px;
  max-width: calc(100% - 4px);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.16);
  pointer-events: none;
  transition: width 350ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .ble-send-button-fill {
    transition: none;
  }
}

.ble-preview-toggle {
  min-height: 28px;
  margin: 4px 0 0;
  font-size: 0.72rem;
}

.ble-payload-preview {
  width: 100%;
  max-height: 240px;
  margin: 4px 0 0;
  padding: 10px;
  overflow: auto;
  box-sizing: border-box;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface-subtle);
  color: var(--app-text);
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.72rem;
  line-height: 1.35;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  user-select: text;
}

.ble-status-msg {
  margin-top: 6px;
  font-size: 0.85em;
}

.ble-send-success {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--ion-color-success-rgb), 0.35);
  border-radius: 10px;
  background: rgba(var(--ion-color-success-rgb), 0.1);
  color: var(--ion-color-success-shade);
  font-weight: 600;
}

.ble-send-success ion-icon {
  flex: 0 0 auto;
  font-size: 1.35rem;
}

.ble-send-warning {
  margin-top: 10px;
  padding: 12px;
  border: 1px solid rgba(var(--ion-color-warning-rgb), 0.5);
  border-radius: 10px;
  background: rgba(var(--ion-color-warning-rgb), 0.12);
  color: var(--app-text);
}

.ble-send-warning-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ion-color-warning-shade);
}

.ble-send-warning-title ion-icon {
  flex: 0 0 auto;
  font-size: 1.35rem;
}

.ble-send-warning p {
  margin: 8px 0;
  line-height: 1.4;
}

.ble-send-failures {
  display: grid;
  gap: 8px;
  margin: 8px 0;
  padding: 0;
  background: transparent;
  list-style: none;
}

.ble-send-failures li {
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(var(--ion-color-warning-rgb), 0.1);
}

.ble-send-failures span {
  font-size: 0.84rem;
  line-height: 1.35;
}

.ble-reporting-diagnostics {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(var(--ion-color-warning-rgb), 0.35);
}

.ble-reporting-diagnostics > ul {
  display: grid;
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.ble-reporting-diagnostics li {
  display: grid;
  gap: 4px;
}

.ble-reporting-diagnostics code {
  font-size: 0.72rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
  user-select: text;
}

.ble-reporting-diagnostics span {
  font-size: 0.82rem;
  line-height: 1.35;
}

.ble-activation-option {
  margin-top: 6px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  --size: 20px;
}

.ble-activation-option::part(container) {
  flex-shrink: 0;
}

.ble-activation-option::part(label) {
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.3;
}

.app-frame-debug-corner {
  position: fixed;
  right: 12px;
  bottom: calc(74px + env(safe-area-inset-bottom));
  z-index: 1100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.app-frame-debug-panel {
  width: min(360px, calc(100vw - 24px));
  max-height: 34vh;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-surface);
  color: var(--app-text);
  box-shadow: 0 8px 24px rgba(28, 35, 45, 0.24);
}

.app-frame-debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 4px 12px;
  border-bottom: 1px solid var(--app-border);
}

.app-frame-debug-logs {
  max-height: 26vh;
  padding: 8px 10px;
  overflow: auto;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.7rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
  user-select: text;
}

.app-frame-debug-empty {
  color: var(--app-text-muted);
  font-style: italic;
}

.app-frame-debug-toggle {
  margin: 0;
  font-size: 0.68rem;
}
</style>

<style>
.frame {
  font-family: 'Courier New', Courier, monospace;
  font-weight: bold;
  user-select: text; /* Ensure the frame part is selectable */
}

.frameArea {
  color: var(--app-text);
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
