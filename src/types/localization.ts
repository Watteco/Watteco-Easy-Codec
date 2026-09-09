export const LANGUAGE_CODES = ['en', 'fr'] as const;

export type LanguageCode = typeof LANGUAGE_CODES[number];
export type Translations = Record<string, string>;

export const isLanguageCode = (value: string): value is LanguageCode =>
  LANGUAGE_CODES.some(languageCode => languageCode === value);
