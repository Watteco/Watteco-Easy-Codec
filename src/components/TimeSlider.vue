<template>
  <ion-label>{{ label }}</ion-label>

  <!-- Slider (ion-range) -->
  <ion-range
    :min="min"
    :max="max"
    :value="value"
    :step="step"
    pin="true"
    snaps="true"
    color="primary"
    @ionChange="onRangeChange"
  ></ion-range>

  <!-- Toggle to switch between minutes and hours -->
  <ion-toggle
    label-placement="end"
    @ionChange="onToggleChange"
  ></ion-toggle>

  <!-- Display unit based on toggle state -->
  <ion-chip v-if="!isHours">Minutes</ion-chip>
  <ion-chip v-if="isHours">Heures</ion-chip>
</template>

<script setup>
import { ref } from 'vue';

// Props to pass values from parent component
const props = defineProps({
  label: String,
  min: Number,
  max: Number,
  value: Number,
  step: Number,
  groupName: String,   // new prop for groupName
  paramName: String    // new prop for paramName
});

// Local state to manage hours/minutes toggle
const isHours = ref(false);

// Emit changes back to parent component
const emit = defineEmits(['update:value', 'update:units']);

// Handle changes in the ion-range (slider)
const onRangeChange = (event) => {
  const newValue = event.detail.value;
  emit('update:value', { newValue, groupName: props.groupName, paramName: props.paramName });
};

// Handle toggle switch change
const onToggleChange = (event) => {
  isHours.value = event.detail.checked;
  emit('update:units', { isHours: isHours.value, groupName: props.groupName, paramName: props.paramName });
};
</script>

<style scoped>
.config-item {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
}

ion-toggle {
  --track-background: var(--ion-color-tertiary);
  --track-background-checked: var(--ion-color-tertiary);

  --handle-background: var(--ion-color-primary);
  --handle-background-checked: var(--ion-color-primary);
}

ion-item {
  --background: var(--ion-color-medium-tint);
  border-radius: 15px;
}

ion-chip {
  --background: var(--ion-color-primary);
  --color: white;
  width: 75px;
  justify-content: space-around;
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
