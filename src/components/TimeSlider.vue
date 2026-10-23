<template>
  <ion-label position="stacked">{{ label }}</ion-label>

  <div class="slider-container">
    <ion-range
      class="time-range"
      :min="rangeMin"
      :max="rangeMax"
      :value="currentIndex"
      :step="1"
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
      :placeholder="props.outputFormat === 'HHMM' ? 'HHMM' : '10s / 0h10'"
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
import { useRangeTicks } from '@/composables/useRangeTicks';
import {
  formatTimeValue,
  formatTimeValueStorage,
  parseTimeValue,
  timeValueToSeconds,
} from '@/utils/timeValue';

// Props
const props = defineProps({
  label: String,
  min: [String, Number],
  max: [String, Number],
  value: [String, Number],
  step: [String, Number],
  maxDuration: {
    type: [String, Number],
    default: null,
  },
  allowSeconds: {
    type: Boolean,
    default: false,
  },
  secondsMin: {
    type: [String, Number],
    default: 1,
  },
  secondsStep: {
    type: [String, Number],
    default: 1,
  },
  groupName: String,
  paramName: String,
  outputFormat: {
    type: String,
    default: ''
  }
});

const normalizeStorageValue = (value) => {
  const parsed = parseTimeValue(value);
  return parsed ? formatTimeValueStorage(parsed) : '0';
};

const currentValue = ref(normalizeStorageValue(props.value));
const timeInputValue = ref(formatTimeValue(currentValue.value));
const isEditing = ref(false);
const timeInputRef = ref(null);

const effectiveMaximum = computed(() => (
  parseTimeValue(props.maxDuration ?? props.max)
  ?? parseTimeValue(Number(props.max) || 0)
  ?? { unit: 'minutes', value: 0 }
));
const effectiveMaximumSeconds = computed(() => timeValueToSeconds(
  formatTimeValueStorage(effectiveMaximum.value),
) ?? 0);

const durationOptions = computed(() => {
  if (props.outputFormat === 'HHMM') {
    const minimum = Number(props.min) || 0;
    const maximum = Number(props.max) || 0;
    const step = Math.max(1, Number(props.step) || 1);
    const values = [minimum];
    const firstStep = Math.ceil(minimum / step) * step;
    for (let value = firstStep; value <= maximum; value += step) values.push(value);
    values.push(maximum);
    const selected = parseTimeValue(currentValue.value)?.value;
    if (selected !== undefined && selected >= minimum && selected <= maximum) values.push(selected);
    return [...new Set(values)].sort((left, right) => left - right)
      .map(value => ({ unit: 'minutes', value }));
  }

  const options = [];
  if (props.allowSeconds) {
    const minimum = Math.max(0, Number(props.secondsMin) || 1);
    const maximum = Math.min(59, effectiveMaximumSeconds.value);
    const step = Math.max(1, Number(props.secondsStep) || 1);
    for (let value = minimum; value <= maximum; value += step) {
      options.push({ unit: 'seconds', value });
    }
  }

  const minimumMinutes = Math.max(0, Number(props.min) || 0);
  const configuredMaximumMinutes = Math.max(minimumMinutes, Number(props.max) || 0);
  const maximumMinutes = Math.min(
    configuredMaximumMinutes,
    Math.floor(effectiveMaximumSeconds.value / 60),
  );
  const minuteStep = Math.max(1, Number(props.step) || 1);
  if (minimumMinutes <= maximumMinutes) {
    options.push({ unit: 'minutes', value: minimumMinutes });
    const firstStep = Math.ceil(minimumMinutes / minuteStep) * minuteStep;
    for (let value = firstStep; value <= maximumMinutes; value += minuteStep) {
      options.push({ unit: 'minutes', value });
    }
    options.push({ unit: 'minutes', value: maximumMinutes });
  }

  const selected = parseTimeValue(currentValue.value);
  const selectedSeconds = timeValueToSeconds(currentValue.value);
  if (selected && selectedSeconds !== null && selectedSeconds <= effectiveMaximumSeconds.value) {
    options.push(selected);
  }

  const unique = new Map();
  options.forEach(option => unique.set(`${option.unit}:${option.value}`, option));
  return Array.from(unique.values()).sort((left, right) => {
    const durationDifference = (left.unit === 'seconds' ? left.value : left.value * 60)
      - (right.unit === 'seconds' ? right.value : right.value * 60);
    if (durationDifference !== 0) return durationDifference;
    return left.unit === 'seconds' ? -1 : 1;
  });
});

