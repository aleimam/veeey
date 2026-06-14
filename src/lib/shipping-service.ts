import { prisma } from '@/lib/prisma';

/** Shipping (FR-SHP-*). Three customer-facing types with admin-configurable fees
 *  (seeded: Fast&Free 0 / UltraFast 400 / Pick-from-Office 100). The "Deliver to
 *  [area]" selector blends area eligibility + ETA. */

export type ShippingTypeKey = 'FAST_FREE' | 'ULTRAFAST' | 'PICK_FROM_OFFICE';

export function listShippingTypes() {
  return prisma.shippingTypeConfig.findMany({ where: { enabled: true }, orderBy: { feePiastres: 'asc' } });
}

export async function getShippingFee(type: ShippingTypeKey): Promise<bigint> {
  const c = await prisma.shippingTypeConfig.findUnique({ where: { type } });
  return c?.feePiastres ?? 0n;
}

export function listAreas() {
  return prisma.shippingArea.findMany({ include: { zone: true }, orderBy: { name: 'asc' } });
}

export type DeliverOption = {
  type: ShippingTypeKey;
  labelEn: string;
  feePiastres: bigint;
  eta: string;
};

/** Available shipping options for an area (UltraFast only where eligible). */
export async function deliverToOptions(areaId?: string): Promise<DeliverOption[]> {
  const [types, area] = await Promise.all([
    listShippingTypes(),
    areaId ? prisma.shippingArea.findUnique({ where: { id: areaId } }) : Promise.resolve(null),
  ]);
  return types
    .filter((t) => t.type !== 'ULTRAFAST' || (area?.allowsUltraFast ?? false))
    .map((t) => ({
      type: t.type as ShippingTypeKey,
      labelEn: t.labelEn,
      feePiastres: t.feePiastres,
      eta:
        t.type === 'ULTRAFAST'
          ? '3–6 hours'
          : t.type === 'PICK_FROM_OFFICE'
            ? 'Same day at our office'
            : (area?.etaText ?? '1–3 working days'),
    }));
}
