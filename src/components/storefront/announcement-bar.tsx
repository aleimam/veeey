import { getLocale } from 'next-intl/server';
import { pick } from '@/lib/admin-i18n';

/** Chewy-pattern promo pill — sits above the header. `text` (admin home
 *  announcement) overrides the default welcome offer. */
export async function AnnouncementBar({ text }: { text?: string }) {
  const locale = await getLocale();
  const t = pick(locale);
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-3 sm:px-6">
      <div className="rounded-full border border-[color:var(--slate-border)] bg-white px-5 py-2.5 text-center text-[13.5px] font-semibold text-green-dark">
        {text || t('Free EGP 100 gift card with your first EGP 1,500+ order', 'بطاقة هدية بقيمة ١٠٠ ج.م مع أول طلب فوق ١٥٠٠ ج.م')}{' '}
        · <span className="text-gold-deep">{t('Use code WELCOME100', 'استخدم الكود WELCOME100')}</span>
      </div>
    </div>
  );
}
