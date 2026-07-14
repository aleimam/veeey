import type { Metadata } from 'next';
import { cache } from 'react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { pick } from '@/lib/admin-i18n';
import { prisma } from '@/lib/prisma';
import { toCardProduct, cardProductInclude, visibleProductWhere } from '@/lib/storefront';
import { parsePlp, plpWhere, removeParamHref, type SP } from '@/lib/plp-filters';
import { getZones } from '@/lib/page-zone-service';
import { resolveHomeData, type HomeData } from '@/lib/home-layout-service';
import { getFeatureStates } from '@/lib/feature-service';
import { richToText } from '@/lib/rich-text';
import { ChewyHome } from '@/components/storefront/chewy/chewy-home';
import { ChewyProductCard } from '@/components/storefront/chewy/chewy-product-card';
import { PlpFilters, type FacetAttribute } from '@/components/storefront/plp-filters';
import { Icon } from '@/components/storefront/ui/icon';
import { Link } from '@/i18n/navigation';
import { AdminEditLink } from '@/components/storefront/admin-edit-link';

const oneOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Resolve the active category filter (id, EN slug, or AR slug) to its record.
 *  Old slugs from the taxonomy restructure keep resolving via Redirect rows.
 *  cache() dedupes the generateMetadata + page-body calls within one request. */
const loadCategoryByKey = cache(async function loadCategoryByKey(key: string) {
  const direct = await prisma.category.findFirst({ where: { archivedAt: null, OR: [{ id: key }, { slug: key }, { slugAr: key }] } });
  if (direct) return direct;
  const r = await prisma.redirect.findUnique({ where: { fromPath: `/products?category=${key}` } });
  const newKey = r?.toPath.split('category=')[1];
  if (!newKey) return null;
  return prisma.category.findFirst({ where: { archivedAt: null, OR: [{ slug: newKey }, { slugAr: newKey }] } });
});

