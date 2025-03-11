<template>
  <ion-label position="stacked">{{ localize(label) }}</ion-label>
  <div class="separator"></div>
  
  <ion-input
    inputmode="decimal"
    :value="displayValue"
    :min="currentMin"
    :max="currentMax"
    @ionInput="onInputChange"
    :class="{ 'invalid-input': isInvalid }"
  ></ion-input>
  <div v-if="isInvalid" class="error-message">
    {{ errorMessage }}
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';

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

const onInputChange = (event) => {
  const newValue = event.detail.value;
  if (newValue === '') return;
  
  // Handle decimal input with localization (comma or period)
  const sanitizedValue = newValue.replace(',', '.');
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
      } else {
        errorMessage.value = `Value should not exceed ${currentMax.value}`;
      }
    }
  }
};

watch(() => props.value, (newValue) => {
  if (newValue) {
    const parsedValue = parseFloat(newValue);
    if (!isNaN(parsedValue)) {
      currentValue.value = parsedValue;
      validateCurrentValue();
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

ion-input {
  --padding-start: 10px;
  --padding-end: 10px;
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

@media (max-width: 600px) {
  ion-label {
    font-size: 0.9rem;
  }
}
</style>