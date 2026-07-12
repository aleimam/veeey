import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { inputCls } from '@/components/admin/ui';
import { salesAnalytics, type PeriodPreset, type Metrics } from '@/lib/sales-analytics';
import { BarChart } from '@/components/admin/analytics/bar-chart';

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

  const preset = (['mtd', '7d', '30d', '90d', 'custom'] as const).find((p) => p === one(sp.preset)) ?? 'mtd';
  const from = one(sp.from);
  const to = one(sp.to);
  const a = await salesAnalytics(preset, from, to);

  const dateFmt = (d: Date) => d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB');
  const presets: [PeriodPreset, string][] = [
    ['mtd', tb('Month to date', 'الشهر حتى تاريخه')],
    ['7d', tb('Last 7 days', 'آخر ٧ أيام')],
    ['30d', tb('Last 30 days', 'آخر ٣٠ يومًا')],
    ['90d', tb('Last 90 days', 'آخر ٩٠ يومًا')],
    ['custom', tb('Custom range', 'نطاق مخصص')],
  ];

  return (
    <div className="max-w-4xl p-6">
      <Link href="/admin/analytics" className="text-sm text-primary hover:underline">← {tb('Analytics', 'التحليلات')}</Link>
      <h1 className="mb-4 mt-1 font-heading text-xl font-semibold">{tb('Sales & customers', 'المبيعات والعملاء')}</h1>

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
        <label className="text-sm font-medium">{tb('Period', 'الفترة')}
          <select name="preset" defaultValue={preset} className={`${inputCls} w-44`}>
            {presets.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">{tb('From', 'من')}<input type="date" name="from" defaultValue={from ?? ''} className={inputCls} /></label>
        <label className="text-sm font-medium">{tb('To', 'إلى')}<input type="date" name="to" defaultValue={to ?? ''} className={inputCls} /></label>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Apply', 'تطبيق')}</button>
        <span className="pb-2 text-xs text-muted-foreground">
          {dateFmt(a.range.start)} → {dateFmt(a.range.end)} · {tb('vs', 'مقابل')} {dateFmt(a.range.prevStart)} → {dateFmt(a.range.prevEnd)}
        </span>
      </form>

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
