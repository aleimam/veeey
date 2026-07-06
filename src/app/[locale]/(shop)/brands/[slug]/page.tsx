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

const loadBrand = (slug: string) => prisma.brand.findFirst({ where: { slug, archivedAt: null } });

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const b = await loadBrand(slug);
  if (!b) return {};
  const name = (locale === 'ar' ? b.nameAr : b.nameEn) ?? b.nameEn;
  const desc =
    (locale === 'ar' ? b.metaDescAr : b.metaDescEn) ??
    richToText((locale === 'ar' ? b.descriptionAr : b.descriptionEn) ?? b.descriptionEn) ??
    undefined;
  return { title: (locale === 'ar' ? b.metaTitleAr : b.metaTitleEn) ?? `${name} — Veeey`, description: desc || undefined };
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

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      <div className="mb-3.5 flex items-center gap-2 text-[13px] text-[color:var(--text-muted)]">
        <Link href="/">{tb('Home', 'الرئيسية')}</Link>
        <Icon name="chevron-right" size={14} color="var(--slate-45)" />
        <Link href="/brands">{tb('Brands', 'العلامات التجارية')}</Link>
        <Icon name="chevron-right" size={14} color="var(--slate-45)" />
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
