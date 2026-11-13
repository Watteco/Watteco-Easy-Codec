<template>
  <span v-if="descriptions.length" class="field-help">
    <button
      type="button"
      class="field-help-button"
      :aria-label="`${helpLabel} : ${label}`"
      :aria-expanded="isOpen"
      aria-haspopup="dialog"
      @click.stop="openHelp"
    >
      <ion-icon :icon="informationCircleOutline" aria-hidden="true" />
    </button>
    <ion-popover
      class="field-help-popover"
      :is-open="isOpen"
      :event="triggerEvent"
      :aria-label="label"
      @didDismiss="isOpen = false"
    >
      <div class="field-help-content">
        <strong>{{ label }}</strong>
        <p v-for="description in descriptions" :key="description">{{ description }}</p>
      </div>
    </ion-popover>
  </span>
</template>

<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import { IonIcon, IonPopover } from '@ionic/vue';
import { informationCircleOutline } from 'ionicons/icons';

defineProps<{ label: string; helpLabel: string; descriptions: string[] }>();
const isOpen = ref(false);
const triggerEvent = shallowRef<Event>();
function openHelp(event: Event) {
  // Ionic centers popovers without an event/trigger reference.
  triggerEvent.value = window.matchMedia?.('(max-width: 600px)').matches ? undefined : event;
  isOpen.value = true;
}
</script>

<style scoped>
.field-help {
  position: relative;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  align-self: flex-start;
  margin: 0;
}

.field-help-button {
  position: absolute;
  top: -6px;
  left: -6px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ion-color-primary);
  cursor: pointer;
}

.field-help-button:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 1px;
}

.field-help-button ion-icon { font-size: 22px; }
.field-help-content { padding: 16px; color: var(--app-text, var(--ion-text-color)); }
.field-help-content p { margin: 10px 0 0; line-height: 1.45; }

.field-help-popover {
  --width: 320px;
  --max-width: calc(100vw - 32px);
}

@media (max-width: 600px) {
  .field-help-popover {
    --width: 360px;
  }
}
</style>
