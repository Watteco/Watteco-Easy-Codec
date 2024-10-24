<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>
      <ion-header>
        <ion-toolbar>
          <ion-title size="large">Watteco Easy Codec</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="downlink" href="/tabs/downlink">
          <ion-icon :icon="arrowDownCircleOutline" />
        </ion-tab-button>

        <ion-tab-button tab="uplink" href="/tabs/uplink" disabled="true">
          <ion-icon :icon="arrowUpCircleOutline" />
        </ion-tab-button>

        <ion-tab-button tab="battery" href="/tabs/battery" disabled="true">
          <ion-icon :icon="batteryHalfOutline" />
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonTabBar, IonTabButton, IonTabs, IonIcon, IonPage, IonRouterOutlet } from '@ionic/vue';
import { arrowDownCircleOutline, arrowUpCircleOutline, batteryHalfOutline } from 'ionicons/icons';
</script>

<style>
:root {
  --ion-item-background: #00000000;
  --ion-item-border-color: #00000000;
}


ion-toolbar {
  --background: var(--ion-color-primary);
  --color: white;

  --min-height: 80px;
  --padding-top: 20px;
  --padding-bottom: 20px;
}

#config-card ion-label{
  color: white;
}

ion-range {
  padding-top: 5px;
}
</style>