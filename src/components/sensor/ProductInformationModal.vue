<template>
  <ion-modal
    :is-open="isOpen"
    css-class="product-information-modal"
    :aria-label="localize('@productInformationTitle')"
    @did-dismiss="$emit('dismiss')"
  >
    <ion-header class="product-information-header">
      <h2>{{ productName }}</h2>
      <button
        type="button"
        class="product-information-close"
        :aria-label="localize('@closeLabel')"
        @click="$emit('dismiss')"
      >
        <ion-icon :icon="closeOutline" aria-hidden="true" />
      </button>
    </ion-header>
    <div class="product-information-body">
      <div class="product-information-content">
        <img
          v-if="imageUrl"
          class="product-information-image"
          :src="imageUrl"
          :alt="productName"
        />
        <div class="product-information-copy">
          <strong class="product-information-reference">{{ productReference }}</strong>
          <p v-if="information?.description">{{ information.description }}</p>
          <p v-if="devEui" class="product-information-dev-eui">
            <span>{{ localize('@devEuiLabel') }}</span>
            <strong>{{ devEui }}</strong>
          </p>
        </div>
      </div>

      <div v-if="datasheetUrl || information?.support" class="product-information-actions">
        <ion-button v-if="datasheetUrl" expand="block" :href="datasheetUrl" target="_blank" rel="noopener noreferrer">
          <ion-icon slot="start" :icon="documentTextOutline" aria-hidden="true" />
          {{ localize('@productDatasheetAction') }}
          <ion-icon slot="end" :icon="openOutline" aria-hidden="true" />
        </ion-button>
        <ion-button
          v-if="information?.support"
          expand="block"
          fill="outline"
          :href="information.support"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ion-icon slot="start" :icon="helpCircleOutline" aria-hidden="true" />
          {{ localize('@productSupportAction') }}
          <ion-icon slot="end" :icon="openOutline" aria-hidden="true" />
        </ion-button>
      </div>
      <p v-else class="product-information-unavailable">
        {{ localize('@productResourcesUnavailable') }}
      </p>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  IonButton,
  IonHeader,
  IonIcon,
  IonModal,
} from '@ionic/vue';
import {
  closeOutline,
  documentTextOutline,
  helpCircleOutline,
  openOutline,
} from 'ionicons/icons';
import { useLanguage } from '@/composables/useLanguage';
import { getProductDisplayName } from '@/utils/productMeasurements';
import {
  getBundledProductImageUrl,
  getProductInformation,
} from '@/utils/productInformation';

const props = defineProps<{
  isOpen: boolean;
  productReference: string;
  devEui?: string | null;
  localize: (key: string) => string;
}>();

defineEmits<{ (event: 'dismiss'): void }>();

const { currentLanguage } = useLanguage();
const information = computed(() => getProductInformation(props.productReference));
const productName = computed(() => (
  getProductDisplayName(props.productReference)
  ?? information.value?.name
  ?? props.productReference
));
const imageUrl = computed(() => getBundledProductImageUrl(information.value?.image));
const datasheetUrl = computed(() => (
  information.value?.datasheets[currentLanguage.value]
  ?? information.value?.datasheets.fr
  ?? information.value?.datasheets.en
  ?? null
));
</script>

<style scoped>
:global(.product-information-modal) {
  --width: min(520px, calc(100% - 24px));
  --height: auto;
  --max-height: calc(100% - 48px);
  --border-radius: 14px;
}

:global(.product-information-modal .ion-page) {
  position: relative;
  contain: content;
}

.product-information-body {
  max-height: calc(100vh - 132px);
  max-height: calc(100dvh - 132px);
  padding: 16px;
  overflow-y: auto;
  color: var(--ion-text-color);
  background: var(--ion-background-color);
}

.product-information-header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  min-height: 60px;
  padding: 8px 10px 8px 24px;
  color: var(--ion-color-primary-contrast);
  background: var(--ion-color-primary);
}

.product-information-header h2 {
  display: -webkit-box;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1.2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.product-information-close {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 50%;
}

.product-information-close:active {
  background: rgba(255, 255, 255, 0.18);
}

.product-information-close ion-icon {
  width: 22px;
  height: 22px;
}

.product-information-content {
  display: grid;
  grid-template-columns: minmax(120px, 42%) minmax(0, 1fr);
  align-items: center;
  gap: 20px;
}

.product-information-image {
  display: block;
  width: 100%;
  max-height: 260px;
  object-fit: contain;
}

.product-information-copy p {
  margin: 12px 0 0;
  line-height: 1.45;
}

.product-information-reference {
  color: var(--ion-color-medium-shade);
}

.product-information-dev-eui {
  display: grid;
  gap: 3px;
  font-size: 0.86rem;
}

.product-information-dev-eui span {
  color: var(--ion-color-medium-shade);
}

.product-information-actions {
  display: grid;
  gap: 8px;
  margin-top: 24px;
}

.product-information-unavailable {
  margin: 24px 0 0;
  color: var(--ion-color-medium-shade);
  text-align: center;
}

@media (max-width: 480px) {
  .product-information-content {
    grid-template-columns: 1fr;
    gap: 12px;
    text-align: center;
  }

  .product-information-image {
    width: min(70%, 240px);
    margin: 0 auto;
  }
}
</style>
