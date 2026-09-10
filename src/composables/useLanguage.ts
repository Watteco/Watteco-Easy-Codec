import { readonly, ref } from 'vue';
import { isLanguageCode } from '@/types/localization';
import type { LanguageCode } from '@/types/localization';

const STORAGE_KEY = 'easycodec.language';

function initialLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isLanguageCode(stored)) return stored;
  } catch {
    // Fall back to the browser language when storage is unavailable.
  }
  const browserLanguage = navigator.language?.split('-')[0];
  return isLanguageCode(browserLanguage) ? browserLanguage : 'en';
}

const currentLanguage = ref<LanguageCode>(initialLanguage());

function changeLanguage(language: LanguageCode) {
  currentLanguage.value = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Keep the selected language for this session if persistence fails.
  }
}

export function useLanguage() {
  return { currentLanguage: readonly(currentLanguage), changeLanguage };
}
