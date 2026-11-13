import type { LanguageCode, Translations } from '@/types/localization';

import en from '../../public/localisation/en_US.json';
import fr from '../../public/localisation/fr_FR.json';

/**
 * Return a fresh language map populated at build time.
 *
 * Views used to start with empty maps and render the raw `@key` before their
 * asynchronous localization requests completed. Older iOS WebViews can retain
 * strips of that first IonLabel paint after Vue replaces the text.
 */
export function createBundledTranslations(): Record<LanguageCode, Translations> {
  return { en: { ...en }, fr: { ...fr } };
}
