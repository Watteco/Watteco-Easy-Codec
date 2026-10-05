<template>
  <ion-app>
    <ion-router-outlet :animated="false" />
    <sensor-mobile-tabs v-if="showSensorTabs" />
  </ion-app>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import SensorMobileTabs from '@/components/sensor/SensorMobileTabs.vue';

const route = useRoute();
const sensorPaths = new Set(['/sensor-data', '/tabs/downlink', '/sensor-tools']);
const showSensorTabs = computed(() => Capacitor.isNativePlatform() && (
  sensorPaths.has(route.path)
));

</script>
