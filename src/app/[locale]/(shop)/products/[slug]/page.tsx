import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { pick } from '@/lib/admin-i18n';
import { prisma } from '@/lib/prisma';
import { piastresToEgp } from '@/lib/format';
import { sanitizeRichHtml, hasRichContent, richToText } from '@/lib/rich-text';
import { getSetting } from '@/lib/settings-service';
import { AdminEditLink } from '@/components/storefront/admin-edit-link';
import { ChewyBuyBox } from '@/components/storefront/chewy/chewy-buy-box';
import { ProductGallery } from '@/components/storefront/chewy/product-gallery';
import type { BuyLot } from '@/components/storefront/buy-box';
import { TrackView } from '@/components/analytics/track-view';
import { toggleWishlistAction, toggleCompareAction } from '@/server/engagement-actions';
import { RecentlyViewedTracker } from '@/components/storefront/recently-viewed-tracker';
import { ChewyProductCard } from '@/components/storefront/chewy/chewy-product-card';
import { frequentlyBoughtTogether, recentlyViewed } from '@/lib/personalization-service';
import { publishedQuestions } from '@/lib/qa-service';
import { getFeatureStates } from '@/lib/feature-service';
import { askQuestionAction } from '@/server/play-actions';
import { getZones } from '@/lib/page-zone-service';
import { resolveHomeData, type HomeData } from '@/lib/home-layout-service';
import { ChewyHome } from '@/components/storefront/chewy/chewy-home';
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
  const title = (locale === 'ar' ? p.metaTitleAr : p.metaTitleEn) || `${name} — Veeey`;
  const desc = ((locale === 'ar' ? p.metaDescAr : p.metaDescEn) ?? richToText((locale === 'ar' ? p.shortDescAr : p.shortDescEn) ?? p.shortDescEn)) || undefined;
  const ogTitle = ((locale === 'ar' ? p.ogTitleAr : p.ogTitleEn) || title) as string;
  const ogDesc = ((locale === 'ar' ? p.ogDescAr : p.ogDescEn) || desc) as string | undefined;
  const ogImage = p.ogImage || p.images[0]?.url || undefined;
  const localSlug = (locale === 'ar' ? p.slugAr : p.slugEn) ?? p.slugEn;
  const canonical = p.canonicalUrl || `/${locale}/products/${localSlug}`;
  return {
    metadataBase: new URL('https://veeey.com'),
    title,
    description: desc,
    alternates: { canonical },
    // Robots come from the SEO module; the product PAGE stays indexable even
    // when the product is hidden from shopping FEEDS (separate restriction).
    robots: { index: p.robotsIndex, follow: p.robotsFollow },
    openGraph: { title: ogTitle, description: ogDesc, url: canonical, siteName: 'Veeey', images: ogImage ? [ogImage] : undefined, type: 'website' },
    twitter: { card: 'summary_large_image', title: ogTitle, description: ogDesc, images: ogImage ? [ogImage] : undefined },
  };
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
  const longHtml = sanitizeRichHtml((locale === 'ar' ? p.longDescAr : p.longDescEn) ?? p.longDescEn);
  const shortHtml = sanitizeRichHtml((locale === 'ar' ? p.shortDescAr : p.shortDescEn) ?? p.shortDescEn);
  const ff = await getFeatureStates(); // admin feature switches gate PDP add-ons
  const refillEnabled = ff.refill && (await getSetting('refill.enabled')) === 'true'; // visual subscribe upsell off until real Refill ships
  const depositPercent = Number(await getSetting('preorder.depositPercent')) || 25;
  const images = p.images.length ? p.images : [{ id: 'ph', url: '/placeholder.svg', alt: name }];

  // NEW lots first (FEFO order preserved), condition variants after — so the
  // default buy-box selection is always a NEW unit when one exists.
  const buyLots: BuyLot[] = [...p.lots]
    .sort((a, b) => Number(a.condition !== 'NEW') - Number(b.condition !== 'NEW'))
    .map((l) => ({
      id: l.id,
      expiry: l.expiryDate ? monthYear(l.expiryDate) : null,
      pricePiastres: Number(l.priceOverridePiastres ?? p.basePricePiastres),
      sale: l.saleFlag && l.priceOverridePiastres != null,
      qty: l.qtyOnHand,
      condition: l.condition,
    }));
  const basePrice = Number(p.basePricePiastres);
  const points = Math.round(basePrice / 100);

  const specs = p.attributeValues.map((av) => ({
    name: (locale === 'ar' ? av.attributeValue.attribute.nameAr : av.attributeValue.attribute.nameEn) ?? av.attributeValue.attribute.nameEn,
    value: (locale === 'ar' ? av.attributeValue.valueAr : av.attributeValue.valueEn) ?? av.attributeValue.valueEn,
  }));

  const [fbt, alsoViewed, qa] = await Promise.all([frequentlyBoughtTogether(p.id, locale), recentlyViewed(locale, p.id), publishedQuestions(p.id)]);
  const related = (fbt.length ? fbt : alsoViewed).slice(0, 5);

  const counts = [5, 4, 3, 2, 1].map((s) => p.reviews.filter((r) => r.rating === s).length);
  const totalReviews = counts.reduce((a, b) => a + b, 0);
  const bars = [5, 4, 3, 2, 1].map((s, i) => ({ stars: s, pct: totalReviews ? Math.round((counts[i] / totalReviews) * 100) : 0 }));

  const offerPrice = buyLots[0]?.pricePiastres ?? basePrice;
  const schemaOverrides =
    p.schemaOverridesJson && typeof p.schemaOverridesJson === 'object' && !Array.isArray(p.schemaOverridesJson)
      ? (p.schemaOverridesJson as Record<string, unknown>)
      : {};
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    brand: p.brand?.nameEn,
    sku: p.sku,
    image: p.ogImage || images[0]?.url,
    offers: { '@type': 'Offer', price: piastresToEgp(BigInt(offerPrice)), priceCurrency: 'EGP', availability: buyLots.length ? 'https://schema.org/InStock' : p.preorderEnabled ? 'https://schema.org/PreOrder' : 'https://schema.org/OutOfStock' },
    ...(p.ratingCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.ratingAvg ?? 0, reviewCount: p.ratingCount } } : {}),
    // Admin-edited overrides from the SEO module win over the auto values.
    ...schemaOverrides,
  };

  // Breadcrumb rich result — mirrors the visible trail (Home › Shop › Brand › product).
  const localSlug = (locale === 'ar' ? p.slugAr : p.slugEn) ?? p.slugEn;
  const crumbs = [
    { name: tb('Home', 'الرئيسية'), url: `https://veeey.com/${locale}` },
    { name: tb('Shop', 'المتجر'), url: `https://veeey.com/${locale}/products` },
    ...(brandName && p.brand?.slug ? [{ name: brandName, url: `https://veeey.com/${locale}/brands/${p.brand.slug}` }] : []),
    { name, url: `https://veeey.com/${locale}/products/${localSlug}` },
  ];
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
  };

  const ORIGIN_BADGE: Record<string, { flag: string; en: string; ar: string }> = {
    USA: { flag: '🇺🇸', en: 'Imported from the USA', ar: 'مستورد من الولايات المتحدة' },
    UK: { flag: '🇬🇧', en: 'Imported from the UK', ar: 'مستورد من بريطانيا' },
    EU: { flag: '🇪🇺', en: 'Imported from the EU', ar: 'مستورد من الاتحاد الأوروبي' },
  };
  const originBadge = p.originCountry ? ORIGIN_BADGE[p.originCountry] : null;

  // "At a glance" facts (audit 6.5) — auto-derived, no admin work; nulls skipped.
  const doseText = p.dailyDosage
    ? p.dailyDosageMax && p.dailyDosageMax > p.dailyDosage
      ? tb(`${p.dailyDosage}–${p.dailyDosageMax} per day`, `${p.dailyDosage}–${p.dailyDosageMax} يوميًا`)
      : tb(`${p.dailyDosage} per day`, `${p.dailyDosage} يوميًا`)
    : null;
  const supplyDays = p.servingsPerUnit && p.dailyDosage ? Math.floor(p.servingsPerUnit / p.dailyDosage) : null;
  const glance: { icon: string; label: string; value: string }[] = [
    p.kind === 'DEVICE'
      ? { icon: 'heart-pulse', label: tb('Type', 'النوع'), value: tb('Health device', 'جهاز صحي') }
      : { icon: 'flask-conical', label: tb('Type', 'النوع'), value: p.kind === 'INJECTION' ? tb('Injection', 'حقن') : tb('Dietary supplement', 'مكمل غذائي') },
    ...(p.servingsPerUnit ? [{ icon: 'calendar-days', label: tb('Pack size', 'حجم العبوة'), value: tb(`${p.servingsPerUnit} servings`, `${p.servingsPerUnit} جرعة`) }] : []),
    ...(doseText ? [{ icon: 'check-circle', label: tb('Suggested use', 'الاستخدام المقترح'), value: doseText }] : []),
    ...(supplyDays && supplyDays > 1 ? [{ icon: 'calendar-clock', label: tb('Lasts about', 'تكفي حوالي'), value: tb(`${supplyDays} days`, `${supplyDays} يومًا`) }] : []),
    ...(p.weightG ? [{ icon: 'package', label: tb('Weight', 'الوزن'), value: `${p.weightG} ${tb('g', 'جم')}` }] : []),
    ...(originBadge ? [{ icon: 'globe', label: tb('Origin', 'المنشأ'), value: tb(p.originCountry === 'USA' ? 'Imported · USA' : p.originCountry === 'UK' ? 'Imported · UK' : 'Imported · EU', p.originCountry === 'USA' ? 'مستورد · أمريكا' : p.originCountry === 'UK' ? 'مستورد · بريطانيا' : 'مستورد · أوروبا') }] : []),
    { icon: 'badge-check', label: tb('Authenticity', 'الأصالة'), value: tb('Lot-dated & genuine', 'أصلي بتاريخ تشغيلة') },
  ];

  const zones = await getZones(['pdp.top', 'pdp.bottom']);
  let zoneData: HomeData = { bestsellers: [], deals: [], rows: {} };
  try {
    zoneData = await resolveHomeData([...zones['pdp.top'], ...zones['pdp.bottom']], locale);
  } catch {
    // zone product data is best-effort
  }

  return (
    <>
    {zones['pdp.top'].length > 0 && <ChewyHome locale={locale} blocks={zones['pdp.top']} data={zoneData} states={ff} />}
    <div className="mx-auto max-w-[1440px] px-4 pb-14 pt-5 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
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
        <ProductGallery images={images.map((im) => ({ id: im.id, url: im.url, alt: im.alt }))} name={name} locale={locale} />

        <div className="lg:sticky lg:top-[130px]">
          <div className="mb-3"><AdminEditLink href={`/admin/products/edit/${p.id}`} locale={locale} /></div>
          {originBadge && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--green-dark-05)] bg-green-wash px-3 py-1.5 text-[13px] font-semibold text-green-dark">
              <span aria-hidden>{originBadge.flag}</span> {tb(originBadge.en, originBadge.ar)}
            </div>
          )}
          {/* Short description renders INSIDE the buy box, right under the expiry
              & price selector (owner request 2026-07-13; was below the box). */}
          <ChewyBuyBox brand={brandName} name={name} rating={p.ratingAvg ?? 0} reviews={ff.reviews ? p.ratingCount : 0} basePricePiastres={basePrice} lots={buyLots} productId={p.id} points={ff.loyalty ? points : 0} locale={locale} refillEnabled={refillEnabled} preorderEnabled={p.preorderEnabled && ff.preorder} depositPercent={depositPercent} servingsPerUnit={p.servingsPerUnit} shortHtml={hasRichContent(shortHtml) ? shortHtml : null} />
          {(ff.wishlist || ff.compare) && (
            <div className="mt-4 flex gap-5 text-sm">
              {ff.wishlist && (
                <form action={toggleWishlistAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="productId" value={p.id} />
                  <input type="hidden" name="back" value={`/products/${slug}`} />
                  <button className="font-medium text-green-dark transition-colors hover:text-lime-press">{t('saveWishlist')}</button>
                </form>
              )}
              {ff.compare && (
                <form action={toggleCompareAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="productId" value={p.id} />
                  <input type="hidden" name="back" value="/compare" />
                  <button className="font-medium text-green-dark transition-colors hover:text-lime-press">{t('addCompare')}</button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {glance.length >= 3 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold text-green-dark">{tb('At a glance', 'لمحة سريعة')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {glance.map((g, i) => (
              <div key={i} className="flex flex-col items-center gap-2 rounded-[14px] border border-[color:var(--green-dark-05)] bg-white px-3 py-4 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-green-wash">
                  <Icon name={g.icon} size={22} color="var(--green-dark)" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--text-subtle)]">{g.label}</span>
                <span className="text-[13.5px] font-bold leading-snug text-ink">{g.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 max-w-5xl space-y-10">
        {hasRichContent(longHtml) && (
          <section>
            <h2 className="mb-3 text-xl font-bold text-green-dark">{t('about')}</h2>
            <div className="veeey-rich leading-relaxed text-[color:var(--text-body)]" dangerouslySetInnerHTML={{ __html: longHtml }} />
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

        {ff.reviews && (
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
                        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                          {r.authorName ?? tb('Veeey customer', 'عميل Veeey')}
                          {r.verifiedPurchase && (
                            <span className="rounded-full bg-green-wash px-2 py-0.5 text-[10.5px] font-bold text-green-dark">
                              ✓ {tb('Verified purchase', 'شراء موثّق')}
                            </span>
                          )}
                        </div>
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
        )}

        {ff.qa && (
        <section id="qa" className="scroll-mt-24">
          <h2 className="mb-4 text-xl font-bold text-green-dark">{tb('Questions & answers', 'أسئلة وأجوبة')}</h2>

          {qa.length > 0 ? (
            <ul className="mb-6 space-y-4">
              {qa.map((item) => (
                <li key={item.id} className="rounded-[12px] border border-[color:var(--slate-border)] p-4">
                  <p className="text-[14.5px] font-bold text-ink">{tb('Q:', 'س:')} {item.question}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-body)]">
                    <span className="font-bold text-green-dark">{tb('A:', 'ج:')} </span>{item.answer}
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--text-muted)]">
                    {tb('Answered by the Veeey pharmacy team', 'أجاب عنه فريق صيدلية فيي')}
                    {item.answeredAt ? ` · ${new Date(item.answeredAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB')}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-[color:var(--text-muted)]">{tb('No questions yet — ask the first one and our pharmacists will answer.', 'لا توجد أسئلة بعد — اسأل أول سؤال وسيجيبك صيادلتنا.')}</p>
          )}

          <form action={askQuestionAction} className="space-y-3 rounded-[12px] border border-[color:var(--slate-border)] p-4">
            <p className="text-sm font-semibold text-ink">{tb('Ask a question', 'اسأل سؤالًا')}</p>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="productId" value={p.id} />
            <input type="hidden" name="slug" value={slug} />
            <input name="askerName" placeholder={tb('Your name (optional)', 'اسمك (اختياري)')} className={inputCls} />
            <textarea name="question" rows={3} required minLength={5} placeholder={tb('e.g. Is this suitable during pregnancy?', 'مثال: هل يناسب أثناء الحمل؟')} className={inputCls} />
            <p className="text-xs text-[color:var(--text-muted)]">{tb('Our pharmacists review every question; published answers appear here.', 'يراجع صيادلتنا كل سؤال؛ وتظهر الإجابات المنشورة هنا.')}</p>
            <button className="v-btn v-btn--primary v-btn--sm">{tb('Submit question', 'إرسال السؤال')}</button>
          </form>
        </section>
        )}
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
    {zones['pdp.bottom'].length > 0 && <ChewyHome locale={locale} blocks={zones['pdp.bottom']} data={zoneData} states={ff} />}
    </>
  );
}
