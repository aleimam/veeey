import { setRequestLocale, getTranslations } from 'next-intl/server';
import { searchProducts } from '@/lib/search-service';
import { toCardProduct } from '@/lib/storefront';
import { affinityCategoryIds } from '@/lib/personalization-service';
import { rankByAffinity } from '@/lib/personalization';
import { ProductCard } from '@/components/storefront/product-card';
import { Link } from '@/i18n/navigation';
import { TrackView } from '@/components/analytics/track-view';

type SP = Record<string, string | string[] | undefined>;

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
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? '';
  const results = q ? await searchProducts(q) : [];
  // Personalized ranking (FR-PERS-03): boost results in the visitor's affinity categories.
  const affinity = q ? await affinityCategoryIds() : new Set<string>();
  const ranked = rankByAffinity(results.map((p) => ({ ...p, categoryIds: p.categories.map((c) => c.id) })), affinity);
  const products = ranked.map((p) => toCardProduct(p, locale));
  const t = await getTranslations('storefront.search');

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8">
      {q && <TrackView name="search" props={{ q, results: products.length }} />}
      <h1 className="mb-6 text-3xl font-bold text-green-dark">{q ? t('withQuery', { q }) : t('title')}</h1>

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
