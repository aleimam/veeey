import { defineRouting } from 'next-intl/routing';

/**
 * Bilingual routing — English (default) + Arabic, locale always in the URL
 * (`/en/...`, `/ar/...`). Arabic renders RTL (see the locale layout). FR-I18N-01.
 */
export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

export const localeDirection: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};
