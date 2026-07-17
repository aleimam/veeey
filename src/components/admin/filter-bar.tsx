import { pick } from '@/lib/admin-i18n';

/**
 * Generic admin list filter bar (FR-ADM). Renders a GET <form>, so filters live
 * in the URL — shareable, and the CSV export ("respects filters") reuses the same
 * params. Field names must match what the list service + export adapter read.
 */
export type FilterField =
  | { name: string; label: string; type: 'text'; placeholder?: string }
  | { name: string; label: string; type: 'date' }
  | { name: string; label: string; type: 'select'; options: { value: string; label: string }[] };

const cls = 'h-9 rounded-md border border-border bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring';

export function FilterBar({
  fields,
  values,
  locale,
  path,
  keep = {},
}: {
  fields: FilterField[];
  values: Record<string, string | undefined>;
  locale: string;
  path: string;
  /**
   * Active filters that have no field here (e.g. Orders' minTotal/productId,
   * arrived at from a Sales drill-through). Without carrying them, submitting
   * this form drops them: the list quietly widens while still saying "filtered".
   */
  keep?: Record<string, string | undefined>;
}) {
  const t = pick(locale);
  const kept = Object.entries(keep).filter(([, v]) => v);
  const active = fields.some((f) => values[f.name]) || kept.length > 0;
  return (
    <form className="mb-4 flex flex-wrap items-end gap-2">
      {kept.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-xs text-muted-foreground">
          {f.label}
          {f.type === 'select' ? (
            <select name={f.name} defaultValue={values[f.name] ?? ''} className={`${cls} min-w-36`}>
              <option value="">{t('All', 'الكل')}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input
              name={f.name}
              type={f.type === 'date' ? 'date' : 'text'}
              defaultValue={values[f.name] ?? ''}
              placeholder={f.type === 'text' ? f.placeholder : undefined}
              className={`${cls} min-w-40`}
            />
          )}
        </label>
      ))}
      <button className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">{t('Filter', 'تصفية')}</button>
      {active && <a href={`/${locale}/admin/${path}`} className="h-9 rounded-md border border-border px-3 text-sm leading-9 hover:bg-surface">{t('Clear', 'مسح')}</a>}
    </form>
  );
}
