import { setRequestLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { getHomeContent } from '@/lib/home-content-service';
import { toCardProduct, cardProductInclude } from '@/lib/storefront';
import { getCurrentUser } from '@/lib/auth-guards';
import { recentlyViewed, recommendedForYou, buyAgain, popularInTier } from '@/lib/personalization-service';
import { ProductRow } from '@/components/storefront/product-row';
import type { Product as CardProduct } from '@/components/storefront/product-card';
import { HeroSection } from '@/components/storefront/hero-section';
import { TrustStrip } from '@/components/storefront/trust-strip';
import { ShopByGoal } from '@/components/storefront/shop-by-goal';
import { Bestsellers } from '@/components/storefront/bestsellers';
import { ExpiryPricing } from '@/components/storefront/expiry-pricing';
import { SpecialOrder } from '@/components/storefront/special-order';
import { Membership } from '@/components/storefront/membership';
import { Testimonials } from '@/components/storefront/testimonials';
import { BlogTeaser } from '@/components/storefront/blog-teaser';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tRows = await getTranslations('storefront.rows');
  const homeContent = await getHomeContent(locale);

  // Degrade gracefully — a DB hiccup should still render the storefront shell.
  let bestsellers: ReturnType<typeof toCardProduct>[] = [];
  try {
    const dbProducts = await prisma.product.findMany({
      where: { status: 'PUBLISHED' },
      include: cardProductInclude,
      orderBy: [{ ratingCount: 'desc' }, { updatedAt: 'desc' }],
      take: 8,
    });
    bestsellers = dbProducts.map((p) => toCardProduct(p, locale));
  } catch {
    bestsellers = [];
  }

  // Personalized rows (FR-PERS-02). Render only when there's a signal.
  let recent: CardProduct[] = [], recommended: CardProduct[] = [], again: CardProduct[] = [], tierPop: CardProduct[] = [];
  let tierName: string | undefined;
  try {
    const user = await getCurrentUser();
    const customer = user?.customerId ? await prisma.customer.findUnique({ where: { id: user.customerId }, select: { tierId: true, tier: { select: { nameEn: true } } } }) : null;
    tierName = customer?.tier?.nameEn ?? undefined;
    recent = await recentlyViewed(locale);
    [recommended, again, tierPop] = await Promise.all([
      recent.length ? recommendedForYou(locale) : Promise.resolve([]),
      user?.customerId ? buyAgain(user.customerId, locale) : Promise.resolve([]),
      user?.customerId ? popularInTier(customer?.tierId ?? null, locale) : Promise.resolve([]),
    ]);
  } catch {
    // personalization is best-effort
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: bestsellers.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${p.brand} ${p.name}`.trim(),
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HeroSection content={homeContent} />
      <TrustStrip />
      <ShopByGoal />
      <Bestsellers products={bestsellers} locale={locale} />
      <ProductRow title={tRows('recentlyViewed')} products={recent} locale={locale} />
      <ProductRow title={tRows('buyAgain')} products={again} locale={locale} />
      <ProductRow title={tierName ? tRows('popularInTier', { tier: tierName }) : tRows('popularNow')} products={tierPop} locale={locale} />
      <ProductRow title={tRows('recommended')} products={recommended} locale={locale} />
      <ExpiryPricing />
      <SpecialOrder />
      <Membership />
      <Testimonials />
      <BlogTeaser />
    </>
  );
}
