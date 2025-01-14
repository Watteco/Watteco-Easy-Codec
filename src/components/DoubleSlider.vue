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
    dual-knobs="true"
    @ionChange="onRangeChange"
  ></ion-range>
  <div class="separator"></div>
  <ion-chip>{{ unit }}</ion-chip>
</template>

<script setup>
// Props to pass values from parent component
const props = defineProps({
  label: String,
  unit: String,
  min: Number,
  max: Number,
  value: Number,
  step: Number,
  groupName: String,   // new prop for groupName
  paramName: String    // new prop for paramName
});

// Emit changes back to parent component
const emit = defineEmits(['update:value']);

// Handle changes in the ion-range (slider)
const onRangeChange = (event) => {
  const detail = event.detail;
  emit('update:value', { detail, groupName: props.groupName, paramName: props.paramName });
};
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
  width: 100%;
  height: 100%;
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
