<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>
      <ion-header>
        <ion-toolbar>
          <ion-img 
            id="watteco-logo" 
            :src="logoSrc">
          </ion-img>
          <ion-title 
            size="large"
            id="watteco-title">
              Watteco Easy Codec - BETA v0.8.7
          </ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="downlink" href="/tabs/downlink">
          <ion-icon :icon="arrowDownCircleOutline" />
        </ion-tab-button>

        <ion-tab-button tab="uplink" href="/tabs/uplink" :disabled="true">
          <ion-icon :icon="arrowUpCircleOutline" />
        </ion-tab-button>

        <ion-tab-button tab="battery" href="/tabs/battery" :disabled="true">
          <ion-icon :icon="batteryHalfOutline" />
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { 
  IonTabBar, 
  IonTabButton, 
  IonTabs, 
  IonIcon, 
  IonPage, 
  IonRouterOutlet,
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonImg, 
  IonContent, 
  IonSelect, 
  IonSelectOption, 
  IonCard, 
  IonCardContent, 
  IonLabel, 
  IonCheckbox, 
  IonItem,
  IonSegment,
  IonSegmentButton,
  IonButton
} from '@ionic/vue';
import { arrowDownCircleOutline, arrowUpCircleOutline, batteryHalfOutline } from 'ionicons/icons';

// Define a reactive variable for the logo's src
const logoSrc = ref('');

onMounted(() => {
  loadImage();
});

const loadImage = async () => {
  try {
    // Dynamically load the image URL based on your environment setup
    logoSrc.value = `${import.meta.env.BASE_URL}img/LOGO-WATTECO_v2021_wbg_ctr.png`;
    console.log("Image loaded:", logoSrc.value);
  } catch (error) {
    console.error("Erreur lors du chargement de l'image :", error);
  }
};
</script>

<style>
:root {
  --ion-item-background: #00000000;
  --ion-item-border-color: #00000000;
}

ion-tab-bar {
  display: none; /* Tabs are not used yet */
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

#watteco-logo {
  width: 150px;
  height: auto;
  position: absolute;
  top: 15px;
  left: 15px;
}

#watteco-title {
  font-size: 1.5rem;
  position: relative;
  left: 150px;
}

/* Add responsive styles for smartphones */
@media (max-width: 600px) {
  ion-toolbar {
    --min-height: 60px;
    --padding-top: 10px;
    --padding-bottom: 10px;
  }

  #watteco-title {
    font-size: 1.2rem;
    left: 70px;
  }

  #watteco-logo {
    width: 70px;
    top: 18px;
    left: 10px;
  }

  ion-tab-button {
    font-size: 0.8rem;
  }
}
</style>