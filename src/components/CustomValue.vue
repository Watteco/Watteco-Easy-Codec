<template>
  <div style="display: none;">{{ value }}</div>
</template>

<script setup>
const props = defineProps({
  value: String,
  groupName: String,
  paramName: String,
});
</script>
