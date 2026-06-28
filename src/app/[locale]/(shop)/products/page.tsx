import { setRequestLocale, getTranslations } from 'next-intl/server';
import { pick } from '@/lib/admin-i18n';
import { prisma } from '@/lib/prisma';
import { toCardProduct, cardProductInclude, visibleProductWhere } from '@/lib/storefront';
import { getZones } from '@/lib/page-zone-service';
import { resolveHomeData, type HomeData } from '@/lib/home-layout-service';
import { ChewyHome } from '@/components/storefront/chewy/chewy-home';
import { ChewyProductCard } from '@/components/storefront/chewy/chewy-product-card';
import { Select } from '@/components/storefront/ui/select';
import { Checkbox } from '@/components/storefront/ui/checkbox';
import { Icon } from '@/components/storefront/ui/icon';
import { Link } from '@/i18n/navigation';
import { AdminEditLink } from '@/components/storefront/admin-edit-link';

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
    AND: [visibleProductWhere],
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
  const tb = pick(locale);
  const heading = q ? t('resultsFor', { q }) : t('allProducts');

  const zones = await getZones(['category.top', 'category.bottom']);
  let zoneData: HomeData = { bestsellers: [], deals: [], rows: {} };
  try {
    zoneData = await resolveHomeData([...zones['category.top'], ...zones['category.bottom']], locale);
  } catch {
    // zone product data is best-effort
  }

  return (
    <>
    {zones['category.top'].length > 0 && <ChewyHome locale={locale} blocks={zones['category.top']} data={zoneData} />}
    <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      <div className="mb-3.5 flex items-center gap-2 text-[13px] text-[color:var(--text-muted)]">
        <Link href="/">{tb('Home', 'الرئيسية')}</Link>
        <Icon name="chevron-right" size={14} color="var(--slate-45)" />
        <span className="font-semibold text-slate">{heading}</span>
      </div>

      <div className="mb-5">
        {brand && <div className="mb-2"><AdminEditLink href={`/admin/brands/edit/${brand}`} locale={locale} /></div>}
        <h1 className="text-[clamp(28px,3.4vw,38px)] font-bold text-green-dark">{heading}</h1>
        <div className="mt-1 text-sm text-[color:var(--text-muted)]">
          {tb(`${products.length} products · genuine imports, every lot dated`, `${products.length} منتجًا · واردات أصلية، وكل تشغيلة مؤرّخة`)}
        </div>
      </div>

      <form action={`/${locale}/products`} className="grid items-start gap-7 lg:grid-cols-[240px_1fr]">
        {q && <input type="hidden" name="q" value={q} />}
        <aside className="rounded-[16px] border border-[color:var(--green-dark-05)] bg-white p-5 lg:sticky lg:top-[130px]">
          <div className="space-y-4">
            <Select name="kind" defaultValue={kind ?? ''} label={t('type')}>
              <option value="">{t('all')}</option>
              <option value="SUPPLEMENT">{t('supplements')}</option>
              <option value="DEVICE">{t('devices')}</option>
            </Select>
            <Select name="brand" defaultValue={brand ?? ''} label={t('brand')}>
              <option value="">{t('allBrands')}</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {(locale === 'ar' ? b.nameAr : b.nameEn) ?? b.nameEn}
                </option>
              ))}
            </Select>
            <Select name="sort" defaultValue={sort} label={t('sort')}>
              <option value="popular">{t('mostPopular')}</option>
              <option value="price_asc">{t('priceLow')}</option>
              <option value="price_desc">{t('priceHigh')}</option>
              <option value="expiry">{t('nearestExpiry')}</option>
            </Select>
            <div className="flex flex-col gap-3 pt-1">
              <Checkbox name="instock" value="1" defaultChecked={inStock} label={t('inStockOnly')} />
              <Checkbox name="offers" value="1" defaultChecked={offers} label={t('onOffer')} />
            </div>
            <button className="v-btn v-btn--primary v-btn--block">{t('apply')}</button>
          </div>
        </aside>

        <section>
          {products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-[18px]">
              {products.map((p) => (
                <ChewyProductCard key={p.slug} product={p} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="rounded-[16px] border border-dashed border-[color:var(--slate-border)] p-10 text-center">
              <p className="font-semibold text-ink">{t('noMatch')}</p>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">{t('noMatchNote')}</p>
              <Link href="/products" className="mt-4 inline-block text-sm font-semibold text-green-dark hover:text-lime-press">{t('clearFilters')}</Link>
            </div>
          )}
        </section>
      </form>
    </div>
    {zones['category.bottom'].length > 0 && <ChewyHome locale={locale} blocks={zones['category.bottom']} data={zoneData} />}
    </>
  );
}
