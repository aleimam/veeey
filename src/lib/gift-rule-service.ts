import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { matchGiftRules, nearestSubtotalRule, type GiftRuleRef, type GiftGrant } from '@/lib/gift-rules';

/**
 * Gift-with-purchase automation (owner growth feature). Admin-managed rules
 * (see gift-rules.ts for the pure engine) are applied inside the checkout /
 * staff-order transaction: qualifying orders get their gift auto-attached with
 * an atomic stock claim — best-effort, NEVER blocks or fails the order.
 */

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const toRef = (r: {
  id: string; nameEn: string; nameAr: string | null; giftId: string; giftQty: number; active: boolean;
  minSubtotalPiastres: bigint | null; productId: string | null; categoryId: string | null; startsAt: Date | null; endsAt: Date | null;
}): GiftRuleRef => ({ ...r, minSubtotalPiastres: r.minSubtotalPiastres == null ? null : BigInt(r.minSubtotalPiastres) });

// ---- CRUD (admin) -----------------------------------------------------------

export const listGiftRules = () =>
  prisma.giftRule.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      gift: { select: { internalName: true, code: true, stock: true } },
      product: { select: { nameEn: true, sku: true } },
      category: { select: { nameEn: true } },
    },
  });

export type GiftRuleInput = {
  nameEn: string;
  nameAr?: string | null;
  giftId: string;
  giftQty: number;
  minSubtotalEgp?: number | null;
  productSku?: string | null;
  categoryId?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export async function saveGiftRule(id: string | null, input: GiftRuleInput) {
  const user = await requirePermission('orders.write');
  if (!input.nameEn.trim()) throw new Error('NAME_REQUIRED');
  const gift = await prisma.gift.findUnique({ where: { id: input.giftId }, select: { id: true } });
  if (!gift) throw new Error('GIFT_NOT_FOUND');

  // Product condition is entered by SKU (stable, human-checkable) → resolve to id.
  let productId: string | null = null;
  if (input.productSku?.trim()) {
    const p = await prisma.product.findUnique({ where: { sku: input.productSku.trim() }, select: { id: true } });
    if (!p) throw new Error('SKU_NOT_FOUND');
    productId = p.id;
  }

  const minSubtotalPiastres =
    input.minSubtotalEgp != null && Number.isFinite(input.minSubtotalEgp) && input.minSubtotalEgp > 0
      ? BigInt(Math.round(input.minSubtotalEgp * 100))
      : null;

  const data = {
    nameEn: input.nameEn.trim(),
    nameAr: input.nameAr?.trim() || null,
    giftId: input.giftId,
    giftQty: Math.max(1, Math.floor(input.giftQty) || 1),
    minSubtotalPiastres,
    productId,
    categoryId: input.categoryId || null,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
  };
  if (minSubtotalPiastres == null && !productId && !data.categoryId) throw new Error('NO_CONDITIONS');

  const rule = id
    ? await prisma.giftRule.update({ where: { id }, data })
    : await prisma.giftRule.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'giftrule.update' : 'giftrule.create', entityType: 'GiftRule', entityId: rule.id, data: { nameEn: data.nameEn } });
  return rule;
}

export async function setGiftRuleActive(id: string, active: boolean) {
  const user = await requirePermission('orders.write');
  await prisma.giftRule.update({ where: { id }, data: { active } });
  await audit({ actorType: 'USER', actorId: user.id, action: active ? 'giftrule.enable' : 'giftrule.disable', entityType: 'GiftRule', entityId: id });
}

export async function deleteGiftRule(id: string) {
  const user = await requirePermission('orders.write');
  await prisma.giftRule.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'giftrule.delete', entityType: 'GiftRule', entityId: id });
}

// ---- Order application (checkout + staff orders) ----------------------------

/** Evaluate active rules against an order being created and attach qualifying
 *  gifts. Runs INSIDE the order transaction; each grant claims gift stock
 *  atomically and is skipped (never thrown) when stock ran out. */
export async function applyGiftRules(
  tx: Tx,
  orderId: string,
  ctx: { subtotalPiastres: bigint; productIds: string[] },
): Promise<GiftGrant[]> {
  const rules = await tx.giftRule.findMany({ where: { active: true } });
  if (rules.length === 0) return [];

  const uniqueIds = [...new Set(ctx.productIds)];
  const cats = uniqueIds.length
    ? await tx.product.findMany({ where: { id: { in: uniqueIds } }, select: { categories: { select: { id: true } } } })
    : [];
  const categoryIds = [...new Set(cats.flatMap((p) => p.categories.map((c) => c.id)))];

  const grants = matchGiftRules(rules.map(toRef), { subtotalPiastres: ctx.subtotalPiastres, productIds: uniqueIds, categoryIds, now: new Date() });

  const applied: GiftGrant[] = [];
  for (const g of grants) {
    // Atomic claim — skip silently if the gift ran out or was archived.
    const claimed = await tx.gift.updateMany({ where: { id: g.giftId, archivedAt: null, stock: { gte: g.qty } }, data: { stock: { decrement: g.qty } } });
    if (claimed.count === 0) continue;
    await tx.orderGift.create({ data: { orderId, giftId: g.giftId, qty: g.qty } });
    await tx.giftMovement.create({ data: { giftId: g.giftId, type: 'GRANT', qtyDelta: -g.qty, refType: 'order', refId: orderId, note: `auto: ${g.ruleNameEn}` } });
    applied.push(g);
  }
  return applied;
}

// ---- Storefront hints (cart page) -------------------------------------------

export type GiftHint =
  | { kind: 'earned'; name: string; qty: number }
  | { kind: 'nudge'; name: string; remainingPiastres: number };

/** What the cart page shows: gifts this cart has earned + the nearest
 *  subtotal-only rule still in reach. Read-only; out-of-stock gifts hidden. */
export async function cartGiftHints(subtotalPiastres: bigint, productIds: string[], locale: string): Promise<GiftHint[]> {
  const rules = await prisma.giftRule.findMany({ where: { active: true }, include: { gift: { select: { stock: true, archivedAt: true } } } });
  if (rules.length === 0) return [];
  const alive = rules.filter((r) => r.gift.stock > 0 && !r.gift.archivedAt);

  const uniqueIds = [...new Set(productIds)];
  const cats = uniqueIds.length
    ? await prisma.product.findMany({ where: { id: { in: uniqueIds } }, select: { categories: { select: { id: true } } } })
    : [];
  const ctx = {
    subtotalPiastres,
    productIds: uniqueIds,
    categoryIds: [...new Set(cats.flatMap((p) => p.categories.map((c) => c.id)))],
    now: new Date(),
  };

  const name = (en: string, ar: string | null) => (locale === 'ar' ? ar || en : en);
  const hints: GiftHint[] = matchGiftRules(alive.map(toRef), ctx).map((g) => ({ kind: 'earned', name: name(g.ruleNameEn, g.ruleNameAr), qty: g.qty }));
  const near = nearestSubtotalRule(alive.map(toRef), ctx);
  if (near) hints.push({ kind: 'nudge', name: name(near.rule.nameEn, near.rule.nameAr), remainingPiastres: Number(near.remainingPiastres) });
  return hints;
}
