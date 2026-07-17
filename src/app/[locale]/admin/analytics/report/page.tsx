import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from '@/components/admin/ui';
import { REPORT_DIMENSIONS, REPORT_METRICS, resolveReportConfig, runReport } from '@/lib/analytics-report';
import { dateRangeLabels } from '@/components/admin/analytics/date-range';
import { Download } from 'lucide-react';

type SP = { dimension?: string; metric?: string; days?: string; preset?: string; from?: string; to?: string; fdim?: string; fval?: string };

export default async function ReportBuilderPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  await requirePermission('finance.read');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const ar = locale === 'ar';

  const cfg = resolveReportConfig(sp);
  const rows = await runReport(cfg);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const metric = REPORT_METRICS.find((m) => m.key === cfg.metric)!;
  const dim = REPORT_DIMENSIONS.find((d) => d.key === cfg.dimension)!;
  const lbl = (o: { labelEn: string; labelAr: string }) => (ar ? o.labelAr : o.labelEn);

  const exportHref =
    `/api/admin/analytics/export?report=custom&dimension=${cfg.dimension}&metric=${cfg.metric}&preset=${cfg.range.preset}` +
    (cfg.range.from ? `&from=${cfg.range.from}&to=${cfg.range.to}` : '') +
    (cfg.filterDim ? `&fdim=${cfg.filterDim}&fval=${encodeURIComponent(cfg.filterVal)}` : '');

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">{tb('Report builder', 'منشئ التقارير')}</h1>
        <Link href="/admin/analytics" className="text-sm text-primary hover:underline">← {tb('Back to dashboard', 'العودة للوحة')}</Link>
      </div>

      <form method="get" className="mb-6 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{tb('Metric', 'المقياس')}</span>
          <select name="metric" defaultValue={cfg.metric} className={inputCls}>
            {REPORT_METRICS.map((m) => <option key={m.key} value={m.key}>{lbl(m)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{tb('Break down by', 'التقسيم حسب')}</span>
          <select name="dimension" defaultValue={cfg.dimension} className={inputCls}>
            {REPORT_DIMENSIONS.map((d) => <option key={d.key} value={d.key}>{lbl(d)}</option>)}
          </select>
        </label>
        {/* Same range contract as the analytics dashboard + Sales (V5 audit F10/F11) */}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{tb('Range', 'المدى')}</span>
          <select name="preset" defaultValue={cfg.range.preset} className={inputCls}>
            {(['mtd', '7d', '30d', '90d', 'custom'] as const).map((p) => (
              <option key={p} value={p}>{dateRangeLabels(tb).presets[p]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{tb('From / To (custom)', 'من / إلى (مخصص)')}</span>
          <div className="flex gap-2">
            <input type="date" name="from" defaultValue={cfg.range.from ?? ''} className={inputCls} />
            <input type="date" name="to" defaultValue={cfg.range.to ?? ''} min={cfg.range.from ?? undefined} className={inputCls} />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{tb('Filter by (optional)', 'تصفية حسب (اختياري)')}</span>
          <select name="fdim" defaultValue={cfg.filterDim ?? ''} className={inputCls}>
            <option value="">{tb('— none —', '— بدون —')}</option>
            {REPORT_DIMENSIONS.map((d) => <option key={d.key} value={d.key}>{lbl(d)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{tb('Filter value', 'قيمة التصفية')}</span>
          <div className="flex gap-2">
            <input name="fval" defaultValue={cfg.filterVal} placeholder={tb('e.g. mobile / EG', 'مثال: mobile / EG')} className={inputCls} />
            <button className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Run', 'تشغيل')}</button>
          </div>
        </label>
      </form>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {tb(`${metric.labelEn} by ${dim.labelEn}`, `${metric.labelAr} حسب ${dim.labelAr}`)}
          {cfg.filterDim && cfg.filterVal ? <span className="text-muted-foreground"> · {lbl(REPORT_DIMENSIONS.find((d) => d.key === cfg.filterDim)!)} = {cfg.filterVal}</span> : null}
        </h2>
        {/* V5 audit F20: styled as a download action; the endpoint names the file
            after metric/dimension/window/filter so it matches this view. */}
        <a href={exportHref} download className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary">
          <Download size={13} aria-hidden /> {tb('Export CSV', 'تصدير CSV')}
        </a>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            {/* V5 audit F16: ONE metric column (bar + value together) — the metric
                name headed the bar and a separate "Value" column duplicated it. */}
            <tr><th className="p-2 text-start">{lbl(dim)}</th><th className="w-2/3 p-2 text-start">{lbl(metric)}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                <td className="max-w-0 truncate p-2" title={r.key}>{r.key}</td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 flex-1 overflow-hidden rounded bg-surface"><div className="h-full rounded bg-primary" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></div>
                    <span className="w-16 shrink-0 text-end font-medium">{r.value}</span>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">{tb('No data for this selection yet.', 'لا توجد بيانات لهذا الاختيار بعد.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{tb('Bookmark or share this page’s URL to save the report. Bot traffic is excluded.', 'احفظ أو شارك رابط هذه الصفحة لحفظ التقرير. تُستبعد زيارات الروبوتات.')}</p>
    </div>
  );
}
