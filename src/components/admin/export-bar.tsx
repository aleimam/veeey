import { pick } from '@/lib/admin-i18n';

/** Current string filter params → query string, so Export matches the on-screen filters. */
export function exportQs(sp: Record<string, string | string[] | undefined>): string {
  return new URLSearchParams(
    Object.entries(sp).filter(([, v]) => typeof v === 'string' && v !== '') as [string, string][],
  ).toString();
}

/**
 * Export + template buttons for an admin list (FR-ADM). Plain <a download> links
 * to the CSV API route, carrying the current filter query so the export matches
 * what's on screen. Import upload is added per-entity in DataToolsBar.
 */
export function ExportBar({ entity, locale, query = '' }: { entity: string; locale: string; query?: string }) {
  const t = pick(locale);
  const cls = 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={`/api/admin/export/${entity}${query ? `?${query}` : ''}`} className={cls}>{t('Export CSV', 'تصدير CSV')}</a>
      <a href={`/api/admin/export/${entity}?template=1`} className={cls}>{t('Template', 'قالب')}</a>
    </div>
  );
}
