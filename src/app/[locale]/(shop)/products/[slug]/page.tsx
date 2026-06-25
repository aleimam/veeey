import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { pick } from '@/lib/admin-i18n';
import { prisma } from '@/lib/prisma';
import { piastresToEgp } from '@/lib/format';
import { ChewyBuyBox } from '@/components/storefront/chewy/chewy-buy-box';
import type { BuyLot } from '@/components/storefront/buy-box';
import { TrackView } from '@/components/analytics/track-view';
import { toggleWishlistAction, toggleCompareAction } from '@/server/engagement-actions';
import { RecentlyViewedTracker } from '@/components/storefront/recently-viewed-tracker';
import { ChewyProductCard } from '@/components/storefront/chewy/chewy-product-card';
import { frequentlyBoughtTogether, recentlyViewed } from '@/lib/personalization-service';
import { submitReviewAction } from '@/server/play-actions';
import { Icon } from '@/components/storefront/ui/icon';
import { Rating } from '@/components/storefront/ui/rating';
import { Link } from '@/i18n/navigation';

const monthYear = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
const inputCls =
  'block w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-slate-45 focus:border-lime focus:bg-white';

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

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { slug, locale } = await params;
  const p = await loadProduct(slug);
  if (!p) return {};
  const name = (locale === 'ar' ? p.nameAr : p.nameEn) ?? p.nameEn;
  const desc = (locale === 'ar' ? p.metaDescAr : p.metaDescEn) ?? p.shortDescEn ?? undefined;
  return { title: `${name} — Veeey`, description: desc ?? undefined };
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const p = await loadProduct(slug);
  if (!p) notFound();

  const t = await getTranslations('storefront.pdp');
  const tb = pick(locale);
  const name = (locale === 'ar' ? p.nameAr : p.nameEn) ?? p.nameEn;
  const brandName = (locale === 'ar' ? p.brand?.nameAr : p.brand?.nameEn) ?? p.brand?.nameEn ?? undefined;
  const longDesc = (locale === 'ar' ? p.longDescAr : p.longDescEn) ?? p.longDescEn ?? p.shortDescEn;
  const images = p.images.length ? p.images : [{ id: 'ph', url: '/placeholder.svg', alt: name }];

  const buyLots: BuyLot[] = p.lots.map((l) => ({
    id: l.id,
    expiry: l.expiryDate ? monthYear(l.expiryDate) : null,
    pricePiastres: Number(l.priceOverridePiastres ?? p.basePricePiastres),
    sale: l.saleFlag && l.priceOverridePiastres != null,
    qty: l.qtyOnHand,
  }));
  const basePrice = Number(p.basePricePiastres);
  const points = Math.round(basePrice / 100);

  const specs = p.attributeValues.map((av) => ({
    name: (locale === 'ar' ? av.attributeValue.attribute.nameAr : av.attributeValue.attribute.nameEn) ?? av.attributeValue.attribute.nameEn,
    value: (locale === 'ar' ? av.attributeValue.valueAr : av.attributeValue.valueEn) ?? av.attributeValue.valueEn,
  }));

  const [fbt, alsoViewed] = await Promise.all([frequentlyBoughtTogether(p.id, locale), recentlyViewed(locale, p.id)]);
  const related = (fbt.length ? fbt : alsoViewed).slice(0, 5);

  const counts = [5, 4, 3, 2, 1].map((s) => p.reviews.filter((r) => r.rating === s).length);
  const totalReviews = counts.reduce((a, b) => a + b, 0);
  const bars = [5, 4, 3, 2, 1].map((s, i) => ({ stars: s, pct: totalReviews ? Math.round((counts[i] / totalReviews) * 100) : 0 }));

  const offerPrice = buyLots[0]?.pricePiastres ?? basePrice;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    brand: p.brand?.nameEn,
    sku: p.sku,
    image: images[0]?.url,
    offers: { '@type': 'Offer', price: piastresToEgp(BigInt(offerPrice)), priceCurrency: 'EGP', availability: buyLots.length ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder' },
    ...(p.ratingCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.ratingAvg ?? 0, reviewCount: p.ratingCount } } : {}),
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-14 pt-5 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <TrackView name="product_view" props={{ sku: p.sku, slug, name }} />
      <RecentlyViewedTracker productId={p.id} />

      <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px] text-[color:var(--text-muted)]">
        <Link href="/">{tb('Home', 'الرئيسية')}</Link>
        <Icon name="chevron-right" size={14} color="var(--slate-45)" />
        <Link href="/products">{tb('Shop', 'المتجر')}</Link>
        {brandName && (
          <>
            <Icon name="chevron-right" size={14} color="var(--slate-45)" />
            <span className="font-semibold text-slate">{brandName}</span>
          </>
        )}
      </div>

      <div className="grid items-start gap-12 lg:grid-cols-2">
        <div>
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[20px] border border-[color:var(--green-dark-05)]" style={{ background: 'linear-gradient(160deg,#fff,var(--surface) 70%)' }}>
            <Image src={images[0].url} alt={name} fill sizes="(max-width:1024px) 100vw, 45vw" className="object-contain p-[8%]" />
          </div>
          {images.length > 1 && (
            <div className="mt-3.5 flex gap-3">
              {images.slice(0, 4).map((img, n) => (
                <div key={img.id} className={`relative size-[72px] overflow-hidden rounded-[12px] bg-white ${n === 0 ? 'border-2 border-green-dark' : 'border border-[color:var(--slate-border)]'}`}>
                  <Image src={img.url} alt="" fill sizes="72px" className="object-contain p-1.5" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-[130px]">
          <ChewyBuyBox brand={brandName} name={name} rating={p.ratingAvg ?? 0} reviews={p.ratingCount} basePricePiastres={basePrice} lots={buyLots} productId={p.id} points={points} locale={locale} />
          <div className="mt-4 flex gap-5 text-sm">
            <form action={toggleWishlistAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="productId" value={p.id} />
              <input type="hidden" name="back" value={`/products/${slug}`} />
              <button className="font-medium text-green-dark transition-colors hover:text-lime-press">{t('saveWishlist')}</button>
            </form>
            <form action={toggleCompareAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="productId" value={p.id} />
              <input type="hidden" name="back" value="/compare" />
              <button className="font-medium text-green-dark transition-colors hover:text-lime-press">{t('addCompare')}</button>
            </form>
          </div>
        </div>
      </div>

      <div className="mt-12 max-w-3xl space-y-10">
        {longDesc && (
          <section>
            <h2 className="mb-3 text-xl font-bold text-green-dark">{t('about')}</h2>
            <p className="whitespace-pre-line leading-relaxed text-[color:var(--text-body)]">{longDesc}</p>
          </section>
        )}

        {specs.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl font-bold text-green-dark">{t('specs')}</h2>
            <dl className="overflow-hidden rounded-[12px] border border-[color:var(--slate-border)]">
              {specs.map((s, i) => (
                <div key={i} className="flex border-t border-[color:var(--slate-border)] first:border-t-0">
                  <dt className="w-1/3 bg-surface p-3 text-sm font-semibold text-ink">{s.name}</dt>
                  <dd className="p-3 text-sm text-[color:var(--text-muted)]">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-xl font-bold text-green-dark">{t('reviews')}</h2>
          {p.aiReviewSummary && (
            <div className="mb-5 rounded-[12px] border border-[color:var(--green-dark-12)] bg-green-wash p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-green-dark">{t('aiSummary')}</p>
              <p className="mt-1 text-sm text-ink">{p.aiReviewSummary}</p>
            </div>
          )}

          {totalReviews > 0 && (
            <div className="mb-6 grid gap-8 sm:grid-cols-[260px_1fr]">
              <div>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-5xl font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>{(p.ratingAvg ?? 0).toFixed(1)}</span>
                  <div>
                    <Rating value={p.ratingAvg ?? 0} />
                    <div className="mt-0.5 text-[13px] text-[color:var(--text-muted)]">{t('reviewsCount', { count: p.ratingCount })}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-1.5">
                  {bars.map((b) => (
                    <div key={b.stars} className="flex items-center gap-2.5">
                      <span className="w-9 text-[12.5px] text-[color:var(--text-muted)]">{b.stars} ★</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface"><span className="block h-full bg-gold" style={{ width: `${b.pct}%` }} /></span>
                      <span className="w-9 text-end text-xs text-[color:var(--text-subtle)]">{b.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <ul className="flex flex-col gap-4">
                {p.reviews.slice(0, 6).map((r) => (
                  <li key={r.id} className="border-b border-[color:var(--slate-border)] pb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-9 items-center justify-center rounded-full bg-green-wash text-[15px] font-bold text-green-dark">{(r.authorName ?? 'V').slice(0, 1).toUpperCase()}</span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-ink">{r.authorName ?? tb('Verified buyer', 'مشترٍ موثّق')}</div>
                        <div className="text-xs text-[color:var(--text-subtle)]">{r.createdAt.toISOString().slice(0, 10)}</div>
                      </div>
                      <Rating value={r.rating} />
                    </div>
                    {r.title && <div className="mt-2.5 text-[14.5px] font-bold text-ink">{r.title}</div>}
                    {r.body && <p className="mt-1 text-sm leading-relaxed text-[color:var(--text-muted)]">{r.body}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {totalReviews === 0 && <p className="mb-4 text-sm text-[color:var(--text-muted)]">{t('noReviews')}</p>}

          <form action={submitReviewAction} className="space-y-3 rounded-[12px] border border-[color:var(--slate-border)] p-4">
            <p className="text-sm font-semibold text-ink">{t('writeReview')}</p>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="productId" value={p.id} />
            <input type="hidden" name="slug" value={slug} />
            <label className="block text-sm text-ink">
              {t('rating')}
              <select name="rating" defaultValue="5" className={`${inputCls} mt-1 w-24`}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n} ★</option>
                ))}
              </select>
            </label>
            <input name="title" placeholder={t('titlePlaceholder')} className={inputCls} />
            <textarea name="body" rows={3} placeholder={t('bodyPlaceholder')} className={inputCls} />
            <input name="media" placeholder={t('mediaPlaceholder')} className={inputCls} />
            <p className="text-xs text-[color:var(--text-muted)]">{t('moderationNote')}</p>
            <button className="v-btn v-btn--primary v-btn--sm">{t('submitReview')}</button>
          </form>
        </section>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-2xl font-bold text-green-dark">{tb('You may also like', 'قد يعجبك أيضًا')}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {related.map((r) => <ChewyProductCard key={r.slug} product={r} locale={locale} />)}
          </div>
        </section>
      )}
    </div>
  );
}
