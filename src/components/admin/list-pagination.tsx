import { pick } from '@/lib/admin-i18n';
import { listQs, totalPages, pageRange, type SP } from '@/lib/admin-list';

/**
 * Page navigation for an admin list. Shows the visible range + Prev/Next links
 * (and First/Last) that preserve all other params. Server component.
 */
export function ListPagination({
  page,
  perPage,
  total,
  sp,
  basePath,
  locale,
}: {
  page: number;
  perPage: number;
  total: number;
  sp: SP;
  basePath: string;
  locale: string;
}) {
  const t = pick(locale);
  const pages = totalPages(total, perPage);
  const { from, to } = pageRange(page, perPage, total);
  const cur = Math.min(page, pages);
  const link = (p: number) => `${basePath}${listQs(sp, { page: p })}`;
  const btn = 'rounded-md border border-border px-2.5 py-1 text-sm leading-6 hover:bg-surface';
  const disabled = 'pointer-events-none opacity-40';

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{t(`Showing ${from}–${to} of ${total}`, `عرض ${from}–${to} من ${total}`)}</span>
      {pages > 1 && (
        <div className="flex items-center gap-1.5">
          <a href={link(1)} className={`${btn} ${cur <= 1 ? disabled : ''}`} aria-disabled={cur <= 1}>« {t('First', 'الأولى')}</a>
          <a href={link(Math.max(1, cur - 1))} className={`${btn} ${cur <= 1 ? disabled : ''}`} aria-disabled={cur <= 1}>‹ {t('Prev', 'السابق')}</a>
          <span className="px-2">{t(`Page ${cur} / ${pages}`, `صفحة ${cur} / ${pages}`)}</span>
          <a href={link(Math.min(pages, cur + 1))} className={`${btn} ${cur >= pages ? disabled : ''}`} aria-disabled={cur >= pages}>{t('Next', 'التالي')} ›</a>
          <a href={link(pages)} className={`${btn} ${cur >= pages ? disabled : ''}`} aria-disabled={cur >= pages}>{t('Last', 'الأخيرة')} »</a>
        </div>
      )}
    </div>
  );
}
