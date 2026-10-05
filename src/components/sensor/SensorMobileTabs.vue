<template>
  <nav class="sensor-mobile-tabs" :aria-label="labels.navigation">
    <span
      class="sensor-mobile-tab-selection"
      :class="{ 'sensor-mobile-tab-selection--config': displayedActivePage === 'config' }"
      aria-hidden="true"
    ></span>
    <button
      type="button"
      class="sensor-mobile-tab"
      :class="{ 'sensor-mobile-tab--active': displayedActivePage === 'data' }"
      :aria-current="activePage === 'data' ? 'page' : undefined"
      @click="navigateTo('data')"
    >
      <ion-icon :icon="analyticsOutline" aria-hidden="true" />
      <span>{{ labels.data }}</span>
    </button>
    <button
      type="button"
      class="sensor-mobile-tab"
      :class="{ 'sensor-mobile-tab--active': displayedActivePage === 'config' }"
      :aria-current="activePage === 'config' ? 'page' : undefined"
      @click="navigateTo('config')"
    >
      <ion-icon :icon="optionsOutline" aria-hidden="true" />
      <span>{{ labels.config }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { analyticsOutline, optionsOutline } from 'ionicons/icons';
import { useLanguage } from '@/composables/useLanguage';
import {
  cancelSensorPageTransition,
  requestSensorPageTransition,
  type SensorPage,
} from '@/utils/sensorPageTransition';

const route = useRoute();
const router = useRouter();
const { currentLanguage } = useLanguage();
const activePage = computed<SensorPage>(() => (
  route.path === '/sensor-data' ? 'data' : 'config'
));
const displayedActivePage = ref<SensorPage>(activePage.value);
const navigationPending = ref(false);
const labels = computed(() => currentLanguage.value === 'fr'
  ? { navigation: 'Navigation du capteur', data: 'Données', config: 'Configuration' }
  : { navigation: 'Sensor navigation', data: 'Data', config: 'Configuration' });

watch(activePage, page => {
  displayedActivePage.value = page;
});

const navigateTo = async (page: SensorPage) => {
  if (activePage.value === page || navigationPending.value) return;

  navigationPending.value = true;
  displayedActivePage.value = page;
  requestSensorPageTransition(page);

  try {
    await router.push(page === 'data' ? '/sensor-data' : '/tabs/downlink');
  } catch (error) {
    cancelSensorPageTransition();
    displayedActivePage.value = activePage.value;
    console.error('Sensor page navigation failed', error);
  } finally {
    navigationPending.value = false;
  }
};

const blockedSwipeSelector = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'ion-button',
  'ion-checkbox',
  'ion-input',
  'ion-radio',
  'ion-range',
  'ion-segment',
  'ion-segment-button',
  'ion-select',
  'ion-textarea',
  'ion-toggle',
  '.slider-container',
  '.no-page-swipe',
  '[contenteditable="true"]',
  '[role="slider"]',
].join(',');

let touchStartX = 0;
let touchStartY = 0;
let touchStartedAt = 0;
let trackingSwipe = false;

const eventStartedInSwipeableContent = (event: TouchEvent) => {
  let insideContent = false;

  for (const target of event.composedPath()) {
    if (!(target instanceof Element)) continue;
    if (target.matches(blockedSwipeSelector)) return false;
    if (target.matches('ion-content.native-with-sensor-navigation')) insideContent = true;
  }

  return insideContent;
};

const onTouchStart = (event: TouchEvent) => {
  if (event.touches.length !== 1 || !eventStartedInSwipeableContent(event)) {
    trackingSwipe = false;
    return;
  }

  const touch = event.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartedAt = performance.now();
  trackingSwipe = true;
};

const onTouchEnd = (event: TouchEvent) => {
  if (!trackingSwipe || event.changedTouches.length !== 1) return;
  trackingSwipe = false;

  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;
  const elapsed = performance.now() - touchStartedAt;

  if (elapsed > 700 || Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;

  if (deltaX < 0) {
    void navigateTo('config');
  } else {
    void navigateTo('data');
  }
};

const cancelSwipe = () => {
  trackingSwipe = false;
};

onMounted(() => {
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', cancelSwipe, { passive: true });
});

onUnmounted(() => {
  document.removeEventListener('touchstart', onTouchStart);
  document.removeEventListener('touchend', onTouchEnd);
  document.removeEventListener('touchcancel', cancelSwipe);
});
</script>

<style scoped>
.sensor-mobile-tabs {
  box-sizing: border-box;
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1000;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-height: calc(62px + env(safe-area-inset-bottom));
  padding: 5px 8px calc(5px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--app-nav-border);
  background: var(--app-page-background);
  box-shadow: var(--app-nav-shadow);
}

.sensor-mobile-tab-selection {
  position: absolute;
  top: 5px;
  bottom: calc(5px + env(safe-area-inset-bottom));
  left: 8px;
  width: calc((100% - 16px) / 2);
  pointer-events: none;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  border-radius: 10px;
  transform: translate3d(0, 0, 0);
  transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
}

.sensor-mobile-tab-selection--config {
  transform: translate3d(100%, 0, 0);
}

.sensor-mobile-tab-selection::before {
  position: absolute;
  top: -5px;
  left: 50%;
  width: 42px;
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: var(--ion-color-primary);
  content: '';
  transform: translateX(-50%);
}

.sensor-mobile-tab {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 0;
  padding: 4px 8px;
  color: var(--ion-color-medium-shade);
  background: transparent;
  border: 0;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
  transition: color 180ms cubic-bezier(0.4, 0, 0.2, 1);
}

.sensor-mobile-tab ion-icon {
  width: 23px;
  height: 23px;
}

.sensor-mobile-tab--active {
  color: var(--ion-color-primary);
}
</style>
