<template>
  <ion-label position="stacked">{{ localize(label) }}</ion-label>

  <div class="slider-container">
    <ion-range
      class="int-range"
      :min="currentMin"
      :max="currentMax"
      :step="step"
      :value="currentValue"
      pin="false"
      snaps="true"
      color="primary"
      @ionChange="onRangeChange"
      @ionInput="onRangeInput"
    ></ion-range>

    <ion-chip class="int-chip" v-if="!isEditing" @click="startEditing">
      {{ currentValue }}
    </ion-chip>

    <ion-input
      v-else
      class="int-input"
      v-model="inputValue"
      inputmode="numeric"
      @ionBlur="finishEditing"
      @keyup.enter="finishEditing"
      @ionInput="onInputChange"
      ref="intInputRef"
      :class="{ 'invalid-input': isInvalid }"
    ></ion-input>
  </div>

  <div v-if="isInvalid" class="error-message">
    {{ errorMessage }}
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  label: String,
  value: String,
  min: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 65535
  },
  step: {
    type: Number,
    default: 1
  },
  groupName: String,
  paramName: String,
  localize: {
    type: Function,
    required: true
  }
});

const currentValue = ref(parseInt(props.value) || 0);
const currentMin = ref(props.min);
const currentMax = ref(props.max);
const isEditing = ref(false);
const isInvalid = ref(false);
const errorMessage = ref('');
const inputValue = ref('');
const intInputRef = ref(null);

const emit = defineEmits(['update:value']);

watch(() => props.value, (newVal) => {
  currentValue.value = parseInt(newVal) || 0;
});

watch(() => props.min, (newMin) => {
  currentMin.value = newMin;
  clampCurrentValue();
});

watch(() => props.max, (newMax) => {
  currentMax.value = newMax;
  clampCurrentValue();
});

const clampCurrentValue = () => {
  if (currentValue.value < currentMin.value) {
    currentValue.value = currentMin.value;
    emit('update:value', { newValue: currentValue.value.toString(), groupName: props.groupName, paramName: props.paramName });
  } else if (currentValue.value > currentMax.value) {
    currentValue.value = currentMax.value;
    emit('update:value', { newValue: currentValue.value.toString(), groupName: props.groupName, paramName: props.paramName });
  }
};

const onRangeChange = (event) => {
  const newValue = parseInt(event.detail.value);
  currentValue.value = newValue;
  emit('update:value', { newValue: newValue.toString(), groupName: props.groupName, paramName: props.paramName });
};

const onRangeInput = (event) => {
  currentValue.value = parseInt(event.detail.value);
};

const startEditing = async () => {
  inputValue.value = currentValue.value.toString();
  isEditing.value = true;

  await nextTick();
  setTimeout(() => {
    if (intInputRef.value) {
      if (typeof intInputRef.value.setFocus === 'function') {
        intInputRef.value.setFocus();
      } else {
        const nativeInput = intInputRef.value.$el?.querySelector('input');
        if (nativeInput) {
          nativeInput.focus();
          nativeInput.select();
        }
      }
    }
  }, 50);
};

const onInputChange = (event) => {
  if (event.target?.value !== undefined) {
    inputValue.value = event.target.value;
  }
};

const finishEditing = () => {
  if (!inputValue.value) {
    isEditing.value = false;
    return;
  }

  const intValue = parseInt(inputValue.value);
  if (!isNaN(intValue)) {
    if (intValue >= currentMin.value && intValue <= currentMax.value) {
      currentValue.value = intValue;
      isInvalid.value = false;
      errorMessage.value = '';
      emit('update:value', { newValue: intValue.toString(), groupName: props.groupName, paramName: props.paramName });
    } else {
      isInvalid.value = true;
      errorMessage.value = `Value must be between ${currentMin.value} and ${currentMax.value}`;
    }
  } else {
    isInvalid.value = true;
    errorMessage.value = 'Invalid number';
  }
  isEditing.value = false;
};
</script>

<style scoped>
.slider-container {
  display: flex;
  align-items: center;
  width: 100%;
  margin-top: 4px;
}

.int-range {
  flex: 1;
  --padding-end: 12px;
}

.int-chip {
  min-width: 56px;
  text-align: center;
  cursor: pointer;
}

.int-input {
  min-width: 56px;
  max-width: 80px;
  --padding-start: 6px;
  --padding-end: 6px;
  border: 1px solid var(--ion-color-primary);
  border-radius: 8px;
}

.invalid-input {
  border-color: var(--ion-color-danger);
}

.error-message {
  color: var(--ion-color-danger);
  font-size: 0.75rem;
  margin-top: 2px;
}
</style>
