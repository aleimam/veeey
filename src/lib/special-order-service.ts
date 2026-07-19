import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { getNumberSetting } from '@/lib/settings-service';
import { isValidPhone } from '@/lib/phone';
import type { SpecialOrderStatus } from '@/generated/prisma/client';

/**
 * Special orders (FR-SO — the "we'll bring it" differentiator). A request is a
 * standalone lead (no Order yet); staff confirm price/deadline, take a deposit,
 * and progress milestones. Deposit %, lead time, and compensation windows are
 * admin-configurable settings. Customer create is public; admin manage is
 * gated by orders.write + audited.
 */
export const SPECIAL_ORDER_STATUSES: SpecialOrderStatus[] = [
  'REQUESTED', 'DEPOSIT_PAID', 'SOURCING', 'PURCHASED', 'IN_TRANSIT', 'RECEIVED', 'FULFILLED', 'CANCELLED',
];

const requestSchema = z.object({
  requestedProductText: z.string().trim().min(1),
  productUrl: z.string().trim().url().optional().or(z.literal('')),
  requesterName: z.string().trim().optional().or(z.literal('')),
  requesterPhone: z.string().trim().optional().or(z.literal('')),
  requesterEmail: z.string().trim().email().optional().or(z.literal('')),
  size: z.string().trim().max(120).optional().or(z.literal('')),
  concentration: z.string().trim().max(120).optional().or(z.literal('')),
  photoUrls: z.array(z.string().trim()).max(6).optional().default([]),
  notes: z.string().trim().optional().nullable(),
});
export type SpecialOrderRequestInput = z.input<typeof requestSchema>;

/** Public: a customer (or guest) submits a special-order request. Phones are
 *  validated (Egyptian 01… or international) when provided. */
export async function createSpecialOrderRequest(input: SpecialOrderRequestInput, customerId?: string | null) {
  const d = requestSchema.parse(input);
  if (d.requesterPhone && !isValidPhone(d.requesterPhone)) throw new Error('BAD_PHONE');
  // Guests must give a name + valid phone; logged-in requests fill those from the account.
  if (!customerId && (!d.requesterName || !d.requesterPhone)) throw new Error('MISSING_CONTACT');
  // Tier benefits gate (ships granted-to-all — bites only when an admin unticks a tier).
  const { tierSystemBenefits } = await import('@/lib/tier-benefit-service');
  const cust = customerId ? await prisma.customer.findUnique({ where: { id: customerId }, select: { tierId: true } }) : null;
  if (!(await tierSystemBenefits(cust?.tierId ?? null)).has('specialOrder')) throw new Error('SPECIAL_ORDER_NOT_AVAILABLE');
  const leadDays = await getNumberSetting('specialOrder.defaultLeadDays');
  const deadlineAt = new Date(Date.now() + Math.max(1, leadDays) * 86_400_000);
  const so = await prisma.specialOrder.create({
    data: {
      customerId: customerId ?? null,
      requestedProductText: d.requestedProductText,
      productUrl: d.productUrl || null,
      requesterName: d.requesterName || null,
      requesterPhone: d.requesterPhone || null,
      requesterEmail: d.requesterEmail || null,
      size: d.size || null,
      concentration: d.concentration || null,
      photoUrls: (d.photoUrls ?? []).filter((u) => /^\/uploads\//.test(u)).slice(0, 6),
      notes: d.notes ?? null,
      status: 'REQUESTED',
      deadlineAt,
    },
  });
  await audit({ actorType: customerId ? 'CUSTOMER' : 'SYSTEM', actorId: customerId ?? null, action: 'special_order.request', entityType: 'SpecialOrder', entityId: so.id });
  return so;
}

// ---- Admin -----------------------------------------------------------------
const adminCreateSchema = requestSchema.extend({
  customerEmail: z.string().trim().email().optional().or(z.literal('')),
});
export type SpecialOrderAdminCreateInput = z.input<typeof adminCreateSchema>;

/** Admin: staff create a special order on a customer's behalf (gated + audited). */
export async function createSpecialOrderByAdmin(input: SpecialOrderAdminCreateInput) {
  const user = await requirePermission('orders.write');
  const d = adminCreateSchema.parse(input);

  let customerId: string | null = null;
  if (d.customerEmail) {
    const linked = await prisma.user.findUnique({ where: { email: d.customerEmail }, select: { customer: { select: { id: true } } } });
    customerId = linked?.customer?.id ?? null;
  }

  const leadDays = await getNumberSetting('specialOrder.defaultLeadDays');
  const deadlineAt = new Date(Date.now() + Math.max(1, leadDays) * 86_400_000);
  const so = await prisma.specialOrder.create({
    data: {
      customerId,
      requestedProductText: d.requestedProductText,
      productUrl: d.productUrl || null,
      requesterName: d.requesterName,
      requesterPhone: d.requesterPhone,
      requesterEmail: d.requesterEmail || null,
      notes: d.notes ?? null,
      status: SPECIAL_ORDER_STATUSES[0],
      deadlineAt,
    },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'special_order.admin_create', entityType: 'SpecialOrder', entityId: so.id });
  return so;
}

export const listSpecialOrders = () =>
  prisma.specialOrder.findMany({
    orderBy: { createdAt: 'desc' },
    include: { customer: { include: { user: { select: { email: true } } } }, order: { select: { number: true } } },
    take: 300,
  });

export const getSpecialOrder = (id: string) =>
  prisma.specialOrder.findUnique({ where: { id }, include: { customer: { include: { user: { select: { email: true } } } }, order: { select: { number: true } } } });

export async function advanceSpecialOrder(id: string, status: SpecialOrderStatus) {
  const user = await requirePermission('orders.write');
  const so = await prisma.specialOrder.update({ where: { id }, data: { status } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'special_order.status', entityType: 'SpecialOrder', entityId: id, data: { status } });
  return so;
}

const detailsSchema = z.object({
  slaType: z.string().trim().optional().nullable(),
  deadlineAt: z.string().trim().optional().nullable(),
  requestedProductText: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  compensationEgp: z.coerce.number().optional().nullable(),
});
export type SpecialOrderDetailsInput = z.input<typeof detailsSchema>;

export async function setSpecialOrderDetails(id: string, raw: SpecialOrderDetailsInput) {
  const user = await requirePermission('orders.write');
  const d = detailsSchema.parse(raw);
  await prisma.specialOrder.update({
    where: { id },
    data: {
      slaType: d.slaType ?? null,
      deadlineAt: d.deadlineAt ? new Date(d.deadlineAt) : null,
      requestedProductText: d.requestedProductText ?? undefined,
      notes: d.notes ?? null,
      compensationPiastres: d.compensationEgp != null && d.compensationEgp !== 0 ? BigInt(Math.round(d.compensationEgp * 100)) : null,
    },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'special_order.details', entityType: 'SpecialOrder', entityId: id });
}
