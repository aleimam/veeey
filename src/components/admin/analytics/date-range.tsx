import type { ReactNode } from 'react';
import { inputCls } from '@/components/admin/ui';
import type { ResolvedRange, AnalyticsPreset } from '@/lib/analytics-range';

/**
 * THE analytics period control (V5 audit F11) — one component, identical
 * presets / custom-range / URL behavior on the dashboard, Sales and the
 * Report builder. Server-rendered GET form: state lives in the URL, so every
 * view is shareable (F10). The To input is constrained to ≥ From and inverted
 * input is auto-swapped upstream with visible feedback (F9).
 */
export type DateRangeLabels = {
  period: string;
  from: string;
  to: string;
  apply: string;
  swapped: string; // shown when an inverted range was corrected
  presets: Record<AnalyticsPreset, string>;
};

const PRESETS: AnalyticsPreset[] = ['mtd', '7d', '30d', '90d', 'custom'];

/** Shared bilingual labels so all three pages read identically (F11). */
export const dateRangeLabels = (tb: (en: string, ar: string) => string): DateRangeLabels => ({
  period: tb('Period', 'الفترة'),
  from: tb('From', 'من'),
  to: tb('To', 'إلى'),
  apply: tb('Apply', 'تطبيق'),
  swapped: tb('Date range was reversed — corrected.', 'تم عكس نطاق التاريخ — صُحِّح.'),
  presets: {
    mtd: tb('Month to date', 'الشهر حتى تاريخه'),
    '7d': tb('Last 7 days', 'آخر ٧ أيام'),
    '30d': tb('Last 30 days', 'آخر ٣٠ يومًا'),
    '90d': tb('Last 90 days', 'آخر ٩٠ يومًا'),
    custom: tb('Custom range', 'نطاق مخصص'),
  },
});

export function AnalyticsDateRange({
  value,
  labels,
  hidden = {},
  note,
  standalone = true,
}: {
  value: ResolvedRange;
  labels: DateRangeLabels;
  /** Extra query params to persist through the GET submit (e.g. report dimension/metric). */
  hidden?: Record<string, string>;
  /** Page-specific echo (e.g. Sales' "vs previous" range). */
  note?: ReactNode;
  /** false = render only the fields, for embedding inside an existing GET form. */
  standalone?: boolean;
}) {
  const today = new Date();
  const max = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const fields = (
    <>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="text-sm font-medium">
        {labels.period}
        <select name="preset" defaultValue={value.preset} className={`${inputCls} w-44`}>
          {PRESETS.map((p) => (
            <option key={p} value={p}>{labels.presets[p]}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        {labels.from}
        <input type="date" name="from" defaultValue={value.from ?? ''} max={max} className={inputCls} />
      </label>
      <label className="text-sm font-medium">
        {labels.to}
        {/* F9: To can't precede From (server-rendered min; auto-swap covers manual URLs) */}
        <input type="date" name="to" defaultValue={value.to ?? ''} min={value.from ?? undefined} max={max} className={inputCls} />
      </label>
      <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        {labels.apply}
      </button>
      {note && <span className="pb-2 text-xs text-muted-foreground">{note}</span>}
      {value.swapped && (
        <span role="status" className="rounded-md bg-gold/15 px-2 py-1 text-xs font-medium text-foreground">{labels.swapped}</span>
      )}
    </>
  );

  if (!standalone) return fields;
  return <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">{fields}</form>;
}
