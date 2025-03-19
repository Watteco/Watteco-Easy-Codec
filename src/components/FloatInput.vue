<template>
  <ion-label position="stacked">{{ localize(label) }}</ion-label>
  
  <div class="slider-container">
    <ion-range
      class="float-range"
      :min="currentMin"
      :max="currentMax"
      :step="step"
      :value="currentValue"
      pin="false"
      snaps="true"
      color="primary"
      @ionChange="onRangeChange"
      @ionInput="onRangeInput"
    ></ion-range>

    <ion-chip class="float-chip" v-if="!isEditing" @click="startEditing">
      {{ displayValue }}
    </ion-chip>

    <ion-input
      v-else
      class="float-input"
      v-model="inputValue"
      inputmode="decimal"
      @ionBlur="finishEditing"
      @keyup.enter="finishEditing"
      @ionInput="onInputChange"
      ref="floatInputRef"
      :class="{ 'invalid-input': isInvalid }"
    ></ion-input>
  </div>
  
  <div v-if="isInvalid" class="error-message">
    {{ errorMessage }}
  </div>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue';

const props = defineProps({
  label: String,
  value: String,
  min: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 100
  },
  step: {
    type: Number,
    default: 0.01
  },
  precision: {
    type: Number,
    default: 2
  },
  groupName: String,
  paramName: String,
  localize: {
    type: Function,
    required: true
  }
});

const currentValue = ref(parseFloat(props.value) || 0);
const isInvalid = ref(false);
const errorMessage = ref('');
const currentMin = ref(props.min);
const currentMax = ref(props.max);
const isEditing = ref(false);
const inputValue = ref('');
const floatInputRef = ref(null);
const emit = defineEmits(['update:value']);

// Format the display value with the correct number of decimal places
const displayValue = computed(() => {
  return currentValue.value.toFixed(props.precision);
});

// Watch for min/max props changes
watch(() => props.min, (newMin) => {
  currentMin.value = newMin;
  validateCurrentValue();
});

watch(() => props.max, (newMax) => {
  currentMax.value = newMax;
  validateCurrentValue();
});

// Validate current value against new constraints
const validateCurrentValue = () => {
  if (currentValue.value < currentMin.value) {
    isInvalid.value = true;
    errorMessage.value = `Value should be at least ${currentMin.value}`;
    // Auto-adjust to minimum value
    currentValue.value = currentMin.value;
    emit('update:value', { 
      newValue: currentValue.value.toString(),
      groupName: props.groupName, 
      paramName: props.paramName 
    });
  } else if (currentValue.value > currentMax.value) {
    isInvalid.value = true;
    errorMessage.value = `Value should not exceed ${currentMax.value}`;
    // Auto-adjust to maximum value
    currentValue.value = currentMax.value;
    emit('update:value', { 
      newValue: currentValue.value.toString(),
      groupName: props.groupName, 
      paramName: props.paramName 
    });
  } else {
    isInvalid.value = false;
    errorMessage.value = '';
  }
};

const onRangeChange = (event) => {
  let newValue = parseFloat(event.detail.value);
  
  // Ensure the value is properly rounded to respect precision
  newValue = parseFloat(newValue.toFixed(props.precision));
  
  currentValue.value = newValue;
  emit('update:value', { 
    newValue: newValue.toString(), 
    groupName: props.groupName, 
    paramName: props.paramName 
  });
};

const onRangeInput = (event) => {
  let newValue = parseFloat(event.detail.value);
  
  // Ensure the value is properly rounded to respect precision
  newValue = parseFloat(newValue.toFixed(props.precision));
  
  currentValue.value = newValue;
};

const startEditing = async () => {
  inputValue.value = displayValue.value;
  isEditing.value = true;
  
  await nextTick();
  
  setTimeout(() => {
    if (floatInputRef.value) {
      if (typeof floatInputRef.value.setFocus === 'function') {
        floatInputRef.value.setFocus();
      } else {
        const nativeInput = floatInputRef.value.$el.querySelector('input');
        if (nativeInput) {
          nativeInput.focus();
          nativeInput.select();
        }
      }
    }
  }, 50);
};

const onInputChange = (event) => {
  if (event.target && event.target.value !== undefined) {
    inputValue.value = event.target.value;
  }
};

const finishEditing = () => {
  if (!inputValue.value) {
    inputValue.value = displayValue.value;
    isEditing.value = false;
    return;
  }
  
  // Handle decimal input with localization (comma or period)
  const sanitizedValue = inputValue.value.toString().replace(',', '.');
  const floatValue = parseFloat(sanitizedValue);
  
  if (!isNaN(floatValue)) {
    // Round to the specified precision
    const roundedValue = parseFloat(floatValue.toFixed(props.precision));
    
    // Check if the value is within range
    if (roundedValue >= currentMin.value && roundedValue <= currentMax.value) {
      currentValue.value = roundedValue;
      isInvalid.value = false;
      errorMessage.value = '';
      emit('update:value', { 
        newValue: roundedValue.toString(), 
        groupName: props.groupName, 
        paramName: props.paramName 
      });
    } else {
      isInvalid.value = true;
      if (roundedValue < currentMin.value) {
        errorMessage.value = `Value should be at least ${currentMin.value}`;
        currentValue.value = currentMin.value;
      } else {
        errorMessage.value = `Value should not exceed ${currentMax.value}`;
        currentValue.value = currentMax.value;
      }
      emit('update:value', { 
        newValue: currentValue.value.toString(), 
        groupName: props.groupName, 
        paramName: props.paramName 
      });
    }
  }
  
  setTimeout(() => {
    isEditing.value = false;
  }, 100);
};

watch(() => props.value, (newValue) => {
  if (newValue) {
    const parsedValue = parseFloat(newValue);
    if (!isNaN(parsedValue)) {
      currentValue.value = parsedValue;
      validateCurrentValue();
      if (!isEditing.value) {
        inputValue.value = displayValue.value;
      }
    }
  }
});
</script>

<style scoped>
.separator {
  flex: 0.3 1 0px;
  width: 1%;
  height: 100%;
}

.slider-container {
  display: flex;
  align-items: center;
  width: 100%;
  margin-top: 4px;
}

.float-range {
  flex: 1;
  --padding-end: 12px;
}

.float-chip, .float-input {
  --background: var(--ion-color-primary);
  --color: white;
  width: 90px;
  justify-content: space-around;
  border-radius: 10px;
  --border-radius: 10px;
  margin: 4px;
  flex-shrink: 0;
}

.float-input {
  --padding-end: 12px;
  --padding-start: 12px;
  text-align: center;
  font-family: inherit;
  font-size: inherit;
  min-height: unset;
  height: 32px;
  --highlight-color-focused: white;
}

.float-input::part(input) {
  text-align: center;
  padding: 0;
  margin: 0;
}

.invalid-input {
  --border-color: var(--ion-color-danger);
  --highlight-color-valid: var(--ion-color-danger);
}

.error-message {
  color: var(--ion-color-danger);
  font-size: 0.8rem;
  margin: 4px 0;
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

@media (max-width: 600px) {
  .float-chip, .float-input {
    width: 80px;
    font-size: 0.8rem;
  }

  ion-label {
    font-size: 0.9rem;
  }
}
</style>