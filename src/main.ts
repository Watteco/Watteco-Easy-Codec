import { createApp } from 'vue'
import App from './App.vue'
import router from './router';

import { IonicVue } from '@ionic/vue';
import { isPlatform } from '@ionic/vue';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { OsaKeyStore } from './plugins/osaKeyStore';
import { initializeTheme } from './composables/useTheme';
import { setStatusBarStyle } from './utils/statusBar';
import { appVersion } from './utils/appVersion';
import { createDiagnosticLogger, installGlobalDiagnosticHandlers } from './utils/diagnosticLogger';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';
import '@ionic/vue/css/palettes/dark.class.css';

/* Theme variables */
import './theme/variables.css';

initializeTheme();

const app = createApp(App)
  .use(IonicVue)
  .use(router);
const applicationLogger = createDiagnosticLogger('application');
installGlobalDiagnosticHandlers(app);
applicationLogger.info('Application started', {
  version: appVersion,
  platform: Capacitor.getPlatform(),
  native: Capacitor.isNativePlatform(),
});

if (Capacitor.isNativePlatform()) {
  void OsaKeyStore.purgeExpired().catch(error => {
    applicationLogger.warn('Expired OSA key cleanup failed', { error });
    // A failed cleanup must not prevent the application from starting.
  });

  if (Capacitor.getPlatform() === 'android') {
    void StatusBar.setOverlaysWebView({ overlay: true }).catch(error => {
      applicationLogger.warn('Android status bar configuration failed', { error });
      // Keep the application usable if the native status bar cannot be configured.
    });
  }

  setStatusBarStyle('dark');
}

router.isReady().then(() => {
  app.mount('#app');
  applicationLogger.info('Application mounted', { route: router.currentRoute.value.fullPath });
});
