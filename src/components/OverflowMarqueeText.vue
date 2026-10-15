<template>
  <span
    ref="root"
    class="overflow-marquee-text"
    :class="{ 'overflow-marquee-text--active': overflowDistance > 0 }"
    :title="text"
  >
    <span
      ref="content"
      class="overflow-marquee-text__content"
      :style="marqueeStyle"
    >{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  text: string;
  endBoundarySelector?: string;
  layoutKey?: string;
}>();

const root = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);
const overflowDistance = ref(0);
let resizeObserver: ResizeObserver | null = null;
let boundaryElement: Element | null = null;
let animationFrame: number | null = null;
const endSafetyMargin = 4;

const resolveAvailableWidth = (): number => {
  if (!root.value || !props.endBoundarySelector) return root.value?.clientWidth ?? 0;

  const layoutContainer = root.value.closest('.sensor-mobile-header');
  boundaryElement = layoutContainer?.querySelector(props.endBoundarySelector) ?? null;
  if (!layoutContainer || !boundaryElement) return root.value.clientWidth;

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

const updateOverflow = () => {
  if (!root.value || !content.value) return;
  overflowDistance.value = Math.max(0, content.value.scrollWidth - resolveAvailableWidth());
};

const scheduleOverflowUpdate = () => {
  updateOverflow();
  if (typeof requestAnimationFrame === 'undefined') return;
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(() => {
    animationFrame = null;
    updateOverflow();
  });
};

const marqueeStyle = computed(() => ({
  '--marquee-distance': `${overflowDistance.value}px`,
  '--marquee-duration': `${Math.max(7, 5 + overflowDistance.value / 18)}s`,
}));

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(scheduleOverflowUpdate);
    if (root.value) resizeObserver.observe(root.value);
    if (content.value) resizeObserver.observe(content.value);
    resolveAvailableWidth();
    if (boundaryElement) resizeObserver.observe(boundaryElement);
  } else {
    window.addEventListener('resize', scheduleOverflowUpdate);
  }
  scheduleOverflowUpdate();
});

watch(() => [props.text, props.layoutKey], async () => {
  await nextTick();
  scheduleOverflowUpdate();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (animationFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(animationFrame);
  }
  window.removeEventListener('resize', scheduleOverflowUpdate);
});
</script>

<style scoped>
.overflow-marquee-text {
  box-sizing: border-box;
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.overflow-marquee-text__content {
  display: inline-block;
  min-width: max-content;
}

.overflow-marquee-text--active .overflow-marquee-text__content {
  animation: overflow-marquee var(--marquee-duration) ease-in-out infinite;
}

@keyframes overflow-marquee {
  0%, 18% {
    transform: translateX(0);
  }

  55%, 78% {
    transform: translateX(calc(-1 * var(--marquee-distance)));
  }

  100% {
    transform: translateX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .overflow-marquee-text--active .overflow-marquee-text__content {
    animation: none;
  }
}
</style>
