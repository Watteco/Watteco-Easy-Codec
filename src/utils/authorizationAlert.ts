import { alertController } from '@ionic/vue';

const AUTHORIZATION_SUPPORT_URL = 'https://support.watteco.com';

export async function presentAuthorizationDeniedAlert(localize: (key: string) => string): Promise<void> {
  const alert = await alertController.create({
    header: localize('@authorizationDeniedTitle'),
    message: localize('@authorizationDeniedMessage'),
    buttons: [
      {
        text: localize('@authorizationDismiss'),
        role: 'cancel',
      },
      {
        text: localize('@authorizationLearnMore'),
        handler: () => {
          const supportWindow = window.open(AUTHORIZATION_SUPPORT_URL, '_blank', 'noopener,noreferrer');
          if (!supportWindow) window.location.assign(AUTHORIZATION_SUPPORT_URL);
        },
      },
    ],
  });

  await alert.present();
}
