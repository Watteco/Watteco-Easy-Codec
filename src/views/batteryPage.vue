<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <ExploreContainer name="Battery simulator" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonContent } from '@ionic/vue';
import ExploreContainer from '@/components/ExploreContainer.vue';
</script>
