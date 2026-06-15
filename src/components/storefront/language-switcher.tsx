'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * Locale switcher (FR-I18N). Swaps the locale on the *current* path via next-intl
 * (usePathname returns the locale-stripped path; Link re-adds the chosen locale).
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const pathname = usePathname();
  const locale = useLocale();
  const cls = (active: boolean) =>
    active ? 'font-medium text-slate-foreground' : 'text-slate-foreground/70 transition-colors hover:text-lime';

  return (
    <div className={className ?? 'flex items-center gap-2'} aria-label="Language switch">
      <Link href={pathname} locale="en" className={cls(locale === 'en')}>EN</Link>
      <span className="text-slate-foreground/40">|</span>
      <Link href={pathname} locale="ar" lang="ar" className={cls(locale === 'ar')}>العربية</Link>
    </div>
  );
}
