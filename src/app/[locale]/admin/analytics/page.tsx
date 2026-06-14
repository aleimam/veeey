import { setRequestLocale } from 'next-intl/server';
import { funnelCounts, topSearches, topViewedProducts, kpis } from '@/lib/analytics-service';
import { buildFunnel } from '@/lib/analytics';
import { formatEGP } from '@/lib/format';

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default async function AnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [counts, searches, products, k] = await Promise.all([funnelCounts(), topSearches(), topViewedProducts(), kpis()]);
  const funnel = buildFunnel(counts);
  const top = funnel[0].count || 1;

  const cards = [
    { label: 'Revenue (30d, delivered)', value: formatEGP(k.revenue) },
    { label: 'Orders (30d)', value: String(k.orders) },
    { label: 'Avg order value', value: formatEGP(k.aov) },
    { label: 'Customers', value: String(k.customers) },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">Analytics (last 30 days)</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-xl font-semibold text-foreground">{c.value}</div>
          </div>
        ))}
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">Conversion funnel</h2>
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
          <h2 className="mb-3 text-sm font-semibold">Top searches</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground"><tr><th className="p-2 text-start">Query</th><th className="p-2">Searches</th><th className="p-2">Zero-result</th></tr></thead>
              <tbody>
                {searches.map((s) => (
                  <tr key={s.q} className="border-t border-border"><td className="p-2">{s.q}</td><td className="p-2 text-center">{s.count}</td><td className="p-2 text-center">{s.zero > 0 ? <span className="text-destructive">{s.zero}</span> : '0'}</td></tr>
                ))}
                {searches.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No searches yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Most viewed products</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground"><tr><th className="p-2 text-start">Product</th><th className="p-2">Views</th></tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.sku} className="border-t border-border"><td className="p-2">{p.name}</td><td className="p-2 text-center">{p.views}</td></tr>
                ))}
                {products.length === 0 && <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">No product views yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
