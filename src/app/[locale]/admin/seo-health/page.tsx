import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { seoHealthReport } from '@/lib/seo-health-service';
import { FilterBar } from '@/components/admin/filter-bar';
import { SortableTh } from '@/components/admin/sortable-th';
import { ListPagination } from '@/components/admin/list-pagination';
import { parseListParams, clientPage, one, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';

export const dynamic = 'force-dynamic';

/** Catalog SEO health report — every product scored by the shared analyzer. */
export default async function SeoHealthPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const q = one(sp.q)?.toLowerCase();
  const band = one(sp.band); // good | ok | poor
  const missing = one(sp.missing); // keyword
  const lp = parseListParams(sp, { sortable: ['name', 'sku', 'scoreEn', 'scoreAr'], defaultSort: 'scoreEn', defaultDir: 'asc' });

  const { rows: all, summary } = await seoHealthReport();
  const filtered = all
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q))
    .filter((r) => !band || (band === 'good' ? r.scoreEn >= 80 : band === 'ok' ? r.scoreEn >= 50 && r.scoreEn < 80 : r.scoreEn < 50))
    .filter((r) => missing !== 'keyword' || r.missingKeyword);
  const { rows, total } = clientPage(filtered, lp, {
    name: (r) => r.name, sku: (r) => r.sku, scoreEn: (r) => r.scoreEn, scoreAr: (r) => r.scoreAr ?? -1,
  });

  const basePath = `/${locale}/admin/seo-health`;
  const badge = (score: number | null) =>
    score == null
      ? <span className="text-xs text-muted-foreground">—</span>
      : <span className={`inline-flex min-w-10 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold text-white ${score >= 80 ? 'bg-[color:var(--green,#38764d)]' : score >= 50 ? 'bg-amber-500' : 'bg-destructive'}`}>{score}</span>;

  const cards: { label: string; value: number; cls: string; href?: string }[] = [
    { label: tb('Products scored', 'منتجات مُقيَّمة'), value: summary.total, cls: 'text-foreground' },
    { label: tb('Good (80+)', 'جيد (80+)'), value: summary.good, cls: 'text-[color:var(--green,#38764d)]', href: `${basePath}?band=good` },
    { label: tb('Needs work (50–79)', 'يحتاج تحسينًا (50–79)'), value: summary.ok, cls: 'text-amber-600', href: `${basePath}?band=ok` },
    { label: tb('Poor (<50)', 'ضعيف (<50)'), value: summary.poor, cls: 'text-destructive', href: `${basePath}?band=poor` },
    { label: tb('Missing focus keyword', 'بدون كلمة مفتاحية'), value: summary.missingKeyword, cls: 'text-amber-600', href: `${basePath}?missing=keyword` },
  ];

  return (
    <div className="p-6">
      <header className="mb-5">
        <h1 className="font-heading text-xl font-semibold">{tb('SEO health', 'صحة SEO')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{tb('Every published/private product scored by the same analyzer as the product form (English score; Arabic scored when Arabic content exists).', 'كل منتج منشور/خاص مُقيَّم بنفس محلل نموذج المنتج (النتيجة الإنجليزية؛ وتُحسب العربية عند وجود محتوى عربي).')}</p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cards.map((c) => {
          const inner = (
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className={`text-2xl font-bold ${c.cls}`}>{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          );
          return c.href ? <a key={c.label} href={c.href} className="block hover:opacity-80">{inner}</a> : <div key={c.label}>{inner}</div>;
        })}
      </div>

      <FilterBar
        locale={locale}
        path="seo-health"
        values={{ q: one(sp.q), band, missing }}
        fields={[
          { name: 'q', label: tb('Search', 'بحث'), type: 'text', placeholder: tb('Name / SKU', 'الاسم / SKU') },
          { name: 'band', label: tb('Score band', 'نطاق النتيجة'), type: 'select', options: [
            { value: 'poor', label: tb('Poor (<50)', 'ضعيف (<50)') },
            { value: 'ok', label: tb('Needs work (50–79)', 'يحتاج تحسينًا (50–79)') },
            { value: 'good', label: tb('Good (80+)', 'جيد (80+)') },
          ] },
          { name: 'missing', label: tb('Missing', 'ناقص'), type: 'select', options: [
            { value: 'keyword', label: tb('Focus keyword', 'الكلمة المفتاحية') },
          ] },
        ]}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <SortableTh col="name" label={tb('Product', 'المنتج')} sort={lp.sort} dir={lp.dir} sp={sp} basePath={basePath} />
              <SortableTh col="sku" label="SKU" sort={lp.sort} dir={lp.dir} sp={sp} basePath={basePath} />
              <SortableTh col="scoreEn" label={tb('EN score', 'نتيجة EN')} sort={lp.sort} dir={lp.dir} sp={sp} basePath={basePath} />
              <SortableTh col="scoreAr" label={tb('AR score', 'نتيجة AR')} sort={lp.sort} dir={lp.dir} sp={sp} basePath={basePath} />
              <th className="p-3 text-start">{tb('Top issues (EN)', 'أهم المشاكل (EN)')}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 font-medium">{r.name}{r.missingKeyword && <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">{tb('no keyword', 'بدون كلمة')}</span>}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{r.sku}</td>
                <td className="p-3">{badge(r.scoreEn)}</td>
                <td className="p-3">{badge(r.scoreAr)}</td>
                <td className="p-3 text-xs text-muted-foreground">{r.issues.length ? r.issues.join(' · ') : '—'}</td>
                <td className="p-3 text-end"><Link href={`/admin/products/edit/${r.id}`} className="text-primary hover:underline">{tb('Fix', 'إصلاح')}</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{tb('No products match.', 'لا توجد منتجات مطابقة.')}</td></tr>}
          </tbody>
        </table>
      </div>

      <ListPagination page={lp.page} perPage={lp.perPage} total={total} sp={sp} basePath={basePath} locale={locale} perPageOptions={[25, 50, 100, 200]} />
    </div>
  );
}
