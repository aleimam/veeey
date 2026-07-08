import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { egpToPiastres } from '@/lib/format';
import { checkCoupon, couponDiscount } from '@/lib/coupon';

/** Coupon engine service (FR-PRC-07): validates a code against the DB (usage
 *  limits, single-use, per-customer caps) and computes the discount. */

export type CouponApply =
  | { ok: true; couponId: string; discountPiastres: bigint; stackable: boolean }
  | { ok: false; reason: string };

export async function applyCoupon(
  code: string,
  ctx: { subtotalPiastres: bigint; customerId: string | null; isFirstOrder: boolean },
): Promise<CouponApply> {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim() } });
  if (!coupon) return { ok: false, reason: 'not_found' };

  const check = checkCoupon(
    { type: coupon.type, value: coupon.value, minSpendPiastres: coupon.minSpendPiastres, firstOrderOnly: coupon.firstOrderOnly, startsAt: coupon.startsAt, endsAt: coupon.endsAt, active: coupon.active },
    { subtotalPiastres: ctx.subtotalPiastres, isFirstOrder: ctx.isFirstOrder, now: new Date() },
  );
  if (!check.valid) return { ok: false, reason: check.reason ?? 'invalid' };

  if (coupon.singleUse) {
    const used = await prisma.couponRedemption.count({ where: { couponId: coupon.id } });
    if (used >= 1) return { ok: false, reason: 'usage_limit' };
  }
  if (coupon.usageLimit != null) {
    const used = await prisma.couponRedemption.count({ where: { couponId: coupon.id } });
    if (used >= coupon.usageLimit) return { ok: false, reason: 'usage_limit' };
  }
  if (coupon.perCustomerLimit != null && ctx.customerId) {
    const u = await prisma.couponRedemption.count({ where: { couponId: coupon.id, customerId: ctx.customerId } });
    if (u >= coupon.perCustomerLimit) return { ok: false, reason: 'per_customer' };
  }

  return { ok: true, couponId: coupon.id, discountPiastres: couponDiscount({ type: coupon.type, value: coupon.value, firstOrderOnly: coupon.firstOrderOnly, active: coupon.active }, ctx.subtotalPiastres), stackable: coupon.stackable };
}

// ---- Admin CRUD ------------------------------------------------------------
export const listCoupons = () => prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
export const getCoupon = (id: string) => prisma.coupon.findUnique({ where: { id } });

const couponSchema = z.object({
  code: z.string().trim().min(1),
  type: z.enum(['PERCENT', 'FIXED', 'FREE_ITEM']).default('PERCENT'),
  value: z.coerce.number().nonnegative().default(0),
  minSpendEgp: z.coerce.number().nonnegative().optional().nullable(),
  firstOrderOnly: z.boolean().default(false),
  singleUse: z.boolean().default(false),
  usageLimit: z.coerce.number().int().optional().nullable(),
  perCustomerLimit: z.coerce.number().int().optional().nullable(),
  stackable: z.boolean().default(true),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  active: z.boolean().default(true),
});
export type CouponInput = z.input<typeof couponSchema>;

export async function saveCoupon(id: string | null, raw: CouponInput) {
  const user = await requirePermission('coupons.manage');
  const d = couponSchema.parse(raw);
  const data = {
    code: d.code, type: d.type, value: d.value,
    minSpendPiastres: d.minSpendEgp != null ? egpToPiastres(d.minSpendEgp) : null,
    firstOrderOnly: d.firstOrderOnly, singleUse: d.singleUse,
    usageLimit: d.usageLimit ?? null, perCustomerLimit: d.perCustomerLimit ?? null,
    stackable: d.stackable, active: d.active,
    startsAt: d.startsAt ? new Date(d.startsAt) : null,
    endsAt: d.endsAt ? new Date(d.endsAt) : null,
  };
  const coupon = id ? await prisma.coupon.update({ where: { id }, data }) : await prisma.coupon.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'coupon.update' : 'coupon.create', entityType: 'Coupon', entityId: coupon.id });
  return coupon;
}
