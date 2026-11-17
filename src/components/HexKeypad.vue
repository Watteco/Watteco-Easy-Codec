<template>
  <div class="hex-keypad">
    <div v-if="!systemKeyboardEnabled" class="hex-keypad__keys">
      <button
        v-for="key in HEX_KEYS"
        :key="key"
        type="button"
        class="hex-keypad__key"
        :disabled="disabled"
        @click="emit('insert', key)"
      >
        {{ key }}
      </button>
      <button
        v-if="showSpace"
        type="button"
        class="hex-keypad__key hex-keypad__key--wide"
        :disabled="disabled"
        @click="emit('insert', ' ')"
      >
        {{ spaceLabel }}
      </button>
      <button
        type="button"
        class="hex-keypad__key"
        :class="showSpace ? 'hex-keypad__key--wide' : 'hex-keypad__key--full'"
        :disabled="disabled"
        :aria-label="backspaceLabel"
        @click="handleDeleteKeyClick"
        @pointercancel="stopDeleteRepeat"
        @pointerdown="startDeleteRepeat"
        @pointerleave="stopDeleteRepeat"
        @pointermove="moveDeleteRepeat"
        @pointerup="finishDeleteRepeat"
      >
        &#9003;
      </button>
    </div>
    <ion-button
      class="hex-keypad__mode"
      size="small"
      fill="clear"
      expand="block"
      :disabled="disabled"
      @click="emit('toggle-system-keyboard')"
    >
      {{ systemKeyboardEnabled ? keypadLabel : systemKeyboardLabel }}
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { IonButton } from '@ionic/vue';

const HEX_KEYS = [
  '1', '2', '3', 'A',
  '4', '5', '6', 'B',
  '7', '8', '9', 'C',
  '0', 'D', 'E', 'F',
] as const;

withDefaults(defineProps<{
  systemKeyboardEnabled?: boolean;
  disabled?: boolean;
  showSpace?: boolean;
  spaceLabel?: string;
  backspaceLabel: string;
  keypadLabel: string;
  systemKeyboardLabel: string;
}>(), {
  systemKeyboardEnabled: false,
  disabled: false,
  showSpace: true,
  spaceLabel: 'Space',
});

const emit = defineEmits<{
  (event: 'insert', value: string): void;
  (event: 'backspace'): void;
  (event: 'focus-request'): void;
  (event: 'toggle-system-keyboard'): void;
}>();

let deleteRepeatDelay: ReturnType<typeof setTimeout> | undefined;
let deleteRepeatInterval: ReturnType<typeof setInterval> | undefined;
let deletePointerId: number | undefined;
let deletePointerStartX = 0;
let deletePointerStartY = 0;
let deleteRepeated = false;
let suppressDeleteClick = false;
let suppressDeleteClickReset: ReturnType<typeof setTimeout> | undefined;

function stopDeleteRepeat(): void {
  if (deleteRepeatDelay) clearTimeout(deleteRepeatDelay);
  if (deleteRepeatInterval) clearInterval(deleteRepeatInterval);
  deleteRepeatDelay = undefined;
  deleteRepeatInterval = undefined;
  deletePointerId = undefined;
  deleteRepeated = false;
}

function startDeleteRepeat(event: PointerEvent): void {
  stopDeleteRepeat();
  if (suppressDeleteClickReset) clearTimeout(suppressDeleteClickReset);
  suppressDeleteClickReset = undefined;
  suppressDeleteClick = false;
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  deletePointerId = event.pointerId;
  deletePointerStartX = event.clientX;
  deletePointerStartY = event.clientY;
  (event.currentTarget as HTMLButtonElement).setPointerCapture?.(event.pointerId);
  deleteRepeatDelay = setTimeout(() => {
    if (deletePointerId !== event.pointerId) return;
    deleteRepeated = true;
    emit('backspace');
    deleteRepeatInterval = setInterval(() => emit('backspace'), 55);
  }, 350);
}

function moveDeleteRepeat(event: PointerEvent): void {
  if (event.pointerId !== deletePointerId) return;
  const moved = Math.hypot(
    event.clientX - deletePointerStartX,
    event.clientY - deletePointerStartY,
  );
  if (moved <= 10) return;

  (event.currentTarget as HTMLButtonElement).releasePointerCapture?.(event.pointerId);
  stopDeleteRepeat();
}

function finishDeleteRepeat(event: PointerEvent): void {
  if (event.pointerId !== deletePointerId) return;
  const wasRepeated = deleteRepeated;
  stopDeleteRepeat();
  if (!wasRepeated) return;

  // A click is synthesized after pointerup. The repeated deletions have already
  // been emitted, so ignore only that immediate click.
  suppressDeleteClick = true;
  suppressDeleteClickReset = setTimeout(() => {
    suppressDeleteClick = false;
    suppressDeleteClickReset = undefined;
    emit('focus-request');
  }, 0);
}

function handleDeleteKeyClick(): void {
  if (suppressDeleteClick) {
    suppressDeleteClick = false;
    if (suppressDeleteClickReset) clearTimeout(suppressDeleteClickReset);
    suppressDeleteClickReset = undefined;
    emit('focus-request');
    return;
  }
  // Emit after the click has completed so the consumer can restore its input
  // focus without the button taking it back immediately afterwards.
  emit('backspace');
}

onBeforeUnmount(() => {
  stopDeleteRepeat();
  if (suppressDeleteClickReset) clearTimeout(suppressDeleteClickReset);
});
</script>

<style scoped>
.hex-keypad {
  display: grid;
  gap: 2px;
  margin-top: 8px;
}

.hex-keypad__keys {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.hex-keypad__key {
  min-height: 42px;
  border: 1px solid var(--app-border-strong);
  border-radius: 8px;
  color: var(--app-text);
  background: var(--app-card-background, var(--ion-card-background, #fff));
  font: 650 1rem/1 monospace;
  touch-action: manipulation;
}

.hex-keypad__key:active { background: var(--app-page-background); }

.hex-keypad__key:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 1px;
}

.hex-keypad__key--wide,
.hex-keypad__key--full {
  font-family: inherit;
  font-size: 0.82rem;
}

.hex-keypad__key--wide { grid-column: span 2; }
.hex-keypad__key--full { grid-column: 1 / -1; }

.hex-keypad__mode {
  justify-self: stretch;
  margin: 0;
}
</style>
