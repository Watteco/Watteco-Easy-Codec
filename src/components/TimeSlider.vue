<template>
  <ion-label position="stacked">{{ label }}</ion-label>

  <div class="slider-container">
    <ion-range
      class="time-range"
      :min="min"
      :max="max"
      :value="currentValue"
      :step="step"
      pin="false"
      snaps="true"
      :ticks="showTicks"
      @ionChange="onRangeChange"
      @ionInput="onRangeInput"
    ></ion-range>

    <ion-chip class="time-chip" v-if="!isEditing" @click="startEditing">
      {{ displayValue }}
    </ion-chip>

    <ion-input
      v-else
      class="time-input"
      v-model="timeInputValue"
      :placeholder="props.outputFormat === 'HHMM' ? 'HHMM' : '0h00'"
      @ionBlur="finishEditing"
      @keyup.enter="finishEditing"
      @ionInput="onInputChange"
      ref="timeInputRef"
      inputmode="text"
    ></ion-input>
  </div>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue';
import { IonIcon } from '@ionic/vue';
import { useRangeTicks } from '@/composables/useRangeTicks';

// Props
const props = defineProps({
  label: String,
  min: Number,
  max: Number,
  value: Number,
  step: Number,
  groupName: String,
  paramName: String,
  outputFormat: {
    type: String,
    default: ''
  }
});

const currentValue = ref(Number(props.value) || 0);
const timeInputValue = ref(formatMinutesToTimeString(Number(props.value) || 0));
const isEditing = ref(false);
const timeInputRef = ref(null);
const showTicks = useRangeTicks(
  () => props.min,
  () => props.max,
  () => props.step,
);

const emit = defineEmits(['update:value']);

const valueHours = computed(() => {
  let validValue = Number(currentValue.value) || Number(props.value) || 0;

  if (props.min === props.max) {
    validValue = props.min;
  }

  return formatMinutesToTimeString(validValue);
});

const displayValue = computed(() => {
  if (props.outputFormat === 'HHMM') {
    return formatMinutesToTwoByteHHMM(Number(currentValue.value) || 0);
  }
  return valueHours.value;
});

const onRangeChange = (event) => {
  let newValue = event.detail.value;

  const snappedValue = Math.max(
    props.min,
    Math.round(newValue / props.step) * props.step
  );

  if (snappedValue > props.max) {
    newValue = props.max;
  } else {
    newValue = snappedValue;
  }

  currentValue.value = newValue;
  emit('update:value', { newValue, groupName: props.groupName, paramName: props.paramName });
};

const onRangeInput = (event) => {
  let newValue = event.detail.value;

  const snappedValue = Math.max(
    props.min,
    Math.round(newValue / props.step) * props.step
  );

  if (snappedValue > props.max) {
    newValue = props.max;
  } else {
    newValue = snappedValue;
  }

  currentValue.value = newValue;
};

const onInputChange = (event) => {
  if (event.target && event.target.value) {
    timeInputValue.value = event.target.value;
  }
};

function formatMinutesToTimeString(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins < 10 ? '0' : ''}${mins}`;
}

function parseTimeStringToMinutes(timeString) {
  if (!timeString) return 0;
  
  let hours = 0;
  let minutes = 0;
  let cleanString = timeString.toString().trim();

  if (props.outputFormat === 'HHMM') {
    cleanString = cleanString.replace(/[^0-9]/g, '');
    if (cleanString.length === 4) {
      hours = parseInt(cleanString.slice(0, 2), 10) || 0;
      minutes = parseInt(cleanString.slice(2), 10) || 0;
      return hours * 60 + minutes;
    }
    const totalMinutes = parseInt(cleanString, 10) || 0;
    return totalMinutes;
  }
  
  const normalized = cleanString.replace(/[^0-9h:]/g, '');
  if (normalized.includes('h')) {
    const parts = normalized.split('h');
    hours = parseInt(parts[0]) || 0;
    minutes = parseInt(parts[1]) || 0;
  } else if (normalized.includes(':')) {
    const parts = normalized.split(':');
    hours = parseInt(parts[0]) || 0;
    minutes = parseInt(parts[1]) || 0;
  } else {
    const totalMinutes = parseInt(normalized, 10) || 0;
    hours = Math.floor(totalMinutes / 60);
    minutes = totalMinutes % 60;
    if (hours > 0) {
      return totalMinutes;
    } else {
      return minutes;
    }
  }
  
  return hours * 60 + minutes;
}

function formatMinutesToTwoByteHHMM(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}h${mins.toString().padStart(2, '0')}`;
}

