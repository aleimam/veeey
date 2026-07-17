import { prisma } from '@/lib/prisma';
import { cardProductInclude, visibleProductWhere } from '@/lib/storefront';
import { topSearches } from '@/lib/analytics-service';
import { normalizeQuery, isPlaceholderTerm } from '@/lib/search-normalize';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Product search (FR-SCH-01/02). Bilingual contains-match across name/SKU/brand/
 * tags, expanded with admin synonyms, plus a pg_trgm fuzzy top-up so typos still
 * find products. Every query is logged (SearchQuery) for the search dashboard;
 * clicks are logged via logSearchClick.
 */
export type SearchContext = { sessionId?: string | null; customerId?: string | null; locale?: string; source?: string };

/** Terms to match on = the raw query, its normalized form, and any admin synonyms. */
async function expandTerms(raw: string): Promise<string[]> {
  const norm = normalizeQuery(raw);
  const terms = new Set<string>([raw.trim(), norm].filter(Boolean));
  try {
    const [direct, reverse] = await Promise.all([
      prisma.searchSynonym.findUnique({ where: { normalized: norm } }),
      prisma.searchSynonym.findMany({ where: { synonyms: { has: norm } }, take: 5 }),
    ]);
    direct?.synonyms.forEach((s) => terms.add(s));
    for (const r of reverse) { terms.add(r.normalized); r.synonyms.forEach((s) => terms.add(s)); }
  } catch {
    // synonyms table missing → just the base terms
  }
  return [...terms].filter((t) => t.length >= 2).slice(0, 12);
}

export async function searchProducts(query: string, ctx?: SearchContext) {
  const raw = query.trim();
  if (!raw) return [];
  const terms = await expandTerms(raw);
  const productInclude = { ...cardProductInclude, categories: { select: { id: true } } };

  const or: Prisma.ProductWhereInput[] = terms.flatMap((t) => [
    { nameEn: { contains: t, mode: 'insensitive' as const } },
    { nameAr: { contains: t } },
    { sku: { contains: t, mode: 'insensitive' as const } },
    { brand: { nameEn: { contains: t, mode: 'insensitive' as const } } },
    { tags: { some: { nameEn: { contains: t, mode: 'insensitive' as const } } } },
  ]);
  let products = await prisma.product.findMany({
    where: { status: 'PUBLISHED', AND: [visibleProductWhere], OR: or },
    include: productInclude,
    take: 60,
  });

  // Fuzzy top-up (typos) when precise matches are thin — pg_trgm similarity.
  if (products.length < 8) {
    const qn = normalizeQuery(raw);
    let ids: string[] = [];
    try {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Product"
        WHERE "status" = 'PUBLISHED'
          AND (similarity(lower("nameEn"), ${qn}) > 0.3 OR similarity(coalesce(lower("nameAr"), ''), ${qn}) > 0.3)
        ORDER BY GREATEST(similarity(lower("nameEn"), ${qn}), similarity(coalesce(lower("nameAr"), ''), ${qn})) DESC
        LIMIT 30`;
      const have = new Set(products.map((p) => p.id));
      ids = rows.map((r) => r.id).filter((id) => !have.has(id));
    } catch {
      // pg_trgm not installed → skip the fuzzy pass
    }
    if (ids.length) {
      const extra = await prisma.product.findMany({ where: { id: { in: ids }, status: 'PUBLISHED', AND: [visibleProductWhere] }, include: productInclude });
      const rank = new Map(ids.map((id, i) => [id, i]));
      extra.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
      products = [...products, ...extra].slice(0, 60);
    }
  }

  // Log the query (best-effort) — powers the search analytics dashboard.
  // Placeholder tokens (crawlers hitting the literal `{search_term_string}`
  // sitelinks template) are never logged (V5 audit F7).
  if (!isPlaceholderTerm(raw)) {
    prisma.searchQuery
      .create({ data: { term: raw.slice(0, 120), normalized: normalizeQuery(raw).slice(0, 120), resultCount: products.length, source: ctx?.source ?? 'results', sessionId: ctx?.sessionId ?? null, customerId: ctx?.customerId ?? null, locale: ctx?.locale ?? 'en' } })
      .catch(() => {});
  }

  return products;
}

/** Record a click on a search result (instant dropdown or results page). */
export async function logSearchClick(input: { term: string; slug?: string | null; productId?: string | null; position?: number; source?: string; sessionId?: string | null }): Promise<void> {
  if (isPlaceholderTerm(input.term)) return; // V5 audit F7 — never log template tokens
  try {
    let productId = input.productId ?? null;
    if (!productId && input.slug) {
      const p = await prisma.product.findFirst({ where: { OR: [{ slugEn: input.slug }, { slugAr: input.slug }] }, select: { id: true } });
      productId = p?.id ?? null;
    }
    await prisma.searchClick.create({ data: { normalized: normalizeQuery(input.term).slice(0, 120), productId, position: input.position ?? 0, source: input.source ?? 'results', sessionId: input.sessionId ?? null } });
  } catch {
    // best-effort
  }
}

/** Trending search terms (last `days` days, most frequent with results). */
export async function trendingSearches(limit = 6, days = 30): Promise<string[]> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const rows = await prisma.searchQuery.groupBy({
      by: ['term'],
      where: { createdAt: { gte: since }, resultCount: { gt: 0 } },
      _count: { term: true },
      orderBy: { _count: { term: 'desc' } },
      take: limit,
    });
    if (rows.length) return rows.map((r) => r.term);
  } catch {
    // fall through to the legacy source
  }
  try {
    return (await topSearches(limit)).map((s) => s.q);
  } catch {
    return [];
  }
}

/** "Did you mean?" — the closest real past query (trigram) to a low-result term. */
export async function didYouMean(term: string): Promise<string | null> {
  const qn = normalizeQuery(term);
  if (qn.length < 3) return null;
  try {
    const rows = await prisma.$queryRaw<{ term: string; sim: number }[]>`
      SELECT "term", similarity("normalized", ${qn}) AS sim
      FROM "SearchQuery"
      WHERE "resultCount" > 0 AND "normalized" <> ${qn} AND similarity("normalized", ${qn}) > 0.4
      GROUP BY "term", "normalized"
      ORDER BY sim DESC, count(*) DESC
      LIMIT 1`;
    return rows[0]?.term ?? null;
  } catch {
    return null;
  }
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

  // Empty query (focused box) → trending searches (last 30 days).
  if (q.length < 2) {
    try {
      return { ...EMPTY_SUGGESTIONS, popular: await trendingSearches(6) };
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
