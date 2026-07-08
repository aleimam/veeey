import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { analyzeSeo } from '@/lib/seo-analyzer';

/**
 * Catalog-level SEO health (SEO epic C4): scores every sellable product with
 * the same pure analyzer the product-form panel uses, EN always and AR when
 * any Arabic content exists. Sorting/filtering happens on the page via the
 * admin-list clientPage helper.
 */

export type SeoHealthRow = {
  id: string;
  sku: string;
  name: string;
  status: string;
  scoreEn: number;
  scoreAr: number | null; // null = no Arabic content at all
  missingKeyword: boolean; // no focus keyword in either language
  issues: string[]; // top failing EN checks (details)
};

export type SeoHealthSummary = { total: number; good: number; ok: number; poor: number; missingKeyword: number };

export async function seoHealthReport(): Promise<{ rows: SeoHealthRow[]; summary: SeoHealthSummary }> {
  await requirePermission('catalog.read');
  const products = await prisma.product.findMany({
    where: { status: { in: ['PUBLISHED', 'PRIVATE'] } },
    select: {
      id: true, sku: true, status: true,
      nameEn: true, nameAr: true, slugEn: true, slugAr: true,
      metaTitleEn: true, metaTitleAr: true, metaDescEn: true, metaDescAr: true,
      focusKeywordEn: true, focusKeywordAr: true,
      longDescEn: true, longDescAr: true,
    },
    orderBy: { nameEn: 'asc' },
  });

  const rows: SeoHealthRow[] = products.map((p) => {
    const en = analyzeSeo({
      keyword: p.focusKeywordEn ?? '',
      title: p.metaTitleEn || p.nameEn,
      metaDesc: p.metaDescEn ?? '',
      slug: p.slugEn,
      contentHtml: p.longDescEn ?? '',
    });
    const hasAr = !!(p.nameAr || p.longDescAr || p.focusKeywordAr || p.metaTitleAr);
    const ar = hasAr
      ? analyzeSeo({
          keyword: p.focusKeywordAr ?? '',
          title: p.metaTitleAr || p.nameAr || p.nameEn,
          metaDesc: p.metaDescAr ?? '',
          slug: p.slugAr ?? p.slugEn,
          contentHtml: p.longDescAr ?? '',
        })
      : null;
    return {
      id: p.id,
      sku: p.sku,
      name: p.nameEn,
      status: p.status,
      scoreEn: en.score,
      scoreAr: ar?.score ?? null,
      missingKeyword: !p.focusKeywordEn?.trim() && !p.focusKeywordAr?.trim(),
      issues: en.checks.filter((c) => c.status === 'fail').slice(0, 3).map((c) => c.detail),
    };
  });

  const summary: SeoHealthSummary = {
    total: rows.length,
    good: rows.filter((r) => r.scoreEn >= 80).length,
    ok: rows.filter((r) => r.scoreEn >= 50 && r.scoreEn < 80).length,
    poor: rows.filter((r) => r.scoreEn < 50).length,
    missingKeyword: rows.filter((r) => r.missingKeyword).length,
  };
  return { rows, summary };
}
