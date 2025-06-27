<template>
  <ion-label>{{ label }}</ion-label>
  <ion-toggle v-show="false"></ion-toggle>

  <div class="separator"></div>

  <!-- Checkbox -->
  <ion-checkbox
    label-placement="fixed"
    alignment="center"
    :checked="enabled"
    color="primary"
    @ionChange="onCheckChange"
  > </ion-checkbox>
  <!-- Display unit based on toggle state -->
  <ion-chip v-if="enabled === 'true'">On</ion-chip>
  <ion-chip v-if="enabled === 'false'">Off</ion-chip>
</template>

<script setup>
import { ref, watch } from 'vue';

// Props to pass values from parent component
const props = defineProps({
  label: String,
  value: Boolean,
  groupName: String,   // new prop for groupName
  paramName: String,   // new prop for paramName
  inverted: Boolean    // new prop for inverted behavior
});

// Local state to manage checkbox state
const enabled = ref(props.value);

// Emit changes back to parent component
const emit = defineEmits(['update:value']);

// Handle changes in the ion-checkbox
const onCheckChange = (event) => {
  const newValue = event.detail.checked;
  enabled.value = newValue;
  emit('update:value', { newValue, groupName: props.groupName, paramName: props.paramName, inverted: props.inverted });
};

// Watch for changes in the value prop to update the local state
watch(() => props.value, (newValue) => {
  enabled.value = newValue;
});
</script>

<style scoped>

.separator {
  flex: 1 1 0px;
  width: 100%;
  height: 100%;
}

ion-chip {
  --background: var(--ion-color-primary);
  --color: white;
  width: 90px;
  justify-content: space-around;
  border-radius: 10px;
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
