<template>
  <span
    ref="root"
    class="leading-ellipsis-text"
    :title="text"
    :style="{ minWidth: minimumWidth === null ? undefined : `${minimumWidth}px` }"
  >
    <span class="leading-ellipsis-text__sizer" aria-hidden="true">{{ text }}</span>
    <span class="leading-ellipsis-text__visual" aria-hidden="true">
      <span v-if="isOverflowing" class="leading-ellipsis-text__mark">&hellip;</span>
      <span class="leading-ellipsis-text__content">{{ visibleText }}</span>
    </span>
    <span class="leading-ellipsis-text__accessible">{{ text }}</span>
    <span ref="measurement" class="leading-ellipsis-text__measurement" aria-hidden="true"></span>
  </span>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  text: string;
  minVisibleCharacters?: number;
  overflowSuffix?: string;
}>();

const root = ref<HTMLElement | null>(null);
const measurement = ref<HTMLElement | null>(null);
const isOverflowing = ref(false);
const visibleText = ref(props.text);
const minimumWidth = ref<number | null>(null);
let resizeObserver: ResizeObserver | null = null;

const measureText = (text: string): number => {
  if (!measurement.value) return 0;
  measurement.value.textContent = text;
  return measurement.value.getBoundingClientRect().width;
};

const updateOverflow = () => {
  if (!root.value || !measurement.value) return;

  const characters = Array.from(props.text);
  const protectedCharacterCount = Math.min(
    Math.max(0, props.minVisibleCharacters ?? 0),
    characters.length,
  );
  if (props.overflowSuffix !== undefined) {
    minimumWidth.value = Math.ceil(measureText(`\u2026${props.overflowSuffix}`)) + 1;
  } else {
    minimumWidth.value = protectedCharacterCount > 0
      ? Math.ceil(measureText(`\u2026${characters.slice(-protectedCharacterCount).join('')}`)) + 1
      : null;
  }

  const availableWidth = root.value.getBoundingClientRect().width;
  if (measureText(props.text) <= availableWidth) {
    isOverflowing.value = false;
    visibleText.value = props.text;
    return;
  }

  isOverflowing.value = true;
  if (props.overflowSuffix !== undefined) {
    visibleText.value = props.overflowSuffix;
    return;
  }

  const suffixWidth = Math.max(0, availableWidth - measureText('\u2026') - 1);
  let shortestRejectedLength = characters.length + 1;
  let longestAcceptedLength = 0;

  while (longestAcceptedLength + 1 < shortestRejectedLength) {
    const candidateLength = Math.floor((longestAcceptedLength + shortestRejectedLength) / 2);
    const candidate = characters.slice(-candidateLength).join('');
    if (measureText(candidate) <= suffixWidth) {
      longestAcceptedLength = candidateLength;
    } else {
      shortestRejectedLength = candidateLength;
    }
  }

  visibleText.value = characters.slice(-longestAcceptedLength).join('');
};

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateOverflow);
    if (root.value) resizeObserver.observe(root.value);
  } else {
    window.addEventListener('resize', updateOverflow);
  }
  updateOverflow();
});

watch(() => [props.text, props.minVisibleCharacters, props.overflowSuffix], async () => {
  await nextTick();
  updateOverflow();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('resize', updateOverflow);
});
</script>

<style scoped>
.leading-ellipsis-text {
  position: relative;
  display: inline-flex;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  direction: ltr;
  white-space: nowrap;
}

.leading-ellipsis-text__sizer {
  flex: 0 0 auto;
  visibility: hidden;
}

.leading-ellipsis-text__visual {
  position: absolute;
  inset: 0;
  display: flex;
  overflow: hidden;
}

.leading-ellipsis-text__mark {
  flex: 0 0 auto;
}

.leading-ellipsis-text__content {
  flex: 0 0 auto;
  direction: ltr;
}

.leading-ellipsis-text__accessible {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.leading-ellipsis-text__measurement {
  position: absolute;
  width: max-content;
  visibility: hidden;
  pointer-events: none;
}
</style>
