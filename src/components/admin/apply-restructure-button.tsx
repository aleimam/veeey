'use client';

import { useLocale } from 'next-intl';
import { applyRestructureAction } from '@/server/bulk-actions';
import { pick } from '@/lib/admin-i18n';

/** One-click Apply for the taxonomy restructure — typed confirmation ("APPLY")
 *  since this rewrites live category assignments across the catalog. */
export function ApplyRestructureButton({ locale, touching }: { locale: string; touching: number }) {
  const tb = pick(useLocale());
  return (
    <form
      action={applyRestructureAction}
      onSubmit={(e) => {
        const typed = prompt(tb(
          `This applies the whole restructure plan (${touching} categories touched, products remapped, slugs redirected; merged duplicates are ARCHIVED — reversible via the logged snapshot). Type APPLY to confirm.`,
          `سيطبّق هذا خطة إعادة الهيكلة كاملة (${touching} فئة، مع نقل المنتجات وتحويل الروابط؛ التكرارات تُأرشف — قابلة للاسترجاع عبر السجل). اكتب APPLY للتأكيد.`,
        ));
        if (typed !== 'APPLY') e.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        {tb('Apply restructure', 'تطبيق إعادة الهيكلة')}
      </button>
    </form>
  );
}
