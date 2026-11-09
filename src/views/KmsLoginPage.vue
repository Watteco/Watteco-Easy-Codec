<template>
  <ion-page>
    <ion-header class="kms-header">
      <ion-toolbar class="kms-toolbar">
        <ion-buttons slot="start">
          <ion-back-button default-href="/ble-settings" />
        </ion-buttons>
        <ion-title>KMS</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="kms-content">
      <main class="kms-login-shell">
        <section class="kms-login-card" aria-labelledby="kms-login-title">
          <div class="kms-lock" aria-hidden="true">
            <ion-icon :icon="keyOutline" />
          </div>

          <div class="kms-heading">
            <h1 id="kms-login-title">{{ localize('@kmsLoginTitle') }}</h1>
          </div>

          <form class="kms-form" novalidate @submit.prevent="submit">
            <ion-input
              v-model="username"
              class="kms-input"
              fill="outline"
              :label="localize('@kmsUsername')"
              label-placement="stacked"
              :placeholder="localize('@kmsUsernamePlaceholder')"
              autocomplete="username"
              autocapitalize="none"
              :spellcheck="false"
              enterkeyhint="next"
              :disabled="submitting"
            />

            <ion-input
              v-model="password"
              class="kms-input"
              fill="outline"
              type="password"
              :label="localize('@kmsPassword')"
              label-placement="stacked"
              :placeholder="localize('@kmsPasswordPlaceholder')"
              autocomplete="current-password"
              enterkeyhint="go"
              :disabled="submitting"
            />

            <p v-if="messageKey" class="kms-message" role="alert">
              <ion-icon :icon="informationCircleOutline" aria-hidden="true" />
              <span>{{ localize(messageKey) }}</span>
            </p>

            <ion-button
              type="submit"
              expand="block"
              class="kms-submit"
              :disabled="submitting"
            >
              <ion-spinner v-if="submitting" name="crescent" />
              <span v-else>{{ localize('@kmsSignIn') }}</span>
            </ion-button>
          </form>

        </section>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon,
  IonInput, IonPage, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/vue';
import {
  informationCircleOutline, keyOutline,
} from 'ionicons/icons';
import { useLanguage } from '@/composables/useLanguage';
import { createBundledTranslations } from '@/utils/localization';

const { currentLanguage } = useLanguage();
const languages = createBundledTranslations();
const username = ref('');
const password = ref('');
const submitting = ref(false);
const messageKey = ref('');

const localize = (key: string): string => {
  if (!key.startsWith('@')) return key;
  return languages[currentLanguage.value][key.substring(1)] ?? key;
};

async function submit(): Promise<void> {
  messageKey.value = '';

  if (!username.value.trim() || !password.value) {
    messageKey.value = '@kmsCredentialsRequired';
    return;
  }

  // The KMS contract is not available yet. Keep credentials only in this view
  // and make the missing integration explicit instead of simulating a session.
  submitting.value = true;
  await Promise.resolve();
  submitting.value = false;
  password.value = '';
  messageKey.value = '@kmsApiUnavailable';
}
</script>

<style scoped>
.kms-header {
  box-shadow: none;
}

.kms-toolbar {
  --background: var(--ion-color-primary);
  --color: var(--ion-color-primary-contrast);
  --min-height: 82px;
  --padding-start: 8px;
  --padding-end: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
}

.kms-toolbar ion-back-button {
  width: 44px;
  height: 44px;
  --color: var(--ion-color-primary-contrast);
}

.kms-toolbar ion-title {
  font-size: 1.35rem;
}

.kms-content {
  --background: var(--app-page-background);
}

.kms-login-shell {
  display: grid;
  min-height: 100%;
  padding: 28px 18px;
  place-items: start center;
}

.kms-login-card {
  width: min(100%, 460px);
  padding: 28px 22px 22px;
  border: 1px solid var(--app-border);
  border-radius: 20px;
  background: var(--app-surface);
  box-shadow: var(--app-card-shadow);
}

.kms-lock {
  display: grid;
  width: 58px;
  height: 58px;
  margin: 0 auto 18px;
  border-radius: 18px;
  background: rgba(var(--ion-color-primary-rgb), 0.13);
  color: var(--ion-color-primary);
  font-size: 29px;
  place-items: center;
}

.kms-heading {
  margin-bottom: 24px;
  text-align: center;
}

.kms-heading h1 {
  margin: 0 0 9px;
  color: var(--app-text);
  font-size: 1.5rem;
}

.kms-form {
  display: grid;
  gap: 16px;
}

.kms-input {
  --background: var(--app-surface-subtle);
  --border-color: var(--app-border-strong);
  --border-radius: 12px;
  --highlight-color-focused: var(--ion-color-primary);
}

.kms-submit {
  min-height: 48px;
  margin: 2px 0 0;
  --border-radius: 12px;
  font-weight: 700;
}

.kms-message {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  margin: 0;
  padding: 11px 12px;
  border-radius: 10px;
  background: rgba(var(--ion-color-primary-rgb), 0.11);
  color: var(--app-text-secondary);
  font-size: 0.86rem;
  line-height: 1.4;
}

.kms-message ion-icon {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--ion-color-primary);
  font-size: 18px;
}

@media (min-width: 600px) {
  .kms-login-shell {
    padding-top: 48px;
  }

  .kms-login-card {
    padding: 34px 32px 28px;
  }
}
</style>
