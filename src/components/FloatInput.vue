<template>
  <ion-label position="stacked">{{ localize(label) }}</ion-label>
  <div class="separator"></div>
  
  <ion-input
    inputmode="decimal"
    :value="displayValue"
    :min="min"
    :max="max"
    @ionInput="onInputChange"
  ></ion-input>
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
const emit = defineEmits(['update:value']);

// Format the display value with the correct number of decimal places
const displayValue = computed(() => {
  return currentValue.value.toFixed(props.precision);
});

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
    if (roundedValue >= props.min && roundedValue <= props.max) {
      currentValue.value = roundedValue;
      emit('update:value', { 
        newValue: roundedValue.toString(), 
        groupName: props.groupName, 
        paramName: props.paramName 
      });
    }
  }
};

watch(() => props.value, (newValue) => {
  if (newValue) {
    const parsedValue = parseFloat(newValue);
    if (!isNaN(parsedValue)) {
      currentValue.value = parsedValue;
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

@media (max-width: 600px) {
  ion-label {
    font-size: 0.9rem;
  }
}
</style>
