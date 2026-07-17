import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { salesAnalytics, type PeriodPreset, type Metrics } from '@/lib/sales-analytics';
import { BarChart } from '@/components/admin/analytics/bar-chart';
import { AnalyticsDateRange, dateRangeLabels } from '@/components/admin/analytics/date-range';
import { resolveAnalyticsRange } from '@/lib/analytics-range';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const num = (n: number, locale: string) => n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US');
const deltaOf = (cur: number, prev: number): { txt: string; cls: string } => {
  if (!prev) return cur ? { txt: '▲ new', cls: 'text-primary' } : { txt: '—', cls: 'text-muted-foreground' };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { txt: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%`, cls: pct >= 0 ? 'text-primary' : 'text-destructive' };
};

function Cell({ value, cur, prev, egp, locale }: { value: number; cur?: number; prev?: number; egp?: boolean; locale: string }) {
  const d = cur != null && prev != null ? deltaOf(cur, prev) : null;
  return (
    <span>{egp ? formatEGP(value) : num(value, locale)}{d && <span className={`ms-1 text-xs ${d.cls}`}>{d.txt}</span>}</span>
  );
}

function MetricRow({ label, m, compare, locale }: { label: string; m: Metrics; compare?: Metrics; locale: string }) {
  return (
    <div className="grid grid-cols-4 items-baseline gap-2 border-t border-border py-2 text-sm first:border-t-0">
      <span className="font-medium text-foreground">{label}</span>
      <Cell value={m.count} cur={compare && m.count} prev={compare?.count} locale={locale} />
      <Cell value={m.aov} cur={compare && m.aov} prev={compare?.aov} egp locale={locale} />
      <Cell value={m.revenue} cur={compare && m.revenue} prev={compare?.revenue} egp locale={locale} />
    </div>
  );
}

function MetricHeader({ tb }: { tb: (en: string, ar: string) => string }) {
  return (
    <div className="grid grid-cols-4 gap-2 pb-1 text-xs uppercase text-muted-foreground">
      <span /><span>{tb('Orders', 'الطلبات')}</span><span>{tb('AOV', 'متوسط الطلب')}</span><span>{tb('Revenue', 'الإيراد')}</span>
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="mb-1 font-heading text-base font-semibold">{title}</h2>
      {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

export default async function SalesAnalyticsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  await requirePermission('finance.read');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  // Shared range contract (V5 audit F11): same params/labels as the analytics
  // dashboard + Report builder; inverted custom bounds auto-swap (F9).
  const resolved = resolveAnalyticsRange(
    { preset: one(sp.preset), from: one(sp.from), to: one(sp.to) },
    { defaultPreset: 'mtd' },
  );
  const preset = resolved.preset as PeriodPreset;
  const a = await salesAnalytics(preset, resolved.from ?? undefined, resolved.to ?? undefined);

  const dateFmt = (d: Date) => d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB');

  return (
    <div className="max-w-4xl p-6">
      <Link href="/admin/analytics" className="text-sm text-primary hover:underline">← {tb('Analytics', 'التحليلات')}</Link>
      <h1 className="mb-4 mt-1 font-heading text-xl font-semibold">{tb('Sales & customers', 'المبيعات والعملاء')}</h1>

      <AnalyticsDateRange
        value={resolved}
        labels={dateRangeLabels(tb)}
        note={<>{dateFmt(a.range.start)} → {dateFmt(a.range.end)} · {tb('vs', 'مقابل')} {dateFmt(a.range.prevStart)} → {dateFmt(a.range.prevEnd)}</>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={tb('This period vs previous', 'هذه الفترة مقابل السابقة')}>
          <MetricHeader tb={tb} />
          <MetricRow label={tb('Current', 'الحالية')} m={a.current} compare={a.previous} locale={locale} />
          <MetricRow label={tb('Previous', 'السابقة')} m={a.previous} locale={locale} />
        </Card>

        <Card title={tb('New vs repeat customers', 'العملاء الجدد مقابل المتكررين')}>
          <MetricHeader tb={tb} />
          <MetricRow label={tb('New / first-time', 'جدد / أول مرة')} m={a.newSeg} locale={locale} />
          <MetricRow label={tb('Repeat', 'متكررون')} m={a.repeatSeg} locale={locale} />
        </Card>

        <Card title={tb('Big vs normal orders', 'الطلبات الكبيرة مقابل العادية')} note={tb(`Big = order ≥ ${formatEGP(a.bigThresholdEgp * 100)}`, `الكبيرة = طلب ≥ ${formatEGP(a.bigThresholdEgp * 100)}`)}>
          <MetricHeader tb={tb} />
          <MetricRow label={tb('Big orders', 'طلبات كبيرة')} m={a.bigSeg} locale={locale} />
          <MetricRow label={tb('Normal orders', 'طلبات عادية')} m={a.normalSeg} locale={locale} />
        </Card>

        <Card title={tb('Order size distribution', 'توزيع حجم الطلبات')} note={tb('Orders in the period, by value (EGP)', 'طلبات الفترة حسب القيمة (ج.م)')}>
          <BarChart data={a.orderValueHist.map((b) => ({ label: b.label, value: b.count }))} unit="count" />
        </Card>

        <Card title={tb('Customer size distribution', 'توزيع حجم العملاء')} note={tb('All customers, by lifetime spend (EGP)', 'كل العملاء حسب إجمالي الإنفاق (ج.م)')}>
          <BarChart data={a.lifetimeHist.map((b) => ({ label: b.label, value: b.count }))} unit="count" color="var(--gold, #FFC000)" />
        </Card>
      </div>
    </div>
  );
}
