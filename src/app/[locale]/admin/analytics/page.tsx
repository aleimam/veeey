import { setRequestLocale } from 'next-intl/server';
import { funnelCounts, topSearches, topViewedProducts, kpis, commerceMetrics, ordersBySource } from '@/lib/analytics-service';
import { buildFunnel } from '@/lib/analytics';
import { formatEGP } from '@/lib/format';
import { pick } from '@/lib/admin-i18n';
import { sourceLabel } from '@/lib/attribution';

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default async function AnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [counts, searches, products, k, m, sources] = await Promise.all([funnelCounts(), topSearches(), topViewedProducts(), kpis(), commerceMetrics(), ordersBySource()]);
  const funnel = buildFunnel(counts);
  const top = funnel[0].count || 1;
  const tb = pick(locale);
  const ar = locale === 'ar';

  const cards = [
    { label: tb('Revenue (last 30 days, delivered)', 'الإيرادات (آخر 30 يومًا، تم التسليم)'), value: formatEGP(k.revenue) },
    { label: tb('Orders (last 30 days)', 'الطلبات (آخر 30 يومًا)'), value: String(k.orders) },
    { label: tb('Average order value', 'متوسط قيمة الطلب'), value: formatEGP(k.aov) },
    { label: tb('Customers', 'العملاء'), value: String(k.customers) },
    {
      label: tb('Conversion rate (orders / sessions)', 'معدل التحويل (الطلبات / الجلسات)'),
      value: m.conversionRate === null ? tb('No session data', 'لا توجد بيانات جلسات') : pct(m.conversionRate),
    },
    {
      label: tb('Repeat-purchase rate', 'معدل الشراء المتكرر'),
      value: m.repeatPurchaseRate === null ? tb('No buyers yet', 'لا يوجد مشترون بعد') : pct(m.repeatPurchaseRate),
    },
  ];

  const maxMonthRevenue = Math.max(1, ...m.revenueByMonth.map((b) => b.revenue));

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{tb('Analytics (last 30 days)', 'التحليلات (آخر 30 يومًا)')}</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-xl font-semibold text-foreground">{c.value}</div>
          </div>
        ))}
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">{tb('Conversion funnel', 'مسار التحويل')}</h2>
        <div className="space-y-2 rounded-lg border border-border p-4">
          {funnel.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3 text-sm">
              <div className="w-28 text-muted-foreground">{s.label}</div>
              <div className="h-5 flex-1 overflow-hidden rounded bg-surface">
                <div className="h-full rounded bg-primary" style={{ width: `${Math.max(2, (s.count / top) * 100)}%` }} />
              </div>
              <div className="w-16 text-end font-medium">{s.count}</div>
              <div className="w-16 text-end text-xs text-muted-foreground">{i === 0 ? '—' : pct(s.rate)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">{tb('Revenue by month (last 6, delivered)', 'الإيرادات حسب الشهر (آخر 6 أشهر، تم التسليم)')}</h2>
        <div className="space-y-2 rounded-lg border border-border p-4">
          {m.revenueByMonth.map((b) => (
            <div key={b.key} className="flex items-center gap-3 text-sm">
              <div className="w-20 text-muted-foreground">{(ar ? MONTHS_AR : MONTHS_EN)[b.month]} {b.year}</div>
              <div className="h-5 flex-1 overflow-hidden rounded bg-surface">
                <div className="h-full rounded bg-primary" style={{ width: `${Math.max(2, (b.revenue / maxMonthRevenue) * 100)}%` }} />
              </div>
              <div className="w-28 text-end font-medium">{formatEGP(b.revenue)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">{tb('Traffic sources (last 30 days, orders)', 'مصادر الزيارات (آخر 30 يومًا، الطلبات)')}</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground"><tr><th className="p-2 text-start">{tb('Source', 'المصدر')}</th><th className="p-2">{tb('Orders', 'الطلبات')}</th><th className="p-2 text-end">{tb('Revenue (delivered)', 'الإيرادات (تم التسليم)')}</th></tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.key} className="border-t border-border">
                  <td className="p-2">{sourceLabel(s.key, locale)}</td>
                  <td className="p-2 text-center font-medium">{s.orders}</td>
                  <td className="p-2 text-end">{formatEGP(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {tb(
            'Automatic attribution from UTM tags, ad click-ids and referrers on the visit that led to the order — separate from the manual Channel field.',
            'إسناد تلقائي من وسوم UTM ومعرّفات نقرات الإعلانات والمُحيل في الزيارة التي أدّت إلى الطلب — منفصل عن حقل القناة اليدوي.',
          )}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">{tb('Best sellers (last 30 days, by units)', 'الأكثر مبيعًا (آخر 30 يومًا، حسب الوحدات)')}</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground"><tr><th className="p-2 text-start">{tb('Product', 'المنتج')}</th><th className="p-2 text-start">{tb('SKU', 'الرمز')}</th><th className="p-2">{tb('Units sold', 'الوحدات المباعة')}</th></tr></thead>
            <tbody>
              {m.bestSellers.map((p) => (
                <tr key={p.id} className="border-t border-border"><td className="p-2">{ar ? p.nameAr || p.nameEn : p.nameEn}</td><td className="p-2 text-muted-foreground">{p.sku}</td><td className="p-2 text-center font-medium">{p.qty}</td></tr>
              ))}
              {m.bestSellers.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">{tb('No sales yet.', 'لا توجد مبيعات بعد.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold">{tb('Top searches', 'أكثر عمليات البحث')}</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground"><tr><th className="p-2 text-start">{tb('Search term', 'عبارة البحث')}</th><th className="p-2">{tb('Searches', 'عدد عمليات البحث')}</th><th className="p-2">{tb('No results', 'بدون نتائج')}</th></tr></thead>
              <tbody>
                {searches.map((s) => (
                  <tr key={s.q} className="border-t border-border"><td className="p-2">{s.q}</td><td className="p-2 text-center">{s.count}</td><td className="p-2 text-center">{s.zero > 0 ? <span className="text-destructive">{s.zero}</span> : '0'}</td></tr>
                ))}
                {searches.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">{tb('No searches yet.', 'لا توجد عمليات بحث بعد.')}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">{tb('Most viewed products', 'المنتجات الأكثر مشاهدة')}</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground"><tr><th className="p-2 text-start">{tb('Product', 'المنتج')}</th><th className="p-2">{tb('Views', 'المشاهدات')}</th></tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.sku} className="border-t border-border"><td className="p-2">{p.name}</td><td className="p-2 text-center">{p.views}</td></tr>
                ))}
                {products.length === 0 && <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">{tb('No product views yet.', 'لا توجد مشاهدات للمنتجات بعد.')}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
