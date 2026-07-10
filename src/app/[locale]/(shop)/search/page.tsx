import { setRequestLocale, getTranslations } from 'next-intl/server';
import { pick } from '@/lib/admin-i18n';
import { searchProducts } from '@/lib/search-service';
import { toCardProduct } from '@/lib/storefront';
import { affinityCategoryIds } from '@/lib/personalization-service';
import { rankByAffinity } from '@/lib/personalization';
import { ProductCard } from '@/components/storefront/product-card';
import { Select } from '@/components/storefront/ui/select';
import { Checkbox } from '@/components/storefront/ui/checkbox';
import { Link, redirect } from '@/i18n/navigation';
import { matchSearchRule } from '@/lib/search-rules-service';
import { TrackView } from '@/components/analytics/track-view';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const q = one(sp.q)?.trim() ?? '';
  const sort = one(sp.sort) ?? 'relevance';
  const instock = one(sp.instock) === '1';

  // Merchandising rules (#186): a matched query can redirect the searcher to a
  // page, or rewrite to different terms so a "no results" query finds something.
  const rule = q ? await matchSearchRule(q) : null;
  if (rule?.kind === 'REDIRECT' && rule.targetUrl) redirect({ href: rule.targetUrl, locale });
  const effectiveQ = rule?.kind === 'REWRITE' && rule.rewriteTo ? rule.rewriteTo : q;

  const results = q ? await searchProducts(effectiveQ) : [];
  // Personalized ranking (FR-PERS-03): boost results in the visitor's affinity categories.
  const affinity = q ? await affinityCategoryIds() : new Set<string>();
  const ranked = rankByAffinity(results.map((p) => ({ ...p, categoryIds: p.categories.map((c) => c.id) })), affinity);
  let products = ranked.map((p) => toCardProduct(p, locale));
  // Refinement toolbar (audit P1 5.2) — results are ≤60 rows, refine in memory.
  if (instock) products = products.filter((p) => p.badge?.type !== 'pre-order');
  if (sort === 'price_asc') products = [...products].sort((a, b) => a.pricePiastres - b.pricePiastres);
  if (sort === 'price_desc') products = [...products].sort((a, b) => b.pricePiastres - a.pricePiastres);
  if (sort === 'rating') products = [...products].sort((a, b) => b.rating - a.rating);

  const t = await getTranslations('storefront.search');
  const tb = pick(locale);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8">
      {q && <TrackView name="search" props={{ q, results: products.length }} />}
      <h1 className="mb-6 text-3xl font-bold text-green-dark">{q ? t('withQuery', { q }) : t('title')}</h1>

      {q && (
        <form action={`/${locale}/search`} className="mb-6 flex flex-wrap items-end gap-4 rounded-[14px] border border-[color:var(--green-dark-05)] bg-white p-4">
          <input type="hidden" name="q" value={q} />
          <div className="w-48">
            <Select name="sort" defaultValue={sort} label={tb('Sort by', 'الترتيب حسب')}>
              <option value="relevance">{tb('Relevance', 'الأكثر صلة')}</option>
              <option value="price_asc">{tb('Price: low to high', 'السعر: من الأقل للأعلى')}</option>
              <option value="price_desc">{tb('Price: high to low', 'السعر: من الأعلى للأقل')}</option>
              <option value="rating">{tb('Highest rated', 'الأعلى تقييمًا')}</option>
            </Select>
          </div>
          <Checkbox name="instock" value="1" defaultChecked={instock} label={tb('In stock only', 'المتوفر فقط')} />
          <button className="v-btn v-btn--secondary v-btn--sm">{tb('Apply', 'تطبيق')}</button>
        </form>
      )}

      {q && products.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-[color:var(--slate-border)] p-10 text-center">
          <p className="font-semibold text-ink">{t('noResults', { q })}</p>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">{t('noResultsNote')}</p>
          <Link href="/products" className="mt-4 inline-block text-sm font-semibold text-green-dark hover:text-lime-press">{t('browseAll')}</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
          {products.map((p) => <ProductCard key={p.slug} product={p} locale={locale} />)}
        </div>
      )}
    </div>
  );
}
