import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { funnelCounts, kpis, commerceMetrics, ordersBySource } from '@/lib/analytics-service';
import { visitorTimeSeries, audienceBreakdown, newVsReturning, engagement, cartFunnel, searchInsights, productPerformance } from '@/lib/analytics-insights';
import { buildFunnel } from '@/lib/analytics';
import { formatEGP } from '@/lib/format';
import { pick } from '@/lib/admin-i18n';
import { sourceLabel } from '@/lib/attribution';
import { requirePermission } from '@/lib/auth-guards';
import { TrafficChart } from '@/components/admin/analytics/traffic-chart';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const dwell = (ms: number) => (ms >= 60000 ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s` : `${(ms / 1000).toFixed(1)}s`);

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const RANGES = [7, 30, 90] as const;

function Bars({ rows }: { rows: Array<{ key: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) return <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">—</div>;
  return (
    <div className="space-y-1.5 rounded-lg border border-border p-3">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 text-sm">
          <div className="w-24 truncate" title={r.key}>{r.key}</div>
          <div className="h-3 flex-1 overflow-hidden rounded bg-surface"><div className="h-full rounded bg-primary" style={{ width: `${Math.max(3, (r.count / max) * 100)}%` }} /></div>
          <div className="w-10 text-end text-xs font-medium">{r.count}</div>
        </div>
      ))}
    </div>
  );
}

export default async function AnalyticsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ days?: string }> }) {
  await requirePermission('finance.read');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const ar = locale === 'ar';
  const days = RANGES.includes(Number(sp.days) as (typeof RANGES)[number]) ? Number(sp.days) : 30;

  const [counts, k, m, sources, ts, aud, nr, eng, cf, si, pp] = await Promise.all([
    funnelCounts(days), kpis(days), commerceMetrics({ days }), ordersBySource(days),
    visitorTimeSeries(days), audienceBreakdown(days), newVsReturning(days), engagement(days), cartFunnel(days), searchInsights(days), productPerformance(days),
  ]);
  const funnel = buildFunnel(counts);
  const topN = funnel[0].count || 1;

  const now = new Date();
  const since = ymd(new Date(now.getTime() - days * 86_400_000));
  const ordersRange = `/admin/orders?from=${since}&to=${ymd(now)}`;

  const trafficCards = [
    { label: tb('Visitors', 'الزوّار'), value: String(eng.visitors) },
    { label: tb('Pageviews', 'مشاهدات الصفحات'), value: String(eng.pageviews) },
    { label: tb('New visitors', 'زوّار جدد'), value: String(nr.new) },
    { label: tb('Returning', 'عائدون'), value: String(nr.returning) },
    { label: tb('Bounce rate', 'معدل الارتداد'), value: pct(eng.bounceRate) },
    { label: tb('Avg. time on page', 'متوسط الوقت بالصفحة'), value: eng.avgDwellMs > 0 ? dwell(eng.avgDwellMs) : '—' },
  ];
  const commerceCards: { label: string; value: string; href?: string }[] = [
    { label: tb('Revenue (delivered)', 'الإيرادات (تم التسليم)'), value: formatEGP(k.revenue), href: ordersRange },
    { label: tb('Delivered orders', 'الطلبات المُسلَّمة'), value: String(k.deliveredOrders), href: ordersRange },
    { label: tb('Average order value', 'متوسط قيمة الطلب'), value: formatEGP(k.aov) },
    { label: tb('Conversion (orders / sessions)', 'التحويل (الطلبات / الجلسات)'), value: m.conversionRate === null ? '—' : pct(m.conversionRate) },
    { label: tb('Repeat-purchase rate', 'معدل الشراء المتكرر'), value: m.repeatPurchaseRate === null ? '—' : pct(m.repeatPurchaseRate) },
    { label: tb('Customers (total)', 'العملاء (الإجمالي)'), value: String(k.customers), href: '/admin/customers' },
  ];
  const maxMonthRevenue = Math.max(1, ...m.revenueByMonth.map((b) => b.revenue));
  const exports: { key: string; label: string }[] = [
    { key: 'traffic', label: tb('Traffic', 'الزيارات') },
    { key: 'audience', label: tb('Audience', 'الجمهور') },
    { key: 'pages', label: tb('Pages', 'الصفحات') },
    { key: 'searches', label: tb('Searches', 'عمليات البحث') },
    { key: 'products', label: tb('Products', 'المنتجات') },
  ];

  const card = (c: { label: string; value: string; href?: string }) => {
    const inner = (<><div className="text-xs text-muted-foreground">{c.label}</div><div className="mt-1 text-lg font-semibold text-foreground">{c.value}</div></>);
    return c.href
      ? <Link key={c.label} href={c.href} className="block rounded-lg border border-border p-3 transition hover:border-primary hover:shadow-sm">{inner}</Link>
      : <div key={c.label} className="rounded-lg border border-border p-3">{inner}</div>;
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">{tb('Analytics', 'التحليلات')}</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/analytics/sales" className="text-sm font-medium text-primary hover:underline">{tb('Sales & customers →', 'المبيعات والعملاء ←')}</Link>
          <Link href="/admin/analytics/report" className="text-sm font-medium text-primary hover:underline">{tb('Report builder →', 'منشئ التقارير ←')}</Link>
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            {RANGES.map((d) => (
              <Link key={d} href={`/admin/analytics?days=${d}`} className={`rounded-md px-3 py-1 text-sm ${d === days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface'}`}>
                {tb(`${d}d`, `${d} يوم`)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Traffic KPIs */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{trafficCards.map(card)}</div>
      {/* Commerce KPIs */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{commerceCards.map(card)}</div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">{tb('Traffic over time', 'الزيارات عبر الوقت')}</h2>
        <div className="rounded-lg border border-border p-4">
          <TrafficChart series={ts} labels={{ visitors: tb('Visitors', 'الزوّار'), pageviews: tb('Pageviews', 'مشاهدات الصفحات') }} />
        </div>
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold">{tb('Conversion funnel', 'مسار التحويل')}</h2>
          <div className="space-y-2 rounded-lg border border-border p-4">
            {funnel.map((s, i) => (
              <div key={s.label} className="flex items-center gap-3 text-sm">
                <div className="w-28 text-muted-foreground">{s.label}</div>
                <div className="h-5 flex-1 overflow-hidden rounded bg-surface"><div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, Math.max(2, (s.count / topN) * 100))}%` }} /></div>
                <div className="w-16 text-end font-medium">{s.count}</div>
                <div className="w-14 text-end text-xs text-muted-foreground">{i === 0 ? '—' : pct(s.rate)}</div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold">{tb('Cart & checkout', 'السلة والدفع')}</h2>
          <div className="space-y-3 rounded-lg border border-border p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{tb('Sessions that added to cart', 'جلسات أضافت للسلة')}</span><span className="font-medium">{cf.cartSessions}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{tb('Reached checkout', 'وصلت للدفع')}</span><span className="font-medium">{cf.checkoutSessions}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{tb('Storefront orders', 'طلبات المتجر')}</span><span className="font-medium">{cf.webOrders}</span></div>
            <div className="flex justify-between border-t border-border pt-2"><span className="text-muted-foreground">{tb('Cart abandonment', 'هجر السلة')}</span><span className="font-semibold text-destructive">{pct(cf.cartAbandonment)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{tb('Checkout abandonment', 'هجر الدفع')}</span><span className="font-semibold text-destructive">{pct(cf.checkoutAbandonment)}</span></div>
          </div>
        </section>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">{tb('Audience', 'الجمهور')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{tb('Device', 'الجهاز')}</h3><Bars rows={aud.devices} /></div>
          <div><h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{tb('Country', 'الدولة')}</h3><Bars rows={aud.countries} /></div>
          <div><h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{tb('Browser', 'المتصفح')}</h3><Bars rows={aud.browsers} /></div>
          <div><h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{tb('OS', 'نظام التشغيل')}</h3><Bars rows={aud.os} /></div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{tb('Device/geo/OS populate as consented visitors arrive (captured only under full cookie consent).', 'تظهر بيانات الجهاز/الموقع/النظام عند وصول زوّار وافقوا على ملفات التتبّع الكاملة.')}</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">{tb('Top pages by time on page', 'أهم الصفحات حسب وقت البقاء')}</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground"><tr><th className="p-2 text-start">{tb('Page', 'الصفحة')}</th><th className="p-2">{tb('Views', 'المشاهدات')}</th><th className="p-2">{tb('Avg. time', 'متوسط الوقت')}</th></tr></thead>
            <tbody>
              {eng.topPages.map((p) => (
                <tr key={p.path} className="border-t border-border hover:bg-surface"><td className="p-2"><span className="font-mono text-xs">{p.path}</span></td><td className="p-2 text-center">{p.views}</td><td className="p-2 text-center text-muted-foreground">{p.avgDwellMs > 0 ? dwell(p.avgDwellMs) : '—'}</td></tr>
              ))}
              {eng.topPages.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">{tb('No page views yet.', 'لا توجد مشاهدات بعد.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">{tb('Revenue by month (last 6, delivered)', 'الإيرادات حسب الشهر (آخر 6 أشهر، تم التسليم)')}</h2>
        <div className="space-y-2 rounded-lg border border-border p-4">
          {m.revenueByMonth.map((b) => {
            const mm = String(b.month + 1).padStart(2, '0');
            const lastDay = String(new Date(b.year, b.month + 1, 0).getDate()).padStart(2, '0');
            return (
              <Link key={b.key} href={`/admin/orders?from=${b.year}-${mm}-01&to=${b.year}-${mm}-${lastDay}`} className="flex items-center gap-3 rounded text-sm transition hover:bg-surface">
                <div className="w-20 text-muted-foreground">{(ar ? MONTHS_AR : MONTHS_EN)[b.month]} {b.year}</div>
                <div className="h-5 flex-1 overflow-hidden rounded bg-surface"><div className="h-full rounded bg-primary" style={{ width: `${Math.max(2, (b.revenue / maxMonthRevenue) * 100)}%` }} /></div>
                <div className="w-28 text-end font-medium">{formatEGP(b.revenue)}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">{tb('Traffic sources (orders)', 'مصادر الزيارات (الطلبات)')}</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground"><tr><th className="p-2 text-start">{tb('Source', 'المصدر')}</th><th className="p-2">{tb('Orders', 'الطلبات')}</th><th className="p-2 text-end">{tb('Revenue (delivered)', 'الإيرادات (تم التسليم)')}</th></tr></thead>
            <tbody>
              {sources.map((s) => (<tr key={s.key} className="border-t border-border"><td className="p-2">{sourceLabel(s.key, locale)}</td><td className="p-2 text-center font-medium">{s.orders}</td><td className="p-2 text-end">{formatEGP(s.revenue)}</td></tr>))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">{tb('Product performance (view → buy)', 'أداء المنتجات (مشاهدة ← شراء)')}</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground"><tr><th className="p-2 text-start">{tb('Product', 'المنتج')}</th><th className="p-2">{tb('Views', 'المشاهدات')}</th><th className="p-2">{tb('Units sold', 'الوحدات')}</th><th className="p-2">{tb('View→buy', 'مشاهدة←شراء')}</th></tr></thead>
            <tbody>
              {pp.map((p) => (
                <tr key={p.sku} className="border-t border-border hover:bg-surface"><td className="p-2"><Link href={`/admin/products?q=${encodeURIComponent(p.sku)}`} className="text-primary hover:underline">{p.name}</Link></td><td className="p-2 text-center">{p.views}</td><td className="p-2 text-center font-medium">{p.units}</td><td className="p-2 text-center text-muted-foreground">{pct(p.conversion)}</td></tr>
              ))}
              {pp.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{tb('No product views yet.', 'لا توجد مشاهدات بعد.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold">{tb('Top searches', 'أكثر عمليات البحث')}</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground"><tr><th className="p-2 text-start">{tb('Search term', 'عبارة البحث')}</th><th className="p-2">{tb('Searches', 'عدد عمليات البحث')}</th></tr></thead>
              <tbody>
                {si.top.map((s) => (<tr key={s.q} className="border-t border-border hover:bg-surface"><td className="p-2"><Link href={`/search?q=${encodeURIComponent(s.q)}`} className="text-primary hover:underline">{s.q}</Link></td><td className="p-2 text-center">{s.count}</td></tr>))}
                {si.top.length === 0 && <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">{tb('No searches yet.', 'لا توجد عمليات بحث بعد.')}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold">{tb('Searches with no results', 'عمليات بحث بلا نتائج')}</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground"><tr><th className="p-2 text-start">{tb('Search term', 'عبارة البحث')}</th><th className="p-2">{tb('Times', 'المرّات')}</th></tr></thead>
              <tbody>
                {si.zeroResults.map((s) => (<tr key={s.q} className="border-t border-border hover:bg-surface"><td className="p-2 text-destructive">{s.q}</td><td className="p-2 text-center">{s.count}</td></tr>))}
                {si.zeroResults.length === 0 && <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">{tb('None — every search returned results.', 'لا شيء — كل عمليات البحث أعادت نتائج.')}</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{tb('Demand you can’t fulfil yet — candidates to stock or special-order.', 'طلب لا يمكنك تلبيته بعد — مرشّحون للتخزين أو الطلب الخاص.')}</p>
        </section>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3 text-sm">
        <span className="text-muted-foreground">{tb('Export CSV:', 'تصدير CSV:')}</span>{' '}
        {exports.map((e, i) => (
          <span key={e.key}>{i > 0 && <span className="text-muted-foreground"> · </span>}<a href={`/api/admin/analytics/export?report=${e.key}&days=${days}`} className="text-primary hover:underline">{e.label}</a></span>
        ))}
      </div>
    </div>
  );
}
