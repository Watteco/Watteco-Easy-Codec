<template>
  <ion-label>{{ label }}</ion-label>
</template>

<script setup>
const props = defineProps({
  label: String,
  value: String,
  groupName: String,
  paramName: String,
});
</script>