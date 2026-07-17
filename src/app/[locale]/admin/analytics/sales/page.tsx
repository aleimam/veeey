import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { salesAnalytics, salesPeriodRange, type PeriodPreset, type Metrics } from '@/lib/sales-analytics';
import { NON_BOOKED_STATUSES } from '@/lib/sales-analytics-core';
import { BarChart } from '@/components/admin/analytics/bar-chart';
import { AnalyticsDateRange, dateRangeLabels } from '@/components/admin/analytics/date-range';
import { resolveAnalyticsRange } from '@/lib/analytics-range';
import { salesExportHref, salesOrdersHref, type SalesPanel } from '@/lib/sales-links';

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

function MetricRow({ label, m, compare, locale, href }: { label: string; m: Metrics; compare?: Metrics; locale: string; href?: string }) {
  return (
    <div className="grid grid-cols-4 items-baseline gap-2 border-t border-border py-2 text-sm first:border-t-0">
      {/* S13: the label opens exactly these orders. Only rows an Orders filter
          can reproduce get a link — see SalesPanels. */}
      {href
        ? <Link href={href} className="font-medium text-primary hover:underline">{label}</Link>
        : <span className="font-medium text-foreground">{label}</span>}
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

/**
 * V6 audit S4: every panel states which orders it counts. The audit saw "417"
 * here against "511" on the Orders list with nothing on screen explaining the
 * gap — and the lifetime card doesn't even use the selected period.
 */
function Card({ title, basis, note, csvHref, csvLabel, children }: { title: string; basis: string; note?: string; csvHref?: string; csvLabel?: string; children: React.ReactNode }) {
  return (
    // min-w-0: a grid item defaults to min-width:auto, so wide content would
    // stretch the row and scroll the page sideways (V6 audit S5).
    <section className="min-w-0 rounded-lg border border-border p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {csvHref && (
          // Plain <a>: a CSV download must not be intercepted by the router,
          // and next-intl's Link would prepend a locale the API doesn't have.
          <a href={csvHref} className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted">
            {csvLabel}
          </a>
        )}
      </div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{basis}</p>
      {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

/**
 * V6 audit S2: an out-of-range window (e.g. ?from=2027-01-01) used to render
 * five cards of zeros, which reads like a broken page rather than an answer.
 */
function EmptyPeriod({ tb, previousCount, locale }: { tb: (en: string, ar: string) => string; previousCount: number; locale: string }) {
  return (
    <section className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-medium text-foreground">{tb('No orders in this period', 'لا توجد طلبات في هذه الفترة')}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {previousCount > 0
          ? tb(
              `The previous period had ${num(previousCount, locale)} orders.`,
              `الفترة السابقة بها ${num(previousCount, locale)} طلبًا.`,
            )
          : tb('Try a different date range.', 'جرّب نطاقًا زمنيًا آخر.')}
      </p>
    </section>
  );
}

/** S12: what the user sees while the numbers load, instead of a frozen page. */
function PanelsSkeleton({ tb }: { tb: (en: string, ar: string) => string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2" role="status" aria-busy="true">
      <span className="sr-only">{tb('Loading…', 'جارٍ التحميل…')}</span>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="min-w-0 animate-pulse rounded-lg border border-border p-4">
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
          <div className="mt-4 h-28 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

/** The DB-backed half, suspended so the heading + filter render immediately. */
async function SalesPanels({ preset, from, to, locale }: { preset: PeriodPreset; from?: string; to?: string; locale: string }) {
  const tb = pick(locale);
  const a = await salesAnalytics(preset, from, to);
  const basisBookings = tb('Bookings · selected period', 'الحجوزات · الفترة المحددة');
  const csvLabel = tb('CSV', 'CSV');

  // S13: exports + drill-throughs carry the SAME window the page resolved.
  const win = { preset, from, to };
  const csv = (panel: SalesPanel) => salesExportHref(panel, win);
  const bigEgp = a.bigThresholdEgp;

  // Every period-scoped panel derives from the same orders, so when there are
  // none they all say nothing — one honest empty state replaces the lot. The
  // lifetime card stays: it is a catalogue snapshot and still has an answer.
  const lifetime = (
    <Card
      title={tb('Customer size distribution', 'توزيع حجم العملاء')}
      basis={tb('All customers · lifetime, ignores the selected period', 'كل العملاء · مدى الحياة، لا يتأثر بالفترة المحددة')}
      note={tb('By lifetime spend (EGP)', 'حسب إجمالي الإنفاق (ج.م)')}
      csvHref={csv('lifetime-hist')}
      csvLabel={csvLabel}
    >
      <BarChart
        data={a.lifetimeHist.map((b) => ({ label: b.label, value: b.count }))}
        unit="count"
        emptyLabel={tb('No customers yet', 'لا يوجد عملاء بعد')}
      />
    </Card>
  );

  if (a.current.count === 0) {
    return (
      <div className="grid gap-4">
        <EmptyPeriod tb={tb} previousCount={a.previous.count} locale={locale} />
        <div className="grid gap-4 md:grid-cols-2">{lifetime}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={tb('This period vs previous', 'هذه الفترة مقابل السابقة')} basis={basisBookings} csvHref={csv('period')} csvLabel={csvLabel}>
        <MetricHeader tb={tb} />
        <MetricRow label={tb('Current', 'الحالية')} m={a.current} compare={a.previous} locale={locale} href={salesOrdersHref(a.range.start, a.range.end)} />
        <MetricRow label={tb('Previous', 'السابقة')} m={a.previous} locale={locale} href={salesOrdersHref(a.range.prevStart, a.range.prevEnd)} />
      </Card>

      {/* No drill-through here on purpose: "repeat" means "ordered before this
          period", while the Customers list's repeat segment means "≥2 orders
          ever". Linking them would show a different number with no explanation
          — the very confusion S4 was raised about. */}
      <Card title={tb('New vs repeat customers', 'العملاء الجدد مقابل المتكررين')} basis={basisBookings} note={tb('Repeat = ordered before this period', 'متكرر = طلب قبل هذه الفترة')} csvHref={csv('customer-type')} csvLabel={csvLabel}>
        <MetricHeader tb={tb} />
        <MetricRow label={tb('New / first-time', 'جدد / أول مرة')} m={a.newSeg} locale={locale} />
        <MetricRow label={tb('Repeat', 'متكررون')} m={a.repeatSeg} locale={locale} />
      </Card>

      <Card title={tb('Big vs normal orders', 'الطلبات الكبيرة مقابل العادية')} basis={basisBookings} note={tb(`Big = order ≥ ${formatEGP(bigEgp * 100)}`, `الكبيرة = طلب ≥ ${formatEGP(bigEgp * 100)}`)} csvHref={csv('order-size')} csvLabel={csvLabel}>
        <MetricHeader tb={tb} />
        {/* min is inclusive / max exclusive on both sides, so the two links
            partition the period's orders exactly as the cards do. */}
        <MetricRow label={tb('Big orders', 'طلبات كبيرة')} m={a.bigSeg} locale={locale} href={salesOrdersHref(a.range.start, a.range.end, { minTotal: bigEgp })} />
        <MetricRow label={tb('Normal orders', 'طلبات عادية')} m={a.normalSeg} locale={locale} href={salesOrdersHref(a.range.start, a.range.end, { maxTotal: bigEgp })} />
      </Card>

      <Card title={tb('Order size distribution', 'توزيع حجم الطلبات')} basis={basisBookings} note={tb('By order value (EGP)', 'حسب قيمة الطلب (ج.م)')} csvHref={csv('order-value-hist')} csvLabel={csvLabel}>
        <BarChart data={a.orderValueHist.map((b) => ({ label: b.label, value: b.count }))} unit="count" />
      </Card>

      {/* V5 audit F15: same palette as the order-size chart — the gold variant
          implied a meaning the color didn't have. */}
      {lifetime}
    </div>
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
  const from = resolved.from ?? undefined;
  const to = resolved.to ?? undefined;
  // Resolved without the DB, so the filter and its "vs previous" echo paint
  // immediately while the panels stream in (S12).
  const range = salesPeriodRange(preset, from, to);

  const dateFmt = (d: Date) => d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB');

  // S4: the same window + status basis these numbers use, as an Orders query.
  const reconcileHref = salesOrdersHref(range.start, range.end);

  return (
    <div className="max-w-4xl p-6">
      <Link href="/admin/analytics" className="text-sm text-primary hover:underline">← {tb('Analytics', 'التحليلات')}</Link>
      <h1 className="mb-1 mt-1 font-heading text-xl font-semibold">{tb('Sales & customers', 'المبيعات والعملاء')}</h1>
      {/* V5 audit F19: the two pages use DIFFERENT (deliberate) revenue bases —
          say so, or identical periods look like a calculation bug.
          V6 audit S4: and spell out the status basis, with a link that
          reproduces the number on the Orders list. */}
      <p className="mb-2 text-xs text-muted-foreground">
        {tb(
          'Revenue here counts all placed, non-cancelled orders (bookings). The Analytics dashboard reports delivered-only revenue, so the same period can differ.',
          'الإيراد هنا يشمل كل الطلبات المقدَّمة غير الملغاة (الحجوزات). لوحة التحليلات تعرض إيراد الطلبات المُسلَّمة فقط، لذا قد تختلف نفس الفترة.',
        )}
      </p>
      <details className="mb-4 rounded-lg border border-border bg-card text-xs">
        <summary className="cursor-pointer px-3 py-2 font-medium text-foreground">
          {tb('Which orders count here?', 'أي طلبات تُحتسب هنا؟')}
        </summary>
        <div className="border-t border-border px-3 py-2 text-muted-foreground">
          <p>
            {tb(
              'An order counts when it was PLACED inside the selected period and its status is not one of:',
              'يُحتسب الطلب إذا قُدِّم داخل الفترة المحددة ولم تكن حالته إحدى:',
            )}{' '}
            <span className="font-mono text-foreground">{NON_BOOKED_STATUSES.join(', ')}</span>.{' '}
            {tb(
              'The Orders list is unfiltered by default, so it shows a higher count.',
              'قائمة الطلبات غير مُصفّاة افتراضيًا، لذا تعرض عددًا أكبر.',
            )}
          </p>
          <Link href={reconcileHref} className="mt-1 inline-block font-medium text-primary hover:underline">
            {tb('Open these orders in the Orders list →', 'افتح هذه الطلبات في قائمة الطلبات ←')}
          </Link>
        </div>
      </details>

      <AnalyticsDateRange
        value={resolved}
        labels={dateRangeLabels(tb)}
        note={<>{dateFmt(range.start)} → {dateFmt(range.end)} · {tb('vs', 'مقابل')} {dateFmt(range.prevStart)} → {dateFmt(range.prevEnd)}</>}
      />

      {/* key: a new range must re-suspend, or Apply would sit on stale numbers
          with no sign anything is happening (S12). */}
      <Suspense key={`${preset}:${from ?? ''}:${to ?? ''}`} fallback={<PanelsSkeleton tb={tb} />}>
        <SalesPanels preset={preset} from={from} to={to} locale={locale} />
      </Suspense>
    </div>
  );
}
