import { setRequestLocale } from 'next-intl/server';
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
    ...(kind ? { kind: kind as 'SUPPLEMENT' | 'DEVICE' | 'OTHER' } : {}),
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
    prisma.brand.findMany({ orderBy: { nameEn: 'asc' } }),
  ]);

  let products = dbProducts.map((p) => toCardProduct(p, locale));
  if (sort === 'expiry') {
    products = [...products].sort((a, b) => a.expiry.localeCompare(b.expiry));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-heading text-2xl font-semibold text-foreground">
        {q ? `Results for “${q}”` : 'All products'}
      </h1>

      <div className="grid gap-8 lg:grid-cols-[230px_1fr]">
        <aside>
          <form action={`/${locale}/products`} className="space-y-5 text-sm">
            {q && <input type="hidden" name="q" value={q} />}
            <div>
              <label className="mb-1 block font-medium">Brand</label>
              <select name="brand" defaultValue={brand ?? ''} className="w-full rounded-md border border-border bg-card px-2 py-1.5">
                <option value="">All brands</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.nameEn}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">Type</label>
              <select name="kind" defaultValue={kind ?? ''} className="w-full rounded-md border border-border bg-card px-2 py-1.5">
                <option value="">All</option>
                <option value="SUPPLEMENT">Supplements</option>
                <option value="DEVICE">Devices</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">Sort</label>
              <select name="sort" defaultValue={sort} className="w-full rounded-md border border-border bg-card px-2 py-1.5">
                <option value="popular">Most popular</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="expiry">Nearest expiry</option>
              </select>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" name="instock" value="1" defaultChecked={inStock} /> In stock only</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="offers" value="1" defaultChecked={offers} /> On offer</label>
            <button className="w-full rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground">Apply filters</button>
          </form>
        </aside>

        <section>
          {products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-5">
              {products.map((p) => <ProductCard key={p.slug} product={p} locale={locale} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="font-medium text-foreground">No products match your filters.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Can’t find what you need? We special-order almost anything from abroad.
              </p>
              <Link href="/products" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
                Clear filters
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
