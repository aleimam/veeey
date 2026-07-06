import { prisma } from '@/lib/prisma';
import { cardProductInclude, visibleProductWhere } from '@/lib/storefront';
import { topSearches } from '@/lib/analytics-service';

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
      AND: [visibleProductWhere],
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

/** Autocomplete payload (FR-SCH-02; audit P1 5.2). Kept lean — it renders in a
 *  dropdown on every keystroke. Products carry an explicit stock flag (the
 *  notes ask for in/out-of-stock right in the suggestions). */
export type SearchSuggestions = {
  products: { slug: string; name: string; brand: string; image: string | null; pricePiastres: number; inStock: boolean; preorder: boolean }[];
  brands: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  posts: { slug: string; title: string }[];
  popular: string[];
};

const EMPTY_SUGGESTIONS: SearchSuggestions = { products: [], brands: [], categories: [], posts: [], popular: [] };

export async function suggestSearch(query: string, locale = 'en'): Promise<SearchSuggestions> {
  const q = query.trim().slice(0, 60);
  const ar = locale === 'ar';
  const nameOf = (en: string, arName?: string | null) => (ar ? (arName ?? en) : en);

  // Empty query (focused box) → popular searches from the real clickstream.
  if (q.length < 2) {
    try {
      const popular = (await topSearches(6)).map((s) => s.q);
      return { ...EMPTY_SUGGESTIONS, popular };
    } catch {
      return EMPTY_SUGGESTIONS;
    }
  }

  const [products, brands, categories, posts] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        AND: [visibleProductWhere],
        OR: [
          { nameEn: { contains: q, mode: 'insensitive' } },
          { nameAr: { contains: q } },
          { sku: { contains: q, mode: 'insensitive' } },
          { brand: { nameEn: { contains: q, mode: 'insensitive' } } },
          { tags: { some: { nameEn: { contains: q, mode: 'insensitive' } } } },
          { categories: { some: { nameEn: { contains: q, mode: 'insensitive' } } } },
        ],
      },
      select: {
        slugEn: true, slugAr: true, nameEn: true, nameAr: true, basePricePiastres: true, preorderEnabled: true,
        brand: { select: { nameEn: true, nameAr: true } },
        images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } },
        lots: { where: { status: 'LIVE', qtyOnHand: { gt: 0 } }, take: 1, select: { priceOverridePiastres: true } },
      },
      orderBy: { ratingCount: 'desc' },
      take: 6,
    }),
    prisma.brand.findMany({
      where: { archivedAt: null, OR: [{ nameEn: { contains: q, mode: 'insensitive' } }, { nameAr: { contains: q } }] },
      select: { id: true, nameEn: true, nameAr: true },
      take: 3,
    }),
    prisma.category.findMany({
      where: { OR: [{ nameEn: { contains: q, mode: 'insensitive' } }, { nameAr: { contains: q } }] },
      select: { id: true, nameEn: true, nameAr: true },
      take: 3,
    }),
    prisma.blogPost.findMany({
      where: { status: 'PUBLISHED', OR: [{ titleEn: { contains: q, mode: 'insensitive' } }, { titleAr: { contains: q } }] },
      select: { slug: true, titleEn: true, titleAr: true },
      take: 2,
    }),
  ]);

  return {
    products: products.map((p) => ({
      slug: (ar ? p.slugAr : p.slugEn) ?? p.slugEn,
      name: nameOf(p.nameEn, p.nameAr),
      brand: p.brand ? nameOf(p.brand.nameEn, p.brand.nameAr) : '',
      image: p.images[0]?.url ?? null,
      pricePiastres: Number(p.lots[0]?.priceOverridePiastres ?? p.basePricePiastres),
      inStock: p.lots.length > 0,
      preorder: p.preorderEnabled,
    })),
    brands: brands.map((b) => ({ id: b.id, name: nameOf(b.nameEn, b.nameAr) })),
    categories: categories.map((c) => ({ id: c.id, name: nameOf(c.nameEn, c.nameAr) })),
    posts: posts.map((p) => ({ slug: p.slug, title: nameOf(p.titleEn, p.titleAr) })),
    popular: [],
  };
}
