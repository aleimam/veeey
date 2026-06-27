import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { getFeaturedCollectionId } from '@/lib/home-content-service';
import { resolveCollectionProducts } from '@/lib/content-service';
import { toCardProduct, cardProductInclude, visibleProductWhere } from '@/lib/storefront';
import { ChewyHome } from '@/components/storefront/chewy/chewy-home';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  let bestsellers: ReturnType<typeof toCardProduct>[] = [];
  let deals: ReturnType<typeof toCardProduct>[] = [];
  try {
    const featuredId = await getFeaturedCollectionId();
    const featuredIds = featuredId ? (await resolveCollectionProducts(featuredId)).slice(0, 8).map((p) => p.id) : [];
    const dbProducts =
      featuredId && featuredIds.length
        ? await prisma.product.findMany({ where: { id: { in: featuredIds }, status: 'PUBLISHED', AND: [visibleProductWhere] }, include: cardProductInclude })
        : await prisma.product.findMany({
            where: { status: 'PUBLISHED', AND: [visibleProductWhere] },
            include: cardProductInclude,
            orderBy: [{ ratingCount: 'desc' }, { updatedAt: 'desc' }],
            take: 8,
          });
    bestsellers = dbProducts.map((p) => toCardProduct(p, locale));

    const dealProducts = await prisma.product.findMany({
      where: { status: 'PUBLISHED', lots: { some: { saleFlag: true } }, AND: [visibleProductWhere] },
      include: cardProductInclude,
      orderBy: [{ updatedAt: 'desc' }],
      take: 6,
    });
    deals = dealProducts.map((p) => toCardProduct(p, locale));
  } catch {
    bestsellers = [];
    deals = [];
  }
  if (deals.length === 0) deals = bestsellers.slice(0, 3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: bestsellers.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: `${p.brand} ${p.name}`.trim() })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ChewyHome locale={locale} bestsellers={bestsellers} deals={deals} />
    </>
  );
}
