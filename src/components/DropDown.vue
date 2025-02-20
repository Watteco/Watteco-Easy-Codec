<template>
  <ion-label position="stacked">{{ localize(label) }}</ion-label>
  <div class="separator"></div>
  
  <ion-select
    interface="popover"
    :value="currentValue"
    @ionChange="onSelectChange"
  >
    <ion-select-option v-for="choice in processedChoices" :key="choice.value" :value="choice.value">
      {{ choice.label }}
    </ion-select-option>
  </ion-select>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  label: String,
  value: String,
  choices: {
    type: Array,
    required: true
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

const processedChoices = computed(() => {
  return props.choices.map(choice => {
    if (Array.isArray(choice)) {
      return {
        value: choice[0],
        label: props.localize(choice[1])
      };
    }
    return {
      value: choice,
      label: choice
    };
  });
});

const getDisplayValue = (value) => {
  const choice = processedChoices.value.find(c => c.value === value);
  return choice ? choice.label : value;
};

const onSelectChange = (event) => {
  const newValue = event.detail.value;
  currentValue.value = newValue;
  emit('update:value', { newValue, groupName: props.groupName, paramName: props.paramName });
};

watch(() => props.value, (newValue) => {
  currentValue.value = newValue;
});
</script>

<style scoped>
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

ion-select {
  --placeholder-color: var(--ion-color-primary);
  --placeholder-opacity: 1;
  margin-right: 10px;
}

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
