<template>
  <div class="num-input-field">
    <ion-label position="stacked">{{ localize(label) }}</ion-label>
    <div class="separator"></div>

    <div class="input-row">
      <ion-input
        type="number"
        :value="currentValue"
        :min="min"
        :max="max"
        @ionInput="onInputChange"
      ></ion-input>

      <ion-chip v-if="unit" class="unit-chip">{{ unit }}</ion-chip>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  label: String,
  unit: String,
  value: String,
  min: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 65535
  },
  groupName: String,
  paramName: String,
  localize: {
    type: Function,
    required: true
  }
});

const currentValue = ref(props.value);
const emit = defineEmits(['update:value']);

const onInputChange = (event) => {
  const newValue = event.detail.value;
  if (newValue === '') return;
  
  const numValue = parseInt(newValue);
  if (numValue >= props.min && numValue <= props.max) {
    currentValue.value = numValue;
    emit('update:value', { newValue: numValue.toString(), groupName: props.groupName, paramName: props.paramName });
  }
};

watch(() => props.value, (newValue) => {
  currentValue.value = newValue;
});
</script>

<style scoped>
.num-input-field {
  width: 100%;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.separator {
  flex: 0.3 1 0px;
  width: 1%;
  height: 100%;
}

ion-input {
  flex: 1;
  --padding-start: 10px;
  --padding-end: 10px;
}

.unit-chip {
  --background: var(--ion-color-primary);
  --color: var(--ion-color-primary-contrast);
  margin: 0;
  flex-shrink: 0;
}

@media (max-width: 600px) {
  ion-label {
    font-size: 0.9rem;
  }

  .input-row {
    gap: 6px;
  }
}
</style>
