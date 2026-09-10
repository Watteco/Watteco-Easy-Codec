<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/ble-connect" />
        </ion-buttons>
        <ion-title>BLE Settings</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item>
          <ion-select
            :label="currentLanguage === 'fr' ? 'Langue' : 'Language'"
            :value="currentLanguage"
            @ionChange="changeLanguage($event.detail.value)"
          >
            <ion-select-option value="fr">Français</ion-select-option>
            <ion-select-option value="en">English</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBackButton, IonButtons, IonContent, IonHeader,
  IonPage, IonTitle, IonToolbar, IonList, IonItem, IonSelect, IonSelectOption,
} from '@ionic/vue';
import { useLanguage } from '@/composables/useLanguage';

const { currentLanguage, changeLanguage } = useLanguage();
</script>
