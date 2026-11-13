<template>
  <span ref="root" class="sensor-identity-reference" :title="accessibleLabel">
    <span class="sensor-identity-reference__visual" aria-hidden="true">
      <span v-if="visibleProductReference">{{ visibleProductReference }}</span>
      <span v-if="visibleProductReference && visibleDevEui">&nbsp;&middot;&nbsp;</span>
      <span v-if="visibleDevEui">{{ visibleDevEui }}</span>
    </span>
    <span class="sensor-identity-reference__accessible">{{ accessibleLabel }}</span>
    <span ref="measurement" class="sensor-identity-reference__measurement" aria-hidden="true"></span>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  productReference?: string | null;
  devEui?: string | null;
  minimumDevEuiCharacters?: number;
  endBoundarySelector?: string;
  layoutKey?: string;
}>(), {
  productReference: undefined,
  devEui: undefined,
  minimumDevEuiCharacters: 6,
});

const separator = ' · ';
const root = ref<HTMLElement | null>(null);
const measurement = ref<HTMLElement | null>(null);
const visibleProductReference = ref(props.productReference ?? '');
const visibleDevEui = ref(props.devEui ?? '');
let resizeObserver: ResizeObserver | null = null;
let boundaryElement: Element | null = null;
let animationFrame: number | null = null;
const endSafetyMargin = 4;

const accessibleLabel = computed(() => (
  [props.productReference, props.devEui].filter(Boolean).join(separator)
));

const measureText = (text: string): number => {
  if (!measurement.value) return 0;
  measurement.value.textContent = text;
  return Math.ceil(Math.max(
    measurement.value.scrollWidth,
    measurement.value.getBoundingClientRect().width,
  ));
};

const truncateStart = (text: string, availableWidth: number): string => {
  if (measureText(text) <= availableWidth) return text;

  const characters = Array.from(text);
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

  return `\u2026${characters.slice(-longestAcceptedLength).join('')}`;
};

const abbreviatedProductReference = (reference: string): string | null => {
  if (!/^50-70(?:-|$)/.test(reference)) return null;
  return `\u2026${reference.slice('50-70'.length)}`;
};

const resolveAvailableWidth = (): number => {
  if (!root.value || !props.endBoundarySelector) {
    return root.value?.getBoundingClientRect().width ?? 0;
  }

  const layoutContainer = root.value.closest('.sensor-mobile-header');
  boundaryElement = layoutContainer?.querySelector(props.endBoundarySelector) ?? null;
  if (!layoutContainer || !boundaryElement) return root.value.getBoundingClientRect().width;

  const rootRect = root.value.getBoundingClientRect();
  const boundaryRect = boundaryElement.getBoundingClientRect();
  const identityRect = root.value.closest('.sensor-mobile-identity')?.getBoundingClientRect();
  const columnGap = Number.parseFloat(getComputedStyle(layoutContainer).columnGap) || 0;
  const rightBoundary = Math.min(
    boundaryRect.left - columnGap,
    identityRect?.right ?? Number.POSITIVE_INFINITY,
  );
  return Math.max(0, rightBoundary - rootRect.left - endSafetyMargin);
};

const updateDisplay = () => {
  if (!root.value || !measurement.value) return;

  const productReference = props.productReference ?? '';
  const devEui = props.devEui ?? '';
  const availableWidth = resolveAvailableWidth();

  if (!productReference) {
    visibleProductReference.value = '';
    visibleDevEui.value = truncateStart(devEui, availableWidth);
    return;
  }

  if (!devEui) {
    visibleProductReference.value = productReference;
    visibleDevEui.value = '';
    return;
  }

  const separatorWidth = measureText(separator);
  const fullProductWidth = measureText(productReference);
  const fullDevEuiWidth = measureText(devEui);
  const devEuiCharacters = Array.from(devEui);
  const protectedCharacterCount = Math.min(
    Math.max(0, props.minimumDevEuiCharacters),
    devEuiCharacters.length,
  );
  const protectedDevEui = `\u2026${devEuiCharacters.slice(-protectedCharacterCount).join('')}`;
  const protectedDevEuiWidth = measureText(protectedDevEui) + 1;
  const availableWithFullProduct = availableWidth - fullProductWidth - separatorWidth;
  const shortenedProductReference = abbreviatedProductReference(productReference);
  const shouldShortenProduct = fullProductWidth + separatorWidth + fullDevEuiWidth > availableWidth
    && shortenedProductReference !== null
    && availableWithFullProduct < protectedDevEuiWidth;

  visibleProductReference.value = shouldShortenProduct
    ? shortenedProductReference
    : productReference;
  const availableDevEuiWidth = Math.max(
    0,
    availableWidth - measureText(visibleProductReference.value) - separatorWidth,
  );
  visibleDevEui.value = truncateStart(devEui, availableDevEuiWidth);
};

const scheduleDisplayUpdate = () => {
  updateDisplay();
  if (typeof requestAnimationFrame === 'undefined') return;
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(() => {
    animationFrame = null;
    updateDisplay();
  });
};

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(scheduleDisplayUpdate);
    if (root.value) resizeObserver.observe(root.value);
    resolveAvailableWidth();
    if (boundaryElement) resizeObserver.observe(boundaryElement);
  } else {
    window.addEventListener('resize', scheduleDisplayUpdate);
  }
  scheduleDisplayUpdate();
});

watch(
  () => [
    props.productReference,
    props.devEui,
    props.minimumDevEuiCharacters,
    props.layoutKey,
  ],
  async () => {
    await nextTick();
    scheduleDisplayUpdate();
  },
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (animationFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(animationFrame);
  }
  window.removeEventListener('resize', scheduleDisplayUpdate);
});
</script>

<style scoped>
.sensor-identity-reference {
  position: relative;
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.sensor-identity-reference__accessible {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sensor-identity-reference__measurement {
  position: absolute;
  display: inline-block;
  width: max-content;
  visibility: hidden;
  white-space: nowrap;
  pointer-events: none;
}
</style>
