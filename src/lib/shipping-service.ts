import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';

/** Shipping (FR-SHP-*). Three customer-facing types with admin-configurable fees
 *  (seeded: Fast&Free 0 / UltraFast 400 / Pick-from-Office 100). The "Deliver to
 *  [area]" selector blends area eligibility + ETA. */

export type ShippingTypeKey = 'FAST_FREE' | 'ULTRAFAST' | 'PICK_FROM_OFFICE';

export function listShippingTypes() {
  return prisma.shippingTypeConfig.findMany({ where: { enabled: true }, orderBy: { feePiastres: 'asc' } });
}

// ---- Admin: methods + zones + areas (FR-SHP-*). RBAC settings.manage, audited.
const PERM = 'settings.manage';

export const listAllShippingTypes = () =>
  prisma.shippingTypeConfig.findMany({ orderBy: { feePiastres: 'asc' } });

const typeSchema = z.object({
  labelEn: z.string().trim().min(1),
  labelAr: z.string().trim().min(1),
  feeEgp: z.coerce.number().min(0),
  enabled: z.boolean().default(false),
});
export async function updateShippingType(type: ShippingTypeKey, raw: z.input<typeof typeSchema>) {
  const user = await requirePermission(PERM);
  const d = typeSchema.parse(raw);
  await prisma.shippingTypeConfig.update({
    where: { type },
    data: { labelEn: d.labelEn, labelAr: d.labelAr, feePiastres: BigInt(Math.round(d.feeEgp * 100)), enabled: d.enabled },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'shipping.type.update', entityType: 'ShippingTypeConfig', entityId: type });
}

export const listZonesWithAreas = () =>
  prisma.shippingZone.findMany({ include: { areas: { orderBy: { name: 'asc' } }, _count: { select: { areas: true } } }, orderBy: { name: 'asc' } });
export const getZone = (id: string) =>
  prisma.shippingZone.findUnique({ where: { id }, include: { areas: { orderBy: { name: 'asc' } } } });

const zoneSchema = z.object({
  name: z.string().trim().min(1),
  governorate: z.string().trim().min(1),
  granularity: z.enum(['AREA', 'GOVERNORATE']).default('GOVERNORATE'),
});
export async function saveZone(id: string | null, raw: z.input<typeof zoneSchema>) {
  const user = await requirePermission(PERM);
  const d = zoneSchema.parse(raw);
  const zone = id
    ? await prisma.shippingZone.update({ where: { id }, data: d })
    : await prisma.shippingZone.create({ data: d });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'shipping.zone.update' : 'shipping.zone.create', entityType: 'ShippingZone', entityId: zone.id });
  return zone;
}
export async function deleteZone(id: string) {
  const user = await requirePermission(PERM);
  await prisma.shippingZone.delete({ where: { id } }); // areas cascade
  await audit({ actorType: 'USER', actorId: user.id, action: 'shipping.zone.delete', entityType: 'ShippingZone', entityId: id });
}

const areaSchema = z.object({
  zoneId: z.string().min(1),
  name: z.string().trim().min(1),
  etaText: z.string().trim().optional().nullable(),
  allowsUltraFast: z.boolean().default(false),
});
export async function saveArea(id: string | null, raw: z.input<typeof areaSchema>) {
  const user = await requirePermission(PERM);
  const d = areaSchema.parse(raw);
  const data = { zoneId: d.zoneId, name: d.name, etaText: d.etaText ?? null, allowsUltraFast: d.allowsUltraFast };
  const area = id
    ? await prisma.shippingArea.update({ where: { id }, data })
    : await prisma.shippingArea.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'shipping.area.update' : 'shipping.area.create', entityType: 'ShippingArea', entityId: area.id });
  return area;
}
export async function deleteArea(id: string) {
  const user = await requirePermission(PERM);
  await prisma.shippingArea.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'shipping.area.delete', entityType: 'ShippingArea', entityId: id });
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
