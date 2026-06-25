import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/storefront/language-switcher';

export function AnnouncementBar({ text }: { text?: string }) {
  const t = useTranslations('storefront.announcement');
  return (
    <div className="bg-green-dark text-white">
      <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-2 text-xs sm:px-6 lg:px-8">
        <span className="hidden w-24 shrink-0 sm:block" aria-hidden="true" />
        <p className="flex-1 text-center font-medium tracking-[0.01em] text-white/90">{text || t('promo')}</p>
        <LanguageSwitcher className="flex w-24 shrink-0 items-center justify-end gap-2" />
      </div>
    </div>
  );
}
