import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { parseConditionMarker, nameKey, type InferredCondition } from '@/lib/condition-migration';

/**
 * Damaged-goods → Condition migration (V4 C9), DB layer. Dry-run first: the
 * plan lists every "{Broken bottle}"-style variant product, the condition it
 * implies, and the base product it maps to (exact name match after stripping
 * the marker). APPLY (owner-confirmed) then, per matched variant:
 *   1. moves its lots to the base product with lot.condition set,
 *   2. archives the variant product (kept for order history — never deleted).
 * Everything is audited with a full before/after snapshot.
 */

export type ConditionPlanRow = {
  variantId: string;
  variantSku: string;
  variantName: string;
  variantStatus: string;
  condition: InferredCondition;
  lots: number;
  units: number;
  baseId: string | null;
  baseSku: string | null;
  baseName: string | null;
};

export type ConditionPlan = { matched: ConditionPlanRow[]; unmatched: ConditionPlanRow[] };

export async function conditionMigrationPlan(): Promise<ConditionPlan> {
  await requirePermission('inventory.manage');
  const candidates = await prisma.product.findMany({
    where: { nameEn: { contains: '{' }, status: { not: 'ARCHIVED' } },
    select: { id: true, sku: true, nameEn: true, status: true, lots: { select: { qtyOnHand: true } } },
  });

  const parsed = candidates
    .map((p) => ({ p, marker: parseConditionMarker(p.nameEn) }))
    .filter((x): x is { p: (typeof candidates)[number]; marker: NonNullable<ReturnType<typeof parseConditionMarker>> } => x.marker !== null);
  if (parsed.length === 0) return { matched: [], unmatched: [] };

  // Base candidates: same-name products WITHOUT a marker (any status but ARCHIVED).
  const bases = await prisma.product.findMany({
    where: { NOT: { nameEn: { contains: '{' } }, status: { not: 'ARCHIVED' } },
    select: { id: true, sku: true, nameEn: true },
  });
  const baseByKey = new Map(bases.map((b) => [nameKey(b.nameEn), b]));

  const matched: ConditionPlanRow[] = [];
  const unmatched: ConditionPlanRow[] = [];
  for (const { p, marker } of parsed) {
    const base = baseByKey.get(nameKey(marker.baseName)) ?? null;
    const row: ConditionPlanRow = {
      variantId: p.id,
      variantSku: p.sku,
      variantName: p.nameEn,
      variantStatus: p.status,
      condition: marker.condition,
      lots: p.lots.length,
      units: p.lots.reduce((s, l) => s + l.qtyOnHand, 0),
      baseId: base?.id ?? null,
      baseSku: base?.sku ?? null,
      baseName: base?.nameEn ?? null,
    };
    (base ? matched : unmatched).push(row);
  }
  return { matched, unmatched };
}

/** Apply the migration for all MATCHED rows of a freshly computed plan.
 *  Returns what was moved. Unmatched rows are untouched (handle manually). */
export async function applyConditionMigration(): Promise<{ products: number; lots: number }> {
  const user = await requirePermission('inventory.manage');
  const plan = await conditionMigrationPlan();

  let movedLots = 0;
  for (const row of plan.matched) {
    await prisma.$transaction(async (tx) => {
      const moved = await tx.lot.updateMany({
        where: { productId: row.variantId },
        data: { productId: row.baseId!, condition: row.condition },
      });
      movedLots += moved.count;
      await tx.product.update({ where: { id: row.variantId }, data: { status: 'ARCHIVED' } });
    });
    await audit({
      actorType: 'USER',
      actorId: user.id,
      action: 'inventory.condition_migration',
      entityType: 'Product',
      entityId: row.variantId,
      data: { from: { sku: row.variantSku, name: row.variantName }, to: { id: row.baseId, sku: row.baseSku }, condition: row.condition, lots: row.lots, units: row.units },
    });
  }
  return { products: plan.matched.length, lots: movedLots };
}
