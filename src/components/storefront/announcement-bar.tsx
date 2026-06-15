import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/storefront/language-switcher';

export function AnnouncementBar() {
  const t = useTranslations('storefront.announcement');
  return (
    <div className="bg-slate text-slate-foreground">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs sm:px-6 lg:px-8">
        <p className="flex-1 text-pretty text-center sm:text-left">
          {t('promo')}
        </p>
        <LanguageSwitcher className="hidden items-center gap-2 sm:flex" />
      </div>
    </div>
  )
}
