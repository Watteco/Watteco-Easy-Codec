import { computed, onMounted, onUnmounted, ref } from 'vue';

const DESKTOP_MEDIA_QUERY = '(min-width: 700px)';
const MOBILE_MAX_INTERVALS = 12;
const DESKTOP_MAX_INTERVALS = 48;

export const useRangeTicks = (
  getMin: () => number,
  getMax: () => number,
  getStep: () => number,
) => {
  const isDesktop = ref(
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(DESKTOP_MEDIA_QUERY).matches,
  );

  let mediaQuery: MediaQueryList | null = null;

  const updateDesktopState = (event: MediaQueryListEvent) => {
    isDesktop.value = event.matches;
  };

  onMounted(() => {
    if (typeof window.matchMedia !== 'function') return;

    mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    isDesktop.value = mediaQuery.matches;
    mediaQuery.addEventListener('change', updateDesktopState);
  });

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', updateDesktopState);
  });

  return computed(() => {
    const min = Number(getMin());
    const max = Number(getMax());
    const step = Number(getStep());

    if (![min, max, step].every(Number.isFinite) || step <= 0 || max <= min) {
      return false;
    }

    const intervalCount = Math.ceil((max - min) / step);
    const maximumIntervals = isDesktop.value
      ? DESKTOP_MAX_INTERVALS
      : MOBILE_MAX_INTERVALS;

    return intervalCount <= maximumIntervals;
  });
};
