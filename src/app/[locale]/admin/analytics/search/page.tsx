import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { searchOverview } from '@/lib/search-analytics';

export const dynamic = 'force-dynamic';
const RANGES = [7, 30, 90] as const;

const pctOf = (n: number) => `${Math.round(n * 100)}%`;
const num = (n: number, locale: string) => n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US');

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
      {note && <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

export default async function SearchAnalyticsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ days?: string }> }) {
  await requirePermission('finance.read');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const days = RANGES.includes(Number(sp.days) as (typeof RANGES)[number]) ? Number(sp.days) : 30;

  const a = await searchOverview(days);
  const funnelMax = Math.max(1, a.funnel.searches);
  const funnel = [
    { label: tb('Searches', 'عمليات البحث'), count: a.funnel.searches },
    { label: tb('Result clicks', 'نقرات النتائج'), count: a.funnel.clicks },
    { label: tb('Clicks that sold', 'نقرات أدّت لبيع'), count: a.funnel.soldClicks },
  ];

  return (
    <div className="max-w-5xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/analytics" className="text-sm text-primary hover:underline">← {tb('Analytics', 'التحليلات')}</Link>
          <h1 className="mt-1 font-heading text-xl font-semibold">{tb('Search analytics', 'تحليلات البحث')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/search-demand" className="text-sm font-medium text-primary hover:underline">{tb('Unstocked demand →', 'الطلب غير المتوفر ←')}</Link>
          <Link href="/admin/search-synonyms" className="text-sm font-medium text-primary hover:underline">{tb('Synonyms →', 'المرادفات ←')}</Link>
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            {RANGES.map((d) => (
              <Link key={d} href={`/admin/analytics/search?days=${d}`} className={`rounded-md px-3 py-1 text-sm ${d === days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface'}`}>
                {tb(`${d}d`, `${d} يوم`)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={tb('Searches', 'عمليات البحث')} value={num(a.totalSearches, locale)} note={tb(`${num(a.sessions, locale)} sessions`, `${num(a.sessions, locale)} جلسة`)} />
        <Kpi label={tb('Click-through rate', 'معدل النقر')} value={pctOf(a.ctr)} note={tb(`${num(a.totalClicks, locale)} clicks`, `${num(a.totalClicks, locale)} نقرة`)} />
        <Kpi label={tb('Zero-result rate', 'نسبة بلا نتائج')} value={pctOf(a.zeroRate)} note={tb(`${num(a.zeroResultSearches, locale)} searches`, `${num(a.zeroResultSearches, locale)} بحث`)} />
        <Kpi label={tb('Clicks that sold', 'نقرات أدّت لبيع')} value={num(a.funnel.soldClicks, locale)} note={tb('attributed', 'منسوبة')} />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">{tb('Search → click → sale', 'البحث ← النقر ← البيع')}</h2>
        <div className="space-y-2 rounded-lg border border-border p-4">
          {funnel.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3 text-sm">
              <div className="w-40 text-muted-foreground">{s.label}</div>
              <div className="h-5 flex-1 overflow-hidden rounded bg-surface"><div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, Math.max(2, (s.count / funnelMax) * 100))}%` }} /></div>
              <div className="w-16 text-end font-medium">{num(s.count, locale)}</div>
              <div className="w-14 text-end text-xs text-muted-foreground">{i === 0 ? '—' : pctOf(a.funnel.searches ? s.count / a.funnel.searches : 0)}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{tb('“Clicks that sold” attributes a result click to a later paid order line for the same product — a directional signal, not proof of cause.', '«نقرات أدّت لبيع» تنسب نقرة النتيجة إلى بند طلب مدفوع لاحق لنفس المنتج — مؤشر إرشادي وليس دليلاً على السببية.')}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold">{tb('Top search terms', 'أكثر كلمات البحث')}</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{tb('Term', 'الكلمة')}</th>
                  <th className="p-2 text-end">{tb('Searches', 'بحث')}</th>
                  <th className="p-2 text-end">{tb('Avg results', 'متوسط النتائج')}</th>
                  <th className="p-2 text-end">{tb('CTR', 'النقر')}</th>
                </tr>
              </thead>
              <tbody>
                {a.topTerms.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{tb('No searches yet in this period.', 'لا عمليات بحث في هذه الفترة.')}</td></tr>}
                {a.topTerms.map((r) => (
                  <tr key={r.normalized} className="border-t border-border">
                    <td className="p-2">
                      <Link href={{ pathname: '/search', query: { q: r.term } }} className="text-primary hover:underline">{r.term}</Link>
                      {r.zeroRate >= 0.5 && <span className="ms-2 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">{tb('poor', 'ضعيف')}</span>}
                    </td>
                    <td className="p-2 text-end">{num(r.searches, locale)}</td>
                    <td className="p-2 text-end">{r.avgResults}</td>
                    <td className="p-2 text-end">{pctOf(r.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">{tb('Zero-result searches', 'عمليات بحث بلا نتائج')}</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{tb('Term', 'الكلمة')}</th>
                  <th className="p-2 text-end">{tb('Searches', 'بحث')}</th>
                  <th className="p-2 text-end">{tb('Fix', 'حل')}</th>
                </tr>
              </thead>
              <tbody>
                {a.zeroTerms.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">{tb('Nothing came back empty. 🎉', 'لا شيء رجع فارغًا. 🎉')}</td></tr>}
                {a.zeroTerms.map((r) => (
                  <tr key={r.normalized} className="border-t border-border">
                    <td className="p-2">{r.term}</td>
                    <td className="p-2 text-end">{num(r.searches, locale)}</td>
                    <td className="p-2 text-end">
                      <Link href={`/admin/search-synonyms?term=${encodeURIComponent(r.normalized)}`} className="text-primary hover:underline">{tb('Add synonym', 'أضف مرادفًا')}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{tb('Map these to real products with a synonym, or redirect them from the search rules page.', 'اربط هذه بمنتجات حقيقية عبر مرادف، أو أعد توجيهها من صفحة قواعد البحث.')}</p>
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">{tb('Purchase-driving terms', 'كلمات تقود للشراء')}</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{tb('Term', 'الكلمة')}</th>
                  <th className="p-2 text-end">{tb('Result clicks', 'نقرات النتائج')}</th>
                  <th className="p-2 text-end">{tb('Clicks that sold', 'نقرات أدّت لبيع')}</th>
                  <th className="p-2 text-end">{tb('Rate', 'المعدل')}</th>
                </tr>
              </thead>
              <tbody>
                {a.drivingTerms.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{tb('No result clicks attributed to sales yet.', 'لا نقرات نتائج منسوبة لمبيعات بعد.')}</td></tr>}
                {a.drivingTerms.map((r) => (
                  <tr key={r.normalized} className="border-t border-border">
                    <td className="p-2">{r.term}</td>
                    <td className="p-2 text-end">{num(r.clicks, locale)}</td>
                    <td className="p-2 text-end">{num(r.soldClicks, locale)}</td>
                    <td className="p-2 text-end">{pctOf(r.clicks ? r.soldClicks / r.clicks : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
