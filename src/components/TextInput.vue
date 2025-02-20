<template>
  <ion-label position="stacked">{{ localize(label) }}</ion-label>
  <div class="separator"></div>
  
  <ion-input
    type="text"
    :value="currentValue"
    :placeholder="localize(placeholder)"
    @ionInput="onInputChange"
  ></ion-input>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  label: String,
  value: String,
  placeholder: {
    type: String,
    default: ''
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

ion-input {
  --padding-start: 10px;
  --padding-end: 10px;
}

@media (max-width: 600px) {
  ion-label {
    font-size: 0.9rem;
  }
}
</style>
