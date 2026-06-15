import { setRequestLocale } from 'next-intl/server';
import { funnelCounts, topSearches, topViewedProducts, kpis } from '@/lib/analytics-service';
import { buildFunnel } from '@/lib/analytics';
import { formatEGP } from '@/lib/format';
import { pick } from '@/lib/admin-i18n';

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default async function AnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [counts, searches, products, k] = await Promise.all([funnelCounts(), topSearches(), topViewedProducts(), kpis()]);
  const funnel = buildFunnel(counts);
  const top = funnel[0].count || 1;
  const tb = pick(locale);

  const cards = [
    { label: tb('Revenue (last 30 days, delivered)', 'الإيرادات (آخر 30 يومًا، تم التسليم)'), value: formatEGP(k.revenue) },
    { label: tb('Orders (last 30 days)', 'الطلبات (آخر 30 يومًا)'), value: String(k.orders) },
    { label: tb('Average order value', 'متوسط قيمة الطلب'), value: formatEGP(k.aov) },
    { label: tb('Customers', 'العملاء'), value: String(k.customers) },
  ];

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
