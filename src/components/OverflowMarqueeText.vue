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
}>();

const root = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);
const overflowDistance = ref(0);
let resizeObserver: ResizeObserver | null = null;

const updateOverflow = () => {
  if (!root.value || !content.value) return;
  overflowDistance.value = Math.max(0, content.value.scrollWidth - root.value.clientWidth);
};

const marqueeStyle = computed(() => ({
  '--marquee-distance': `${overflowDistance.value}px`,
  '--marquee-duration': `${Math.max(7, 5 + overflowDistance.value / 18)}s`,
}));

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateOverflow);
    if (root.value) resizeObserver.observe(root.value);
    if (content.value) resizeObserver.observe(content.value);
  } else {
    window.addEventListener('resize', updateOverflow);
  }
  updateOverflow();
});

watch(() => props.text, async () => {
  await nextTick();
  updateOverflow();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('resize', updateOverflow);
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
