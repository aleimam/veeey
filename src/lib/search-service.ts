import { prisma } from '@/lib/prisma';
import { cardProductInclude } from '@/lib/storefront';

/**
 * Product search (FR-SCH-01/02). The production driver is a dedicated engine
 * (Typesense/Meilisearch — Arabic-aware + typo-tolerant), selected via
 * SEARCH_DRIVER env in a later phase. This default DB driver keeps search
 * functional in dev/CI: bilingual contains-match across name/SKU/brand/tags.
 * Every query (incl. zero-result) is logged for the search dashboard (FR-SCH-03).
 */
export async function searchProducts(query: string) {
  const q = query.trim();
  if (!q) return [];

  const products = await prisma.product.findMany({
    where: {
      status: 'PUBLISHED',
      OR: [
        { nameEn: { contains: q, mode: 'insensitive' } },
        { nameAr: { contains: q } },
        { sku: { contains: q, mode: 'insensitive' } },
        { brand: { nameEn: { contains: q, mode: 'insensitive' } } },
        { tags: { some: { nameEn: { contains: q, mode: 'insensitive' } } } },
      ],
    },
    include: { ...cardProductInclude, categories: { select: { id: true } } },
    take: 60,
  });

  // Log the search + outcome (best-effort).
  await prisma.analyticsEvent
    .create({ data: { type: 'search', path: `/search?q=${encodeURIComponent(q)}`, propsJson: { q, results: products.length } } })
    .catch(() => {});

  return products;
}
