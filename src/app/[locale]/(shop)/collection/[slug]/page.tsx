import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/prisma';
import { getPublishedCollectionBySlug, collectionRuleWhere, collectionRuleOrderBy } from '@/lib/content-service';
import { toCardProduct, cardProductInclude, visibleProductWhere } from '@/lib/storefront';
import { sanitizeRichHtml, richToText } from '@/lib/rich-text';
import { pick } from '@/lib/admin-i18n';
import { ChewyProductCard } from '@/components/storefront/chewy/chewy-product-card';
import { AdminEditLink } from '@/components/storefront/admin-edit-link';

// Deduped across generateMetadata + the page body within one request.
const loadCollection = cache((slug: string) => getPublishedCollectionBySlug(slug));

/** Resolve a published collection's products as storefront cards (manual order
 *  or the category/tag rule), applying the usual visibility filter. */
async function cardProducts(c: NonNullable<Awaited<ReturnType<typeof getPublishedCollectionBySlug>>>, locale: string) {
  if (c.type === 'MANUAL') {
    if (!c.orderedProductIds.length) return [];
    const rows = await prisma.product.findMany({
      where: { id: { in: c.orderedProductIds }, status: 'PUBLISHED', AND: [visibleProductWhere] },
      include: cardProductInclude,
    });
    const order = new Map(c.orderedProductIds.map((id, i) => [id, i]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return rows.map((p) => toCardProduct(p, locale));
  }
  const rows = await prisma.product.findMany({
    where: { status: 'PUBLISHED', AND: [visibleProductWhere, collectionRuleWhere(c)] },
    include: cardProductInclude,
    orderBy: collectionRuleOrderBy(c),
    take: 60,
  });
  return rows.map((p) => toCardProduct(p, locale));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const c = await loadCollection(slug);
  if (!c) return {};
  const ar = locale === 'ar';
  const name = (ar ? c.titleAr : c.titleEn) || c.titleEn;
  const title = ((ar ? c.metaTitleAr : c.metaTitleEn) || `${name} — Veeey`) as string;
  const desc = ((ar ? c.metaDescAr : c.metaDescEn) || richToText((ar ? c.descriptionAr : c.descriptionEn) ?? c.descriptionEn)) || undefined;
  const url = `/${locale}/collection/${c.slug}`;
  return {
    metadataBase: new URL('https://veeey.com'),
    title,
    description: desc,
    alternates: { canonical: url, languages: { en: `/en/collection/${c.slug}`, ar: `/ar/collection/${c.slug}` } },
    openGraph: { title, description: desc, url, siteName: 'Veeey', images: c.imageUrl ? [c.imageUrl] : undefined, type: 'website' },
    twitter: { card: 'summary_large_image', title, description: desc, images: c.imageUrl ? [c.imageUrl] : undefined },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const ar = locale === 'ar';
  const c = await loadCollection(slug);
  if (!c) notFound(); // Draft/Archived/unknown → 404

  const name = (ar ? c.titleAr : c.titleEn) || c.titleEn;
  const descHtml = sanitizeRichHtml((ar ? c.descriptionAr : c.descriptionEn) ?? c.descriptionEn);
  const alt = (ar ? c.imageAltAr : c.imageAltEn) || name;
  const products = await cardProducts(c, locale);

  // Breadcrumb rich result — mirrors the visible Home › Collections › collection trail.
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { name: tb('Home', 'الرئيسية'), item: `https://veeey.com/${locale}` },
      { name: tb('Collections', 'المجموعات'), item: `https://veeey.com/${locale}/collections` },
      { name, item: `https://veeey.com/${locale}/collection/${c.slug}` },
    ].map((cx, i) => ({ '@type': 'ListItem', position: i + 1, name: cx.name, item: cx.item })),
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      <div className="mb-3.5 flex items-center gap-2 text-[13px] text-[color:var(--text-muted)]">
        <Link href="/">{tb('Home', 'الرئيسية')}</Link>
        <span>›</span>
        <Link href="/collections">{tb('Collections', 'المجموعات')}</Link>
        <span>›</span>
        <span className="font-semibold text-slate">{name}</span>
      </div>

      {c.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- CMS banner, arbitrary host
        <img src={c.imageUrl} alt={alt} className="mb-5 max-h-[280px] w-full rounded-[16px] object-cover" />
      )}

      <div className="mb-5">
        <AdminEditLink href={`/admin/collections/edit/${c.id}`} locale={locale} />
        <h1 className="text-[clamp(28px,3.4vw,38px)] font-bold text-green-dark">{name}</h1>
        {descHtml && <div className="veeey-rich mt-2 max-w-3xl text-[color:var(--text-muted)]" dangerouslySetInnerHTML={{ __html: descHtml }} />}
        <div className="mt-1 text-sm text-[color:var(--text-muted)]">
          {tb(`${products.length} products`, `${products.length} منتجًا`)}
        </div>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-[18px]">
          {products.map((p) => <ChewyProductCard key={p.slug} product={p} locale={locale} />)}
        </div>
      ) : (
        <div className="rounded-[16px] border border-dashed border-[color:var(--slate-border)] p-10 text-center">
          <p className="font-semibold text-ink">{tb('No products in this collection yet.', 'لا منتجات في هذه المجموعة بعد.')}</p>
          <Link href="/products" className="mt-4 inline-block text-sm font-semibold text-green-dark hover:text-lime-press">{tb('Browse all products', 'تصفّح كل المنتجات')}</Link>
        </div>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name,
            url: `https://veeey.com/${locale}/collection/${c.slug}`,
            ...(c.imageUrl ? { image: c.imageUrl } : {}),
          }),
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </div>
  );
}
