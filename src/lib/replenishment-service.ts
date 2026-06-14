import { prisma } from '@/lib/prisma';
import { cardProductInclude, toCardProduct } from '@/lib/storefront';
import { daysOfSupply, reorderDueDate, daysUntil } from '@/lib/replenishment';
import type { Product as CardProduct } from '@/components/storefront/product-card';

/** Replenishment reminders (FR-REPL-01). For a customer's delivered orders,
 *  estimate when each consumable runs out and surface "time to reorder". */
export type ReorderSuggestion = { product: CardProduct; supplyDays: number; daysLeft: number };

export async function reorderSuggestions(customerId: string, locale: string, now: Date): Promise<ReorderSuggestion[]> {
  const items = await prisma.orderItem.findMany({
    where: { order: { customerId, status: { in: ['CASH_DELIVERED', 'CARD_DELIVERED'] } } },
    include: { product: { include: cardProductInclude }, order: { select: { placedAt: true } } },
    orderBy: { id: 'desc' },
    take: 100,
  });

  const seen = new Set<string>();
  const out: ReorderSuggestion[] = [];
  for (const it of items) {
    if (seen.has(it.productId)) continue;
    seen.add(it.productId);
    const supply = daysOfSupply(it.product.servingsPerUnit, it.product.dailyDosage, it.qty);
    if (supply == null) continue;
    const due = reorderDueDate(it.order.placedAt, supply);
    out.push({ product: toCardProduct(it.product, locale), supplyDays: supply, daysLeft: daysUntil(now, due) });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}
