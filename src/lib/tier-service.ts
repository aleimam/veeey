import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { InUseError } from '@/lib/soft-delete-service';

/**
 * Loyalty tier management (FR-PRC-03 / FR-LOY-*). Tiers carry the points earn
 * rate + theming, plus per-tier product rules (price/visibility/availability
 * matched by category/tag/attribute-value). All gated by `pricing.manage`,
 * audited. Tiers are admin-configurable — never hard-coded (AGENTS.md).
 */
const PERM = 'pricing.manage';

export const listTiers = () =>
  prisma.tier.findMany({
    orderBy: { rank: 'asc' },
    include: { _count: { select: { customers: true, rules: true } } },
  });

export const getTier = (id: string) =>
  prisma.tier.findUnique({ where: { id }, include: { rules: { orderBy: { createdAt: 'asc' } } } });

// ---- Tier ------------------------------------------------------------------
const tierSchema = z.object({
  key: z.string().trim().min(1),
  nameEn: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  rank: z.coerce.number().int().min(1),
  earnRatePerEgp: z.coerce.number().int().min(0),
  minSpendEgp: z.coerce.number().min(0).default(0), // auto-promotion threshold (V5 F29)
  color: z.string().trim().optional().nullable(),
  badge: z.string().trim().optional().nullable(),
});
export type TierInput = z.input<typeof tierSchema>;

export async function saveTier(id: string | null, raw: TierInput) {
  const user = await requirePermission(PERM);
  const d = tierSchema.parse(raw);
  const data = {
    key: d.key, nameEn: d.nameEn, nameAr: d.nameAr, rank: d.rank,
    earnRatePerEgp: d.earnRatePerEgp, minSpendPiastres: BigInt(Math.round(d.minSpendEgp * 100)),
    color: d.color ?? null, badge: d.badge ?? null,
  };
  const tier = id
    ? await prisma.tier.update({ where: { id }, data })
    : await prisma.tier.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'tier.update' : 'tier.create', entityType: 'Tier', entityId: tier.id });
  return tier;
}

export async function deleteTier(id: string) {
  const user = await requirePermission(PERM);
  const assigned = await prisma.customer.count({ where: { tierId: id } });
  if (assigned > 0) throw new InUseError();
  const tier = await prisma.tier.delete({ where: { id } }); // rules cascade (onDelete: Cascade)
  await audit({ actorType: 'USER', actorId: user.id, action: 'tier.delete', entityType: 'Tier', entityId: id });
  return tier;
}

// ---- Tier product rules ----------------------------------------------------
const ruleSchema = z.object({
  matchType: z.enum(['CATEGORY', 'TAG', 'ATTRIBUTE']),
  matchValue: z.string().trim().min(1),
  effect: z.enum(['PRICE', 'VISIBILITY', 'AVAILABILITY']),
  priceModifierType: z.enum(['PERCENT', 'FIXED']).optional().nullable(),
  priceModifierValue: z.coerce.number().int().optional().nullable(),
  visible: z.boolean().optional().nullable(),
  available: z.boolean().optional().nullable(),
});
export type TierRuleInput = z.input<typeof ruleSchema>;

export async function addTierRule(tierId: string, raw: TierRuleInput) {
  const user = await requirePermission(PERM);
  const d = ruleSchema.parse(raw);
  const data = {
    tierId,
    matchType: d.matchType,
    matchValue: d.matchValue,
    effect: d.effect,
    priceModifierType: d.effect === 'PRICE' ? (d.priceModifierType ?? 'PERCENT') : null,
    priceModifierValue: d.effect === 'PRICE' ? (d.priceModifierValue ?? 0) : null,
    visible: d.effect === 'VISIBILITY' ? (d.visible ?? true) : null,
    available: d.effect === 'AVAILABILITY' ? (d.available ?? true) : null,
  };
  const rule = await prisma.tierProductRule.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: 'tier.rule.add', entityType: 'TierProductRule', entityId: rule.id });
  return rule;
}

export async function deleteTierRule(id: string) {
  const user = await requirePermission(PERM);
  const rule = await prisma.tierProductRule.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'tier.rule.delete', entityType: 'TierProductRule', entityId: id });
  return rule;
}
