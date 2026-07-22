import { prisma } from '@/lib/prisma';
import type { RefKind } from '@/lib/config-transfer';

/**
 * The id ⇄ natural-key dictionary a configuration transfer needs.
 *
 * Built once per run rather than queried per row: a collection's rule can point
 * at any category, tag, brand or attribute value in the store, and the tables
 * are small (thousands of rows at most) next to the round-trips avoided.
 *
 * Kept OUT of `config-transfer.ts` so that module stays pure and unit-testable —
 * it is the one that decides what a reference means; this one only looks it up.
 */
export type RefDictionary = {
  /** id → natural key. Used when exporting. */
  toKey: (kind: RefKind, id: string) => string | null;
  /** natural key → id. Used when importing. */
  toId: (kind: RefKind, key: string) => string | null;
  counts: Record<RefKind, number>;
};

export async function refDictionary(): Promise<RefDictionary> {
  const [categories, tags, brands, products, attributeValues] = await Promise.all([
    prisma.category.findMany({ select: { id: true, slug: true } }),
    prisma.tag.findMany({ select: { id: true, slug: true } }),
    prisma.brand.findMany({ select: { id: true, slug: true } }),
    prisma.product.findMany({ select: { id: true, sku: true } }),
    // AttributeValue has no single unique column — its natural key is the
    // attribute's key plus the English value, joined the same way both stores do.
    prisma.attributeValue.findMany({ select: { id: true, valueEn: true, attribute: { select: { key: true } } } }),
  ]);

  const pairs: Record<RefKind, [string, string][]> = {
    category: categories.map((c) => [c.id, c.slug]),
    tag: tags.map((t) => [t.id, t.slug]),
    brand: brands.map((b) => [b.id, b.slug]),
    product: products.map((p) => [p.id, p.sku]),
    attributeValue: attributeValues.map((v) => [v.id, `${v.attribute.key}::${v.valueEn}`]),
  };

  const byId = {} as Record<RefKind, Map<string, string>>;
  const byKey = {} as Record<RefKind, Map<string, string>>;
  const counts = {} as Record<RefKind, number>;
  for (const [kind, list] of Object.entries(pairs) as [RefKind, [string, string][]][]) {
    byId[kind] = new Map(list);
    byKey[kind] = new Map(list.map(([id, key]) => [key, id]));
    counts[kind] = list.length;
  }

  return {
    toKey: (kind, id) => byId[kind].get(id) ?? null,
    toId: (kind, key) => byKey[kind].get(key) ?? null,
    counts,
  };
}
