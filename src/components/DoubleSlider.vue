<template>
  <ion-label position="stacked">{{ label }}</ion-label>

  <div class="slider-container">
    <!-- Slider (ion-range) -->
    <ion-range
      class="range-slider"
      :min="min"
      :max="max"
      :value="value"
      :step="step"
      pin="true"
      snaps="true"
      :ticks="showTicks"
      dual-knobs="true"
      @ionChange="onRangeChange"
    ></ion-range>
    
    <ion-chip>{{ unit }}</ion-chip>
  </div>
</template>

<script setup>
import { useRangeTicks } from '@/composables/useRangeTicks';

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
const showTicks = useRangeTicks(
  () => props.min,
  () => props.max,
  () => props.step,
);

// Handle changes in the ion-range (slider)
const onRangeChange = (event) => {
  const detail = event.detail;
  emit('update:value', { detail, groupName: props.groupName, paramName: props.paramName });
};
</script>

<style scoped>
.slider-container {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 6px;
}

.range-slider {
  flex: 1;
  min-width: 0;
  --bar-height: 5px;
  --bar-border-radius: 999px;
  --bar-background: rgba(var(--ion-color-primary-rgb), 0.2);
  --bar-background-active: var(--ion-color-primary);
  --knob-background: var(--ion-color-primary);
  --knob-size: 28px;
  --padding-start: 4px;
  --padding-end: 4px;
}

.separator {
  flex: 0.3 1 0px;
  width: 100%;
  height: 100%;
}

ion-chip {
  --background: var(--ion-color-primary);
  --color: white;
  min-width: 70px;
  justify-content: center;
  border-radius: 999px;
  flex-shrink: 0;
  margin: 0;
  font-weight: 700;
  box-shadow: 0 3px 9px rgba(var(--ion-color-primary-rgb), 0.22);
}

ion-range::part(pin) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0 5px;
  color: #fff;
  border-radius: 999px;
  transform: translate3d(0, 14px, 0) scale(1.01);
  min-width: 30px;
  height: 30px;
  font-size: 0.72rem;
  font-weight: 700;
  transition: transform 120ms ease, background 120ms ease;
  z-index: 10;
}

ion-range.range-pressed::part(pin) {
  transform: translate3d(0, -16px, 0) scale(1.01);
  box-shadow: 0 3px 9px rgba(var(--ion-color-primary-rgb), 0.24);
}

ion-range::part(pin)::before {
  content: none;
}

/* Add responsive styles for smartphones */
@media (max-width: 600px) {
  ion-chip {
    min-width: 60px;
    font-size: 0.8rem;
  }

  ion-label {
    font-size: 0.9rem;
  }
}
</style>
