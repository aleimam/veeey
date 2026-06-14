import { prisma } from '@/lib/prisma';
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