const startEditing = async () => {
  timeInputValue.value = props.outputFormat === 'HHMM'
    ? formatMinutesToTwoByteHHMM(Number(currentValue.value) || 0)
    : formatMinutesToTimeString(currentValue.value);
  isEditing.value = true;
  
  await nextTick();
  
  setTimeout(() => {
    if (timeInputRef.value) {
      if (typeof timeInputRef.value.setFocus === 'function') {
        timeInputRef.value.setFocus();
      } else {
        const nativeInput = timeInputRef.value.$el.querySelector('input');
        if (nativeInput) {
          nativeInput.focus();
          nativeInput.select();
        }
      }
    }
  }, 50);
};

const finishEditing = () => {
  if (!timeInputValue.value) {
    timeInputValue.value = props.outputFormat === 'HHMM'
      ? formatMinutesToTwoByteHHMM(Number(currentValue.value) || 0)
      : formatMinutesToTimeString(currentValue.value);
    isEditing.value = false;
    return;
  }
  
  const totalMinutes = parseTimeStringToMinutes(timeInputValue.value);
  
  let validMinutes = Math.max(props.min, Math.min(props.max, totalMinutes));
  
  validMinutes = Math.round(validMinutes / props.step) * props.step;
  
  currentValue.value = validMinutes;
  timeInputValue.value = props.outputFormat === 'HHMM'
    ? formatMinutesToTwoByteHHMM(validMinutes)
    : formatMinutesToTimeString(validMinutes);
  
  emit('update:value', { 
    newValue: validMinutes, 
    groupName: props.groupName, 
    paramName: props.paramName 
  });
  
  setTimeout(() => {
    isEditing.value = false;
  }, 100);
};

watch(() => props.max, (newMax) => {
  if (currentValue.value > newMax) {
    currentValue.value = newMax;
    emit('update:value', { newValue: newMax, groupName: props.groupName, paramName: props.paramName });
  }
});

watch(() => props.value, (newValue) => {
  const numericValue = Number(newValue) || 0;
  currentValue.value = numericValue;
  if (!isEditing.value) {
    timeInputValue.value = formatMinutesToTimeString(numericValue);
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

.slider-container {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 6px;
}

.time-range {
  flex: 1;
  min-width: 0;
  --bar-height: 5px;
  --bar-border-radius: 999px;
  --bar-background: rgba(var(--ion-color-primary-rgb), 0.2);
  --bar-background-active: var(--ion-color-primary);
  --knob-size: 28px;
  --padding-start: 4px;
  --padding-end: 4px;
}

.time-chip, .time-input {
  --background: var(--ion-color-primary);
  --color: white;
  width: 86px;
  justify-content: center;
  border-radius: 999px;
  --border-radius: 999px;
  margin: 0;
  flex-shrink: 0;
  font-weight: 700;
  box-shadow: 0 3px 9px rgba(var(--ion-color-primary-rgb), 0.22);
}

.time-input {
  --padding-end: 12px;
  --padding-start: 12px;
  text-align: center;
  font-family: inherit;
  font-size: inherit;
  min-height: unset;
  height: 32px;
  --highlight-color-focused: white;
}

.time-input::part(input) {
  text-align: center;
  padding: 0;
  margin: 0;
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
  .time-chip, .time-input {
    width: 76px;
    font-size: 0.8rem;
  }

  ion-label {
    font-size: 0.9rem;
  }
}
</style>
