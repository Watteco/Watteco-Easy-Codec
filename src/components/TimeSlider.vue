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
  const newValue = event.detail.value;
  emit('update:value', { newValue, groupName: props.groupName, paramName: props.paramName });
};

// Computed property to calculate time in "hours and minutes"
const valueHours = computed(() => {
  const days = Math.floor(props.value / 1440);
  const hours = Math.floor((props.value % 1440) / 60);
  const minutes = props.value % 60;

  let result = '';
  if (days > 0) result += `${days}d `;
  if (hours > 0) result += `${hours}h`;
  if (minutes > 0) {
    result += `${hours > 0 && minutes < 10 ? '0' : ''}${minutes}${hours > 0 ? '' : 'm'}`;
  }
  
  return result.trim();
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
