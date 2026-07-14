import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { pick } from '@/lib/admin-i18n';
import { prisma } from '@/lib/prisma';
import { toCardProduct, cardProductInclude, visibleProductWhere } from '@/lib/storefront';
import { sanitizeRichHtml, hasRichContent, richToText } from '@/lib/rich-text';
import { ChewyProductCard } from '@/components/storefront/chewy/chewy-product-card';
import { AdminEditLink } from '@/components/storefront/admin-edit-link';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/storefront/ui/icon';

const loadBrand = (slug: string) => prisma.brand.findFirst({ where: { archivedAt: null, OR: [{ slug }, { slugAr: slug }] } });

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const b = await loadBrand(slug);
  if (!b) return {};
  const name = (locale === 'ar' ? b.nameAr : b.nameEn) ?? b.nameEn;
  const title = ((locale === 'ar' ? b.metaTitleAr : b.metaTitleEn) || `${name} — Veeey`) as string;
  const desc =
    ((locale === 'ar' ? b.metaDescAr : b.metaDescEn) ??
      richToText((locale === 'ar' ? b.descriptionAr : b.descriptionEn) ?? b.descriptionEn)) || undefined;
  const ogTitle = ((locale === 'ar' ? b.ogTitleAr : b.ogTitleEn) || title) as string;
  const ogDesc = ((locale === 'ar' ? b.ogDescAr : b.ogDescEn) || desc) as string | undefined;
  const ogImage = b.ogImage || b.logoUrl || undefined;
  const localSlug = (locale === 'ar' ? b.slugAr : b.slug) ?? b.slug;
  const canonical = b.canonicalUrl || `/${locale}/brands/${localSlug}`;
  return {
    metadataBase: new URL('https://veeey.com'),
    title,
    description: desc,
    alternates: { canonical },
    robots: { index: b.robotsIndex, follow: b.robotsFollow },
    openGraph: { title: ogTitle, description: ogDesc, url: canonical, siteName: 'Veeey', images: ogImage ? [ogImage] : undefined, type: 'website' },
    twitter: { card: 'summary_large_image', title: ogTitle, description: ogDesc, images: ogImage ? [ogImage] : undefined },
  };
}

/** Brand page (audit P2 6.4): logo, story, and the brand's live products. */
export default async function BrandPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const ar = locale === 'ar';

  const brand = await loadBrand(slug);
  if (!brand) notFound();

  const name = (ar ? brand.nameAr : brand.nameEn) ?? brand.nameEn;
  const storyHtml = sanitizeRichHtml((ar ? brand.descriptionAr : brand.descriptionEn) ?? brand.descriptionEn);

  const dbProducts = await prisma.product.findMany({
    where: { status: 'PUBLISHED', brandId: brand.id, AND: [visibleProductWhere] },
    include: cardProductInclude,
    orderBy: { ratingCount: 'desc' },
    take: 60,
  });
  const products = dbProducts.map((p) => toCardProduct(p, locale));

  const schemaOverrides =
    brand.schemaOverridesJson && typeof brand.schemaOverridesJson === 'object' && !Array.isArray(brand.schemaOverridesJson)
      ? (brand.schemaOverridesJson as Record<string, unknown>)
      : {};
  const brandSlug = (ar ? brand.slugAr : brand.slug) ?? brand.slug;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Brand',
    name,
    logo: brand.ogImage || brand.logoUrl || undefined,
    url: `https://veeey.com/${locale}/brands/${brandSlug}`,
    ...schemaOverrides,
  };
  // Breadcrumb rich result — mirrors the visible Home › Brands › brand trail.
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { name: tb('Home', 'الرئيسية'), item: `https://veeey.com/${locale}` },
      { name: tb('Brands', 'العلامات التجارية'), item: `https://veeey.com/${locale}/brands` },
      { name, item: `https://veeey.com/${locale}/brands/${brandSlug}` },
    ].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <div className="mb-3.5 flex items-center gap-2 text-[13px] text-[color:var(--text-muted)]">
        <Link href="/">{tb('Home', 'الرئيسية')}</Link>
        <Icon name={locale === 'ar' ? 'chevron-left' : 'chevron-right'} size={14} color="var(--slate-45)" />
        <Link href="/brands">{tb('Brands', 'العلامات التجارية')}</Link>
        <Icon name={locale === 'ar' ? 'chevron-left' : 'chevron-right'} size={14} color="var(--slate-45)" />
        <span className="font-semibold text-slate">{name}</span>
      </div>

      <div className="mb-2"><AdminEditLink href={`/admin/brands/edit/${brand.id}`} locale={locale} /></div>

      <header className="overflow-hidden rounded-[20px] border border-[color:var(--green-dark-05)] bg-white">
        {brand.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.bannerUrl} alt="" className="h-44 w-full object-cover sm:h-56" />
        )}
        <div className="flex flex-wrap items-center gap-6 p-6 sm:p-8">
          {brand.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={name} className="max-h-20 max-w-[160px] shrink-0 object-contain" />
          )}
          <div className="min-w-[240px] flex-1">
            <h1 className="text-[clamp(26px,3.2vw,36px)] font-bold text-green-dark">{name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-[color:var(--text-muted)]">
              <Icon name="badge-check" size={15} color="var(--success)" />
              {tb('Genuine imports, sourced authentically', 'واردات أصلية بمصادر موثوقة')}
            </p>
          </div>
        </div>
        {hasRichContent(storyHtml) && (
          <div className="veeey-rich border-t border-[color:var(--slate-border)] p-6 leading-relaxed text-[color:var(--text-body)] sm:p-8" dangerouslySetInnerHTML={{ __html: storyHtml }} />
        )}
      </header>

      <section className="mt-9">
        <h2 className="mb-5 text-xl font-bold text-green-dark">
          {tb(`Shop ${name} (${products.length})`, `تسوّق ${name} (${products.length})`)}
        </h2>
        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-[18px]">
            {products.map((p) => (
              <ChewyProductCard key={p.slug} product={p} locale={locale} />
            ))}
          </div>
        ) : (
          <p className="text-[color:var(--text-muted)]">{tb('No products from this brand right now.', 'لا توجد منتجات من هذه العلامة حاليًا.')}</p>
        )}
      </section>
    </div>
  );
}
