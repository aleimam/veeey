/**
 * Admin UI bilingual helper. The admin panel is fully bilingual (EN/AR). Admin
 * chrome strings are dev-managed (not store content), so rather than the message
 * catalog they're co-located in the code as `t(en, ar)` pairs — type-safe and
 * verified by `tsc`/`build` (no runtime missing-key risk on dynamic admin pages).
 *
 * Server components: `const t = pick(locale)` (locale from awaited params).
 * Client components: `const t = pick(useLocale())` (next-intl useLocale).
 */
export function pick(locale: string) {
  const ar = locale === 'ar';
  return (en: string, arText: string): string => (ar ? arText : en);
}

export type Pick = ReturnType<typeof pick>;
