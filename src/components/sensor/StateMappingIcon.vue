<template>
  <span class="state-mapping-icon" :class="{ 'state-mapping-icon--inverted': inverted }">
    <span class="state-mapping-icon__row">
      <span class="state-mapping-icon__dot state-mapping-icon__dot--high" />
      <span>H</span>
    </span>
    <span class="state-mapping-icon__row">
      <span class="state-mapping-icon__dot state-mapping-icon__dot--low" />
      <span>L</span>
    </span>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  inverted: boolean;
}>();
</script>

<style scoped>
.state-mapping-icon {
  display: grid;
  width: 24px;
  height: 24px;
  box-sizing: border-box;
  align-content: center;
  gap: 1px;
  padding: 2px 3px;
  border: 1.5px solid currentColor;
  border-radius: 6px;
  color: var(--app-text-secondary);
}

.state-mapping-icon__row {
  display: grid;
  grid-template-columns: 7px 1fr;
  align-items: center;
  gap: 2px;
  font-size: 7px;
  font-weight: 800;
  line-height: 1;
}

.state-mapping-icon__dot {
  width: 5px;
  height: 5px;
  box-sizing: border-box;
  border: 1.25px solid #aaa49d;
  border-radius: 50%;
  background: transparent;
  transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
}

.state-mapping-icon__dot--high,
.state-mapping-icon--inverted .state-mapping-icon__dot--low {
  border-color: #529767;
  background: #529767;
  box-shadow: 0 0 0 1.5px rgba(82, 151, 103, 0.14);
}

.state-mapping-icon--inverted .state-mapping-icon__dot--high {
  border-color: #aaa49d;
  background: transparent;
  box-shadow: none;
}
</style>
