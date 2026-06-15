import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { piastresToEgp } from '@/lib/format';
import { BuyBox, type BuyLot } from '@/components/storefront/buy-box';
import { DurationCalculator } from '@/components/storefront/duration-calculator';
import { TrackView } from '@/components/analytics/track-view';
import { toggleWishlistAction, toggleCompareAction } from '@/server/engagement-actions';
import { RecentlyViewedTracker } from '@/components/storefront/recently-viewed-tracker';
import { ProductRow } from '@/components/storefront/product-row';
import { frequentlyBoughtTogether, recentlyViewed } from '@/lib/personalization-service';
import { submitReviewAction } from '@/server/play-actions';

const monthYear = (d: Date) =>
  `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

function loadProduct(slug: string) {
  return prisma.product.findFirst({
    where: { status: 'PUBLISHED', OR: [{ slugEn: slug }, { slugAr: slug }] },
    include: {
      brand: true,
      images: { orderBy: { sortOrder: 'asc' } },
      lots: { where: { status: 'LIVE', qtyOnHand: { gt: 0 } }, orderBy: { expiryDate: 'asc' } },
      attributeValues: { include: { attributeValue: { include: { attribute: true } } } },
      reviews: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' }, take: 20, include: { media: true } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const p = await loadProduct(slug);
  if (!p) return {};
  const name = (locale === 'ar' ? p.nameAr : p.nameEn) ?? p.nameEn;
  const desc = (locale === 'ar' ? p.metaDescAr : p.metaDescEn) ?? p.shortDescEn ?? undefined;
  return { title: `${name} — Veeey`, description: desc ?? undefined };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const p = await loadProduct(slug);
  if (!p) notFound();

  const name = (locale === 'ar' ? p.nameAr : p.nameEn) ?? p.nameEn;
  const longDesc = (locale === 'ar' ? p.longDescAr : p.longDescEn) ?? p.longDescEn ?? p.shortDescEn;
  const images = p.images.length ? p.images : [{ id: 'ph', url: '/placeholder.svg', alt: name }];

  const buyLots: BuyLot[] = p.lots.map((l) => ({
    id: l.id,
    expiry: monthYear(l.expiryDate),
    pricePiastres: Number(l.priceOverridePiastres ?? p.basePricePiastres),
    sale: l.saleFlag && l.priceOverridePiastres != null,
    qty: l.qtyOnHand,
  }));

  const t = await getTranslations('storefront.pdp');
  const tRows = await getTranslations('storefront.rows');

  const specs = p.attributeValues.map((av) => ({
    name: (locale === 'ar' ? av.attributeValue.attribute.nameAr : av.attributeValue.attribute.nameEn) ?? av.attributeValue.attribute.nameEn,
    value: (locale === 'ar' ? av.attributeValue.valueAr : av.attributeValue.valueEn) ?? av.attributeValue.valueEn,
  }));

  const [fbt, alsoViewed] = await Promise.all([
    frequentlyBoughtTogether(p.id, locale),
    recentlyViewed(locale, p.id),
  ]);

  const offerPrice = buyLots[0]?.pricePiastres ?? Number(p.basePricePiastres);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    brand: p.brand?.nameEn,
    sku: p.sku,
    image: images[0]?.url,
    offers: {
      '@type': 'Offer',
      price: piastresToEgp(BigInt(offerPrice)),
      priceCurrency: 'EGP',
      availability: buyLots.length ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
    },
    ...(p.ratingCount > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.ratingAvg ?? 0, reviewCount: p.ratingCount } }
      : {}),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <TrackView name="product_view" props={{ sku: p.sku, slug, name }} />
      <RecentlyViewedTracker productId={p.id} />

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-surface">
            <Image src={images[0].url} alt={name} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-3">
              {images.slice(0, 5).map((img) => (
                <div key={img.id} className="relative size-16 overflow-hidden rounded-lg border border-border bg-surface">
                  <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {p.brand && <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{(locale === 'ar' ? p.brand.nameAr : p.brand.nameEn) ?? p.brand.nameEn}</p>}
          <h1 className="mt-1 font-heading text-2xl font-semibold text-foreground sm:text-3xl">{name}</h1>
          {p.ratingCount > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">★ {(p.ratingAvg ?? 0).toFixed(1)} {t('reviewsCount', { count: p.ratingCount })}</p>
          )}

          <div className="mt-5">
            <BuyBox basePricePiastres={Number(p.basePricePiastres)} lots={buyLots} productId={p.id} locale={locale} />
          </div>

          <div className="mt-3 flex gap-4 text-sm">
            <form action={toggleWishlistAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="productId" value={p.id} />
              <input type="hidden" name="back" value={`/products/${slug}`} />
              <button className="text-muted-foreground hover:text-primary">{t('saveWishlist')}</button>
            </form>
            <form action={toggleCompareAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="productId" value={p.id} />
              <input type="hidden" name="back" value="/compare" />
              <button className="text-muted-foreground hover:text-primary">{t('addCompare')}</button>
            </form>
          </div>

          {p.servingsPerUnit && p.dailyDosage ? (
            <div className="mt-5">
              <DurationCalculator servings={p.servingsPerUnit} defaultDosage={p.dailyDosage} />
            </div>
          ) : null}
        </div>
      </div>

      {longDesc && (
        <section className="mt-12 max-w-3xl">
          <h2 className="mb-3 font-heading text-lg font-semibold">{t('about')}</h2>
          <p className="whitespace-pre-line leading-relaxed text-foreground/80">{longDesc}</p>
        </section>
      )}

      {specs.length > 0 && (
        <section className="mt-12 max-w-3xl">
          <h2 className="mb-3 font-heading text-lg font-semibold">{t('specs')}</h2>
          <dl className="overflow-hidden rounded-lg border border-border">
            {specs.map((s, i) => (
              <div key={i} className="flex border-t border-border first:border-t-0">
                <dt className="w-1/3 bg-surface p-3 text-sm font-medium text-foreground">{s.name}</dt>
                <dd className="p-3 text-sm text-muted-foreground">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-3 font-heading text-lg font-semibold">{t('reviews')}</h2>

        {p.aiReviewSummary && (
          <div className="mb-5 rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">{t('aiSummary')}</p>
            <p className="mt-1 text-sm text-foreground">{p.aiReviewSummary}</p>
          </div>
        )}

        {p.reviews.length > 0 ? (
          <ul className="space-y-4">
            {p.reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium text-foreground">{'★'.repeat(r.rating)}{r.title ? ` · ${r.title}` : ''}</p>
                {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                {r.media.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {r.media.map((m) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={m.id} src={m.url} alt="" className="size-16 rounded-md object-cover" />
                    ))}
                  </div>
                )}
                {r.authorName && <p className="mt-2 text-xs text-muted-foreground">— {r.authorName}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noReviews')}</p>
        )}

        <form action={submitReviewAction} className="mt-6 space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm font-semibold">{t('writeReview')}</p>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="productId" value={p.id} />
          <input type="hidden" name="slug" value={slug} />
          <label className="block text-sm">{t('rating')}
            <select name="rating" defaultValue="5" className="mt-1 block w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm">
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
            </select>
          </label>
          <input name="title" placeholder={t('titlePlaceholder')} className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <textarea name="body" rows={3} placeholder={t('bodyPlaceholder')} className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <input name="media" placeholder={t('mediaPlaceholder')} className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <p className="text-xs text-muted-foreground">{t('moderationNote')}</p>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t('submitReview')}</button>
        </form>
      </section>

      <div className="-mx-4 mt-8 sm:-mx-6 lg:-mx-8">
        <ProductRow title={t('fbt')} products={fbt} locale={locale} />
        <ProductRow title={tRows('recentlyViewed')} products={alsoViewed} locale={locale} />
      </div>
    </div>
  );
}
