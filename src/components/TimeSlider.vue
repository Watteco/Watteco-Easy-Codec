<template>
  <ion-label position="stacked">{{ label }}</ion-label>

  <!-- Slider (ion-range) -->
  <ion-range
    :min="min"
    :max="max"
    :value="currentValue"
    :step="step"
    pin="false"
    snaps="true"
    color="primary"
    @ionChange="onRangeChange"
    @ionInput="onRangeInput"
  ></ion-range>

  <div class="separator"></div>

  <!-- Display value in hours and minutes -->
  <ion-chip>{{ valueHours }}</ion-chip>
</template>

<script setup>
import { ref, watch, computed } from 'vue';

// Props
const props = defineProps({
  label: String,
  min: Number,
  max: Number,
  value: Number,
  step: Number,
  groupName: String,
  paramName: String,
});

// Reactive variable to store the current value of the slider
const currentValue = ref(props.value);

// Emit changes back to parent component
const emit = defineEmits(['update:value']);

// Handle changes in the ion-range (slider)
const onRangeChange = (event) => {
  let newValue = event.detail.value;

  // Snap the value to the nearest step
  const snappedValue = Math.max(
    props.min,
    Math.round(newValue / props.step) * props.step
  );

  // Ensure it does not exceed the max
  if (snappedValue > props.max) {
    newValue = props.max;
  } else {
    newValue = snappedValue;
  }

  currentValue.value = newValue;
  emit('update:value', { newValue, groupName: props.groupName, paramName: props.paramName });
};

// Handle input in the ion-range (slider) to update the chip while moving
const onRangeInput = (event) => {
  let newValue = event.detail.value;

  // Snap the value to the nearest step
  const snappedValue = Math.max(
    props.min,
    Math.round(newValue / props.step) * props.step
  );

  // Ensure it does not exceed the max
  if (snappedValue > props.max) {
    newValue = props.max;
  } else {
    newValue = snappedValue;
  }

  currentValue.value = newValue;
};

// Computed property to calculate time in "hours and minutes"
const valueHours = computed(() => {
  let validValue = currentValue.value || props.value;

  if (props.min === props.max) {
    validValue = props.min;
  }

  const hours = Math.floor((validValue) / 60);
  const minutes = validValue % 60;

  const result = `${hours}h${minutes < 10 ? '0' : ''}${minutes}`;

  return result.trim();
});

// Watch for changes in max value and adjust the slider value if necessary
watch(() => props.max, (newMax) => {
  if (currentValue.value > newMax) {
    currentValue.value = newMax;
    emit('update:value', { newValue: newMax, groupName: props.groupName, paramName: props.paramName });
  }
});

// Watch for changes in the initial value prop and update the current value
watch(() => props.value, (newValue) => {
  currentValue.value = newValue;
});
</script>

<style scoped>
.config-item {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
}

.separator {
  flex: 0.3 1 0px;
  width: 1%;
  height: 100%;
}

ion-chip {
  --background: var(--ion-color-primary);
  --color: white;
  width: 90px;
  justify-content: space-around;
  border-radius: 10px;
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

/* Add responsive styles for smartphones */
@media (max-width: 600px) {
  ion-chip {
    width: 70px;
    font-size: 0.8rem;
  }

  ion-label {
    font-size: 0.9rem;
  }
}
</style>