/** Category-filtered listing pages carry the category's own SEO module (V2 CAT-2). */
export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const key = oneOf(sp.category);
  if (!key) return {};
  const c = await loadCategoryByKey(key);
  if (!c) return {};
  const name = (locale === 'ar' ? c.nameAr : c.nameEn) ?? c.nameEn;
  const title = ((locale === 'ar' ? c.metaTitleAr : c.metaTitleEn) || `${name} — Veeey`) as string;
  const desc = ((locale === 'ar' ? c.metaDescAr : c.metaDescEn) ?? richToText((locale === 'ar' ? c.descriptionAr : c.descriptionEn) ?? c.descriptionEn)) || undefined;
  const ogTitle = ((locale === 'ar' ? c.ogTitleAr : c.ogTitleEn) || title) as string;
  const ogDesc = ((locale === 'ar' ? c.ogDescAr : c.ogDescEn) || desc) as string | undefined;
  const ogImage = c.ogImage || c.imageUrl || undefined;
  const canonical = c.canonicalUrl || `/${locale}/products?category=${(locale === 'ar' ? c.slugAr : c.slug) ?? c.slug}`;
  return {
    metadataBase: new URL('https://veeey.com'),
    title,
    description: desc,
    alternates: { canonical },
    robots: { index: c.robotsIndex, follow: c.robotsFollow },
    openGraph: { title: ogTitle, description: ogDesc, url: canonical, siteName: 'Veeey', images: ogImage ? [ogImage] : undefined, type: 'website' },
    twitter: { card: 'summary_large_image', title: ogTitle, description: ogDesc, images: ogImage ? [ogImage] : undefined },
  };
}

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
  const ar = locale === 'ar';
  const nameOf = (en: string, arName?: string | null) => (ar ? (arName ?? en) : en);

  const state = parsePlp(sp);
  // Category filter accepts an id OR a slug (SEO URLs use slugs); normalize to id.
  const activeCategory = state.category ? await loadCategoryByKey(state.category) : null;
  if (activeCategory) state.category = activeCategory.id;
  const { q } = state;

  const where = {
    status: 'PUBLISHED' as const,
    AND: [visibleProductWhere, plpWhere(state)],
    ...(q ? { nameEn: { contains: q, mode: 'insensitive' as const } } : {}),
  };

  const orderBy =
    state.sort === 'price_asc'
      ? { basePricePiastres: 'asc' as const }
      : state.sort === 'price_desc'
        ? { basePricePiastres: 'desc' as const }
        : state.sort === 'rating'
          ? { ratingAvg: 'desc' as const }
          : { ratingCount: 'desc' as const };

  const [dbProducts, brands, categories, attributes] = await Promise.all([
    prisma.product.findMany({ where, include: cardProductInclude, orderBy, take: 60 }),
    prisma.brand.findMany({ where: { archivedAt: null }, orderBy: { nameEn: 'asc' } }),
    prisma.category.findMany({ where: { archivedAt: null }, orderBy: { nameEn: 'asc' }, select: { id: true, nameEn: true, nameAr: true } }),
    prisma.attribute.findMany({
      // Facets are the attributes flagged filterable (V3-ATTR); fall back to any
      // attribute-with-values only if none are flagged yet.
      where: { archivedAt: null, isFilterable: true, values: { some: {} } },
      orderBy: { nameEn: 'asc' },
      take: 8,
      select: { id: true, nameEn: true, nameAr: true, values: { select: { id: true, valueEn: true, valueAr: true }, orderBy: [{ sortOrder: 'asc' }, { valueEn: 'asc' }] } },
    }),
  ]);

  let products = dbProducts.map((p) => toCardProduct(p, locale));
  if (state.sort === 'expiry') {
    products = [...products].sort((a, b) => a.expiry.localeCompare(b.expiry));
  }

  // Fall back to any attributes-with-values while none are flagged filterable yet.
  const facetSource = attributes.length
    ? attributes
    : await prisma.attribute.findMany({
        where: { archivedAt: null, values: { some: {} } },
        orderBy: { nameEn: 'asc' },
        take: 6,
        select: { id: true, nameEn: true, nameAr: true, values: { select: { id: true, valueEn: true, valueAr: true }, orderBy: [{ sortOrder: 'asc' }, { valueEn: 'asc' }] } },
      });

  const t = await getTranslations('storefront.listing');
  const tb = pick(locale);
  const heading = q ? t('resultsFor', { q }) : t('allProducts');

  const facetAttrs: FacetAttribute[] = facetSource.map((a) => ({
    id: a.id,
    name: nameOf(a.nameEn, a.nameAr),
    values: a.values.map((v) => ({ id: v.id, name: nameOf(v.valueEn, v.valueAr) })),
  }));

  // Active filters → removable chips (audit 5.5).
  const base = `/products`;
  const chips: { key: string; label: string; href: string }[] = [];
  const chip = (key: string, label: string, remove: string[]) => chips.push({ key, label, href: removeParamHref(base, sp, remove) });
  if (state.kind) chip('kind', state.kind === 'DEVICE' ? t('devices') : t('supplements'), ['kind']);
  if (state.category) {
    const c = categories.find((x) => x.id === state.category);
    if (c) chip('category', nameOf(c.nameEn, c.nameAr), ['category']);
  }
  if (state.brand) {
    const b = brands.find((x) => x.id === state.brand);
    if (b) chip('brand', nameOf(b.nameEn, b.nameAr), ['brand']);
  }
  if (state.pminEgp != null) chip('pmin', `≥ ${state.pminEgp} ${tb('EGP', 'ج.م')}`, ['pmin']);
  if (state.pmaxEgp != null) chip('pmax', `≤ ${state.pmaxEgp} ${tb('EGP', 'ج.م')}`, ['pmax']);
  if (state.rating != null) chip('rating', `★ ${state.rating}+`, ['rating']);
  if (state.exp) {
    const expLabel = state.exp === 'lt3' ? tb('Expiry < 3 mo', 'صلاحية < 3 أشهر') : state.exp === '3to6' ? tb('Expiry 3–6 mo', 'صلاحية 3–6 أشهر') : tb('Expiry 6+ mo', 'صلاحية 6+ أشهر');
    chip('exp', expLabel, ['exp']);
  }
  if (state.instock) chip('instock', t('inStockOnly'), ['instock']);
  if (state.offers) chip('offers', t('onOffer'), ['offers']);
  for (const [attrId, valueId] of Object.entries(state.attrs)) {
    const a = facetAttrs.find((x) => x.id === attrId);
    const v = a?.values.find((x) => x.id === valueId);
    if (a && v) chip(`av_${attrId}`, `${a.name}: ${v.name}`, [`av_${attrId}`]);
  }
  const clearAllHref = removeParamHref(base, sp, chips.map((c) => c.key));

  const zones = await getZones(['category.top', 'category.bottom']);
  const ff = await getFeatureStates();
  let zoneData: HomeData = { bestsellers: [], deals: [], rows: {} };
  try {
    zoneData = await resolveHomeData([...zones['category.top'], ...zones['category.bottom']], locale);
  } catch {
    // zone product data is best-effort
  }

  // Breadcrumb rich result for category pages: Home › Shop › [parent] › category.
  const catUrl = (c: { slug: string; slugAr: string | null }) =>
    `https://veeey.com/${locale}/products?category=${(ar ? c.slugAr : c.slug) ?? c.slug}`;
  const catParent = activeCategory?.parentId
    ? await prisma.category.findFirst({
        where: { id: activeCategory.parentId, archivedAt: null },
        select: { nameEn: true, nameAr: true, slug: true, slugAr: true },
      })
    : null;
  const breadcrumbLd = activeCategory
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { name: tb('Home', 'الرئيسية'), item: `https://veeey.com/${locale}` },
          { name: tb('Shop', 'المتجر'), item: `https://veeey.com/${locale}/products` },
          ...(catParent ? [{ name: (ar ? catParent.nameAr : catParent.nameEn) ?? catParent.nameEn, item: catUrl(catParent) }] : []),
          { name: (ar ? activeCategory.nameAr : activeCategory.nameEn) ?? activeCategory.nameEn, item: catUrl(activeCategory) },
        ].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
      }
    : null;

  return (
    <>
    {activeCategory && (
      <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: (ar ? activeCategory.nameAr : activeCategory.nameEn) ?? activeCategory.nameEn,
            image: activeCategory.ogImage || activeCategory.imageUrl || undefined,
            url: `https://veeey.com/${locale}/products?category=${(ar ? activeCategory.slugAr : activeCategory.slug) ?? activeCategory.slug}`,
            ...(activeCategory.schemaOverridesJson && typeof activeCategory.schemaOverridesJson === 'object' && !Array.isArray(activeCategory.schemaOverridesJson)
              ? (activeCategory.schemaOverridesJson as Record<string, unknown>)
              : {}),
          }),
        }}
      />
      {breadcrumbLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />}
      </>
    )}
    {zones['category.top'].length > 0 && <ChewyHome locale={locale} blocks={zones['category.top']} data={zoneData} states={ff} />}
    <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      <div className="mb-3.5 flex items-center gap-2 text-[13px] text-[color:var(--text-muted)]">
        <Link href="/">{tb('Home', 'الرئيسية')}</Link>
        <Icon name={locale === 'ar' ? 'chevron-left' : 'chevron-right'} size={14} color="var(--slate-45)" />
        <span className="font-semibold text-slate">{heading}</span>
      </div>

      <div className="mb-5">
        {state.brand && <div className="mb-2"><AdminEditLink href={`/admin/brands/edit/${state.brand}`} locale={locale} /></div>}
        <h1 className="text-[clamp(28px,3.4vw,38px)] font-bold text-green-dark">{heading}</h1>
        <div className="mt-1 text-sm text-[color:var(--text-muted)]">
          {tb(`${products.length} products · genuine imports, every lot dated`, `${products.length} منتجًا · واردات أصلية، وكل تشغيلة مؤرّخة`)}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <Link
              key={c.key}
              href={c.href}
              className="inline-flex items-center gap-1.5 rounded-full bg-green-wash px-3 py-1.5 text-[13px] font-semibold text-green-dark hover:bg-lime-wash"
            >
              {c.label}
              <Icon name="x" size={13} color="var(--green-dark)" />
            </Link>
          ))}
          <Link href={clearAllHref} className="text-[13px] font-semibold text-[color:var(--text-muted)] underline hover:text-green-dark">
            {t('clearFilters')}
          </Link>
        </div>
      )}

      <div className="grid items-start gap-7 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-[16px] border border-[color:var(--green-dark-05)] bg-white p-5 lg:sticky lg:top-[130px] lg:max-h-[calc(100vh-150px)] lg:overflow-y-auto">
          <PlpFilters
            locale={locale}
            action={`/${locale}/products`}
            state={state}
            brands={brands.map((b) => ({ id: b.id, name: nameOf(b.nameEn, b.nameAr) }))}
            categories={categories.map((c) => ({ id: c.id, name: nameOf(c.nameEn, c.nameAr) }))}
            attributes={facetAttrs}
            resultCount={products.length}
          />
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
      </div>
    </div>
    {zones['category.bottom'].length > 0 && <ChewyHome locale={locale} blocks={zones['category.bottom']} data={zoneData} states={ff} />}
    </>
  );
}
