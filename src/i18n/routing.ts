import { defineRouting } from 'next-intl/routing';

/**
 * Bilingual routing — English (default) + Arabic, locale always in the URL
 * (`/en/...`, `/ar/...`). Arabic renders RTL (see the locale layout). FR-I18N-01.
 */
export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'always',
  /**
   * Remember the visitor's choice for a YEAR.
   *
   * Without an explicit `maxAge` the NEXT_LOCALE cookie is written as a SESSION
   * cookie (`NEXT_LOCALE=en; Path=/; SameSite=lax` — no Expires), so it dies when
   * the browser closes. On the next visit locale detection falls back to the
   * `Accept-Language` header, which for Egyptian visitors is Arabic — so anyone
   * who picked English was silently switched back to Arabic every session, over
   * and over. The cookie itself was always honoured; it just never survived.
   */
  localeCookie: {
    maxAge: 60 * 60 * 24 * 365,
  },
});

export type Locale = (typeof routing.locales)[number];

export const localeDirection: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};
