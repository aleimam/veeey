import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';

/**
 * Tier benefits matrix (owner 2026-07-19): one list of member advantages, each
 * toggled on/off per tier at /admin/tier-benefits.
 *
 * Two classes (owner's own split):
 *  - SYSTEM benefits (`key` set) — enforced in code. The list is fixed here;
 *    admins toggle tiers + rename, but can't add/delete system entries.
 *  - MANUAL benefits (`key` null) — advertised entitlements staff honor
 *    (Authenticity Guarantee, consultations…). Full admin CRUD.
 *
 * v1 ships with TODAY'S behavior unchanged: access gates (specialOrder,
 * preOrder, discreetShipping) are seeded GRANTED TO ALL tiers, fee waivers
 * (freeShipping, freeUltraFast) granted to none. Seeding happens once per
 * benefit (idempotent) — after that the admin matrix is the source of truth.
 */
const PERM = 'pricing.manage'; // same gate as /admin/tiers

export { SYSTEM_BENEFITS } from './tier-benefit-keys';
export type { SystemBenefitKey } from './tier-benefit-keys';
import { SYSTEM_BENEFITS, type SystemBenefitKey } from './tier-benefit-keys';

/** Advertised (manual) starters from the owner's list — no grants until toggled. */
const MANUAL_SEEDS = [
  { nameEn: 'Cold Shipping', nameAr: 'شحن مبرّد' },
  { nameEn: 'Authenticity Guarantee', nameAr: 'ضمان الأصالة' },
  { nameEn: 'Free Medical Consultation', nameAr: 'استشارة طبية مجانية' },
];

/** Idempotent seed: creates missing benefit rows (grants only at creation, so
 *  admin unticks are never re-granted). Safe to call on every page load. */
export async function ensureBenefits(): Promise<void> {
  const existing = new Set((await prisma.tierBenefit.findMany({ select: { key: true, nameEn: true } })).map((b) => b.key ?? `manual:${b.nameEn}`));
  const allTiers = await prisma.tier.findMany({ select: { id: true } });
  let sort = 0;
  for (const s of SYSTEM_BENEFITS) {
    sort += 10;
    if (existing.has(s.key)) continue;
    await prisma.tierBenefit.create({
      data: {
        key: s.key, nameEn: s.nameEn, nameAr: s.nameAr, sortOrder: sort,
        // Gates start granted-to-all so v1 changes nothing; fee waivers start off.
        ...(s.grantAll ? { tiers: { connect: allTiers.map((t) => ({ id: t.id })) } } : {}),
      },
    });
  }
  for (const m of MANUAL_SEEDS) {
    sort += 10;
    if (existing.has(`manual:${m.nameEn}`)) continue;
    await prisma.tierBenefit.create({ data: { nameEn: m.nameEn, nameAr: m.nameAr, sortOrder: sort } });
  }
}

/** The admin matrix: benefits × tiers with per-tier granted flags. */
export async function listBenefitsMatrix() {
  const [benefits, tiers] = await Promise.all([
    prisma.tierBenefit.findMany({ where: { archivedAt: null }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], include: { tiers: { select: { id: true } } } }),
    prisma.tier.findMany({ orderBy: { rank: 'asc' }, select: { id: true, key: true, nameEn: true, nameAr: true } }),
  ]);
  return { tiers, benefits: benefits.map((b) => ({ id: b.id, key: b.key, nameEn: b.nameEn, nameAr: b.nameAr, tierIds: new Set(b.tiers.map((t) => t.id)) })) };
}

export async function toggleTierBenefit(benefitId: string, tierId: string, granted: boolean) {
  const user = await requirePermission(PERM);
  await prisma.tierBenefit.update({
    where: { id: benefitId },
    data: { tiers: granted ? { connect: { id: tierId } } : { disconnect: { id: tierId } } },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'tierBenefit.toggle', entityType: 'TierBenefit', entityId: benefitId, data: { tierId, granted } });
}

const manualSchema = z.object({ nameEn: z.string().trim().min(1).max(120), nameAr: z.string().trim().max(120).optional().or(z.literal('')) });

export async function createManualBenefit(raw: z.input<typeof manualSchema>) {
  const user = await requirePermission(PERM);
  const d = manualSchema.parse(raw);
  const max = await prisma.tierBenefit.aggregate({ _max: { sortOrder: true } });
  const b = await prisma.tierBenefit.create({ data: { nameEn: d.nameEn, nameAr: d.nameAr || null, sortOrder: (max._max.sortOrder ?? 0) + 10 } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'tierBenefit.create', entityType: 'TierBenefit', entityId: b.id });
  return b;
}

export async function renameBenefit(id: string, raw: z.input<typeof manualSchema>) {
  const user = await requirePermission(PERM);
  const d = manualSchema.parse(raw);
  await prisma.tierBenefit.update({ where: { id }, data: { nameEn: d.nameEn, nameAr: d.nameAr || null } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'tierBenefit.rename', entityType: 'TierBenefit', entityId: id });
}

/** Manual benefits only — system entries are code-enforced and can't be removed. */
export async function deleteManualBenefit(id: string) {
  const user = await requirePermission(PERM);
  const b = await prisma.tierBenefit.findUniqueOrThrow({ where: { id }, select: { key: true } });
  if (b.key) throw new Error('SYSTEM_BENEFIT');
  await prisma.tierBenefit.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'tierBenefit.delete', entityType: 'TierBenefit', entityId: id });
}

/**
 * ENFORCEMENT reader: the system-benefit keys granted to a tier. `tierId` null
 * (guests / tierless customers) resolves to the base GREEN tier — a guest gets
 * exactly what the entry tier gets.
 */
export async function tierSystemBenefits(tierId: string | null): Promise<Set<SystemBenefitKey>> {
  const effective = tierId ?? (await prisma.tier.findUnique({ where: { key: 'GREEN' }, select: { id: true } }))?.id ?? null;
  if (!effective) return new Set();
  const rows = await prisma.tierBenefit.findMany({
    where: { key: { not: null }, archivedAt: null, tiers: { some: { id: effective } } },
    select: { key: true },
  });
  return new Set(rows.map((r) => r.key as SystemBenefitKey));
}
