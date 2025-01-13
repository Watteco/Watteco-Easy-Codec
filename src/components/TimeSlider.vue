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

// Emit changes back to parent component
const emit = defineEmits(['update:value']);

// Handle changes in the ion-range (slider)
const onRangeChange = (event) => {
  let newValue = event.detail.value;
  if (newValue > props.max) {
    newValue = props.max;
  }
  emit('update:value', { newValue, groupName: props.groupName, paramName: props.paramName });
};

// Computed property to calculate time in "hours and minutes"
const valueHours = computed(() => {
  const hours = Math.floor((props.value) / 60);
  const minutes = props.value % 60;

  let result = '';
  result += `${hours}h`;
  if (minutes > 0) {
    result += `${minutes < 10 ? '0' : ''}${minutes}`;
  }
  
  return result.trim();
});

// Watch for changes in max value and adjust the slider value if necessary
watch(() => props.max, (newMax) => {
  if (props.value > newMax) {
    emit('update:value', { newValue: newMax, groupName: props.groupName, paramName: props.paramName });
  }
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
  width: 90px;
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
