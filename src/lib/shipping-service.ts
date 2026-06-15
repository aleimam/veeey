import { getTranslations } from 'next-intl/server';
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
  label: string;
  feePiastres: bigint;
  eta: string;
};

/** Available shipping options for an area (UltraFast only where eligible). */
export async function deliverToOptions(areaId?: string, locale = 'en'): Promise<DeliverOption[]> {
  const [types, area, t] = await Promise.all([
    listShippingTypes(),
    areaId ? prisma.shippingArea.findUnique({ where: { id: areaId } }) : Promise.resolve(null),
    getTranslations({ locale, namespace: 'storefront.shipping' }),
  ]);
  return types
    .filter((s) => s.type !== 'ULTRAFAST' || (area?.allowsUltraFast ?? false))
    .map((s) => ({
      type: s.type as ShippingTypeKey,
      label: (locale === 'ar' ? s.labelAr : s.labelEn) ?? s.labelEn,
      feePiastres: s.feePiastres,
      eta:
        s.type === 'ULTRAFAST'
          ? t('etaUltra')
          : s.type === 'PICK_FROM_OFFICE'
            ? t('etaPickup')
            : (area?.etaText ?? t('etaStandard')),
    }));
}
