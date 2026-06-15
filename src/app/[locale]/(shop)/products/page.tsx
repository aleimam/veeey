import { setRequestLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { toCardProduct, cardProductInclude } from '@/lib/storefront';
import { ProductCard } from '@/components/storefront/product-card';
import { Link } from '@/i18n/navigation';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const q = one(sp.q)?.trim();
  const brand = one(sp.brand);
  const kind = one(sp.kind);
  const sort = one(sp.sort) ?? 'popular';
  const inStock = one(sp.instock) === '1';
  const offers = one(sp.offers) === '1';

  const where = {
    status: 'PUBLISHED' as const,
    ...(q ? { nameEn: { contains: q, mode: 'insensitive' as const } } : {}),
    ...(brand ? { brandId: brand } : {}),
    ...(kind ? { kind: kind as 'SUPPLEMENT' | 'DEVICE' | 'INJECTION' } : {}),
    ...(inStock ? { lots: { some: { status: 'LIVE' as const, qtyOnHand: { gt: 0 } } } } : {}),
    ...(offers ? { lots: { some: { saleFlag: true } } } : {}),
  };

  const orderBy =
    sort === 'price_asc'
      ? { basePricePiastres: 'asc' as const }
      : sort === 'price_desc'
        ? { basePricePiastres: 'desc' as const }
        : { ratingCount: 'desc' as const };

  const [dbProducts, brands] = await Promise.all([
    prisma.product.findMany({ where, include: cardProductInclude, orderBy, take: 60 }),
    prisma.brand.findMany({ where: { archivedAt: null }, orderBy: { nameEn: 'asc' } }),
  ]);

  let products = dbProducts.map((p) => toCardProduct(p, locale));
  if (sort === 'expiry') {
    products = [...products].sort((a, b) => a.expiry.localeCompare(b.expiry));
  }

  const t = await getTranslations('storefront.listing');

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-heading text-2xl font-semibold text-foreground">
        {q ? t('resultsFor', { q }) : t('allProducts')}
      </h1>

      <div className="grid gap-8 lg:grid-cols-[230px_1fr]">
        <aside>
          <form action={`/${locale}/products`} className="space-y-5 text-sm">
            {q && <input type="hidden" name="q" value={q} />}
            <div>
              <label className="mb-1 block font-medium">{t('brand')}</label>
              <select name="brand" defaultValue={brand ?? ''} className="w-full rounded-md border border-border bg-card px-2 py-1.5">
                <option value="">{t('allBrands')}</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{(locale === 'ar' ? b.nameAr : b.nameEn) ?? b.nameEn}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">{t('type')}</label>
              <select name="kind" defaultValue={kind ?? ''} className="w-full rounded-md border border-border bg-card px-2 py-1.5">
                <option value="">{t('all')}</option>
                <option value="SUPPLEMENT">{t('supplements')}</option>
                <option value="DEVICE">{t('devices')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">{t('sort')}</label>
              <select name="sort" defaultValue={sort} className="w-full rounded-md border border-border bg-card px-2 py-1.5">
                <option value="popular">{t('mostPopular')}</option>
                <option value="price_asc">{t('priceLow')}</option>
                <option value="price_desc">{t('priceHigh')}</option>
                <option value="expiry">{t('nearestExpiry')}</option>
              </select>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" name="instock" value="1" defaultChecked={inStock} /> {t('inStockOnly')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="offers" value="1" defaultChecked={offers} /> {t('onOffer')}</label>
            <button className="w-full rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground">{t('apply')}</button>
          </form>
        </aside>

        <section>
          {products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-5">
              {products.map((p) => <ProductCard key={p.slug} product={p} locale={locale} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="font-medium text-foreground">{t('noMatch')}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('noMatchNote')}
              </p>
              <Link href="/products" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
                {t('clearFilters')}
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