const rangeMin = computed(() => 0);
const rangeMax = computed(() => Math.max(0, durationOptions.value.length - 1));
const currentIndex = computed(() => {
  const selected = parseTimeValue(currentValue.value);
  if (!selected || durationOptions.value.length === 0) return 0;
  const exactIndex = durationOptions.value.findIndex(option => (
    option.unit === selected.unit && option.value === selected.value
  ));
  if (exactIndex >= 0) return exactIndex;
  const selectedSeconds = timeValueToSeconds(currentValue.value) ?? 0;
  return durationOptions.value.reduce((nearestIndex, option, index) => {
    const optionSeconds = option.unit === 'seconds' ? option.value : option.value * 60;
    const nearest = durationOptions.value[nearestIndex];
    const nearestSeconds = nearest.unit === 'seconds' ? nearest.value : nearest.value * 60;
    return Math.abs(optionSeconds - selectedSeconds) < Math.abs(nearestSeconds - selectedSeconds)
      ? index
      : nearestIndex;
  }, 0);
});

const showTicks = useRangeTicks(
  () => rangeMin.value,
  () => rangeMax.value,
  () => 1,
);

const emit = defineEmits(['update:value']);

const valueHours = computed(() => {
  return formatTimeValue(currentValue.value);
});

const displayValue = computed(() => {
  if (props.outputFormat === 'HHMM') {
    return formatMinutesToTwoByteHHMM(parseTimeValue(currentValue.value)?.value ?? 0);
  }
  return valueHours.value;
});

const onRangeChange = (event) => {
  const option = durationOptions.value[Math.round(event.detail.value)];
  if (!option) return;
  const newValue = formatTimeValueStorage(option);
  currentValue.value = newValue;
  emit('update:value', { newValue, groupName: props.groupName, paramName: props.paramName });
};

const onRangeInput = (event) => {
  const option = durationOptions.value[Math.round(event.detail.value)];
  if (option) currentValue.value = formatTimeValueStorage(option);
};

const onInputChange = (event) => {
  if (event.target && event.target.value) {
    timeInputValue.value = event.target.value;
  }
};

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

  return 0;
}

function formatMinutesToTwoByteHHMM(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}h${mins.toString().padStart(2, '0')}`;
}

const startEditing = async () => {
  timeInputValue.value = props.outputFormat === 'HHMM'
    ? formatMinutesToTwoByteHHMM(parseTimeValue(currentValue.value)?.value ?? 0)
    : formatTimeValue(currentValue.value);
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
      ? formatMinutesToTwoByteHHMM(parseTimeValue(currentValue.value)?.value ?? 0)
      : formatTimeValue(currentValue.value);
    isEditing.value = false;
    return;
  }
  
  let newValue;
  if (props.outputFormat === 'HHMM') {
    const totalMinutes = parseTimeStringToMinutes(timeInputValue.value);
    let validMinutes = Math.max(props.min, Math.min(props.max, totalMinutes));
    validMinutes = Math.max(Number(props.min), Math.min(Number(props.max), validMinutes));
    newValue = String(validMinutes);
  } else {
    let parsed = parseTimeValue(timeInputValue.value);
    if (!parsed) {
      timeInputValue.value = formatTimeValue(currentValue.value);
      isEditing.value = false;
      return;
    }
    if (!props.allowSeconds && parsed.unit === 'seconds') {
      parsed = { unit: 'minutes', value: Math.round(parsed.value / 60) };
    }
    const parsedSeconds = parsed.unit === 'seconds' ? parsed.value : parsed.value * 60;
    if (parsedSeconds > effectiveMaximumSeconds.value) parsed = effectiveMaximum.value;
    if (parsed.unit === 'seconds') {
      const minimumSeconds = Math.max(0, Number(props.secondsMin) || 1);
      parsed.value = Math.max(minimumSeconds, parsed.value);
    } else {
      const minimumMinutes = Math.max(0, Number(props.min) || 0);
      const maximumMinutes = Math.floor(effectiveMaximumSeconds.value / 60);
      parsed.value = Math.max(minimumMinutes, Math.min(maximumMinutes, parsed.value));
    }
    newValue = formatTimeValueStorage(parsed);
  }

  currentValue.value = newValue;
  timeInputValue.value = props.outputFormat === 'HHMM'
    ? formatMinutesToTwoByteHHMM(parseTimeValue(newValue)?.value ?? 0)
    : formatTimeValue(newValue);
  
  emit('update:value', { 
    newValue,
    groupName: props.groupName, 
    paramName: props.paramName 
  });
  
  setTimeout(() => {
    isEditing.value = false;
  }, 100);
};

watch([() => props.max, () => props.maxDuration], () => {
  const currentSeconds = timeValueToSeconds(currentValue.value);
  if (currentSeconds !== null && currentSeconds > effectiveMaximumSeconds.value) {
    const newValue = formatTimeValueStorage(effectiveMaximum.value);
    currentValue.value = newValue;
    emit('update:value', { newValue, groupName: props.groupName, paramName: props.paramName });
  }
});

watch(() => props.value, (newValue) => {
  currentValue.value = normalizeStorageValue(newValue);
  if (!isEditing.value) {
    timeInputValue.value = props.outputFormat === 'HHMM'
      ? formatMinutesToTwoByteHHMM(parseTimeValue(currentValue.value)?.value ?? 0)
      : formatTimeValue(currentValue.value);
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
