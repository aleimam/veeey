import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { applyTierPrice, type PriceModifier } from '@/lib/pricing';

/** Effective per-tier price for a product (FR-PRC-03). Resolves the tier's PRICE
 *  rules that match the product's categories/tags/attributes and applies the best. */
export async function effectiveTierPrice(productId: string, tierId: string | null): Promise<bigint> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: { categories: { select: { id: true } }, tags: { select: { id: true } }, attributeValues: { select: { attributeValueId: true } } },
  });
  if (!tierId) return product.basePricePiastres;

  const rules = await prisma.tierProductRule.findMany({ where: { tierId, effect: 'PRICE' } });
  const catIds = new Set(product.categories.map((c) => c.id));
  const tagIds = new Set(product.tags.map((t) => t.id));
  const attrIds = new Set(product.attributeValues.map((a) => a.attributeValueId));

  const modifiers: PriceModifier[] = rules
    .filter((r) =>
      r.matchType === 'CATEGORY' ? catIds.has(r.matchValue)
        : r.matchType === 'TAG' ? tagIds.has(r.matchValue)
          : attrIds.has(r.matchValue),
    )
    .filter((r) => r.priceModifierType != null && r.priceModifierValue != null)
    .map((r) => ({ type: r.priceModifierType as 'PERCENT' | 'FIXED', value: r.priceModifierValue! }));

  return applyTierPrice(product.basePricePiastres, modifiers);
}

/**
 * Batched effectiveTierPrice for a whole cart / order (Codex audit P0 — the
 * per-product version is an N+1 and was only ever called once, on the PDP).
 *
 * Contains ONLY products this tier actually discounts. An entry that merely
 * echoed the base price would act as a price ceiling in effectiveUnitPrice and
 * undercharge lots priced above base, so "no tier discount" is expressed as an
 * absent key, never as a base-price entry.
 */
export async function tierPriceMap(productIds: string[], tierId: string | null): Promise<Map<string, bigint>> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0 || !tierId) return new Map();

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      basePricePiastres: true,
      categories: { select: { id: true } },
      tags: { select: { id: true } },
      attributeValues: { select: { attributeValueId: true } },
    },
  });
  const rules = await prisma.tierProductRule.findMany({ where: { tierId, effect: 'PRICE' } });
  // No rules for this tier — nothing is discounted. Skips the matching work
  // entirely, which is today's reality on both stores (zero PRICE rules exist).
  if (rules.length === 0) return new Map();

  const out = new Map<string, bigint>();
  for (const p of products) {
    const catIds = new Set(p.categories.map((c) => c.id));
    const tagIds = new Set(p.tags.map((t) => t.id));
    const attrIds = new Set(p.attributeValues.map((a) => a.attributeValueId));
    const modifiers: PriceModifier[] = rules
      .filter((r) =>
        r.matchType === 'CATEGORY' ? catIds.has(r.matchValue)
          : r.matchType === 'TAG' ? tagIds.has(r.matchValue)
            : attrIds.has(r.matchValue),
      )
      .filter((r) => r.priceModifierType != null && r.priceModifierValue != null)
      .map((r) => ({ type: r.priceModifierType as 'PERCENT' | 'FIXED', value: r.priceModifierValue! }));
    const tierPrice = applyTierPrice(p.basePricePiastres, modifiers);
    if (tierPrice < p.basePricePiastres) out.set(p.id, tierPrice);
  }
  return out;
}

/** The signed-in customer's tier, or null for guests / signed-out sessions. */
export async function currentTierId(): Promise<string | null> {
  const session = await auth();
  const customerId = session?.user?.customerId ?? null;
  if (!customerId) return null;
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { tierId: true } });
  return c?.tierId ?? null;
}
