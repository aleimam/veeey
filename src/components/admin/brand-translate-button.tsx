'use client';

import { useLocale } from 'next-intl';
import { startBrandTranslateAction } from '@/server/bulk-actions';
import { pick } from '@/lib/admin-i18n';

/** "Auto-translate names to Arabic" — starts the background worker job over
 *  every brand with an empty Arabic name (confirmed first; results land in the
 *  change log for review). */
export function BrandTranslateButton({ locale, back, missing }: { locale: string; back: string; missing: number }) {
  const tb = pick(useLocale());
  return (
    <form
      action={startBrandTranslateAction}
      onSubmit={(e) => {
        if (missing === 0) { e.preventDefault(); return; }
        if (!confirm(tb(
          `Auto-translate ${missing} brand name(s) to Arabic using AI? The job runs in the background in chunks — review the results afterwards (every change is in the change log).`,
          `ترجمة ${missing} اسم علامة تجارية إلى العربية بالذكاء الاصطناعي؟ تعمل المهمة في الخلفية على دفعات — راجع النتائج بعدها (كل تغيير مسجل في سجل التغييرات).`,
        ))) e.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="back" value={back} />
      <button disabled={missing === 0} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50">
        ✦ {tb(`Auto-translate names to Arabic (${missing})`, `ترجمة الأسماء إلى العربية (${missing})`)}
      </button>
    </form>
  );
}
