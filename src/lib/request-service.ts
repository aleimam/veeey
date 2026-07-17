import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { egpToPiastres } from '@/lib/format';
import { getNumberSetting } from '@/lib/settings-service';
import {
  REQUEST_TYPES, isRequestType, validateRequest, requestEditable, requestUid, expectedDepositPiastres, pickOrderRequestLines,
} from '@/lib/request-logic';
import type { Prisma } from '@/generated/prisma/client';

/**
 * The unified purchasing-request queue (Requests epic) — the service layer over
 * the `Request` model that mirrors YeldnIN. One request groups product lines a
 * staffer wants purchased; four types set priority. EGV requests pass an
 * approval gate (PENDING→APPROVED/REJECTED). Every write is RBAC-gated
 * (requests.manage) + audited. Money stored in piastres.
 *
 * YeldnIN dispatch is deferred: `outboxEventId` stays null while the integration
 * is disabled — requests are captured locally.
 */

const lineSchema = z.object({
  productId: z.string().trim().min(1),
  count: z.coerce.number().int().min(1),
  sellingPriceEgp: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const createSchema = z.object({
  type: z.enum(REQUEST_TYPES),
  customerId: z.string().trim().optional().nullable(),
  orderId: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  depositEgp: z.coerce.number().min(0).optional().nullable(),
  photoUrls: z.array(z.string().trim()).max(6).optional().default([]),
  lines: z.array(lineSchema).min(1),
  autoOptional: z.boolean().optional().default(false),
});
export type RequestCreateInput = z.input<typeof createSchema>;

const toPiastres = (egp?: number | null) => (egp != null ? BigInt(egpToPiastres(egp)) : null);

/** Next REQ<YY><MM><seq3> for the current month (uid shared with YeldnIN). */
async function nextUid(now: Date): Promise<string> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const count = await prisma.request.count({ where: { createdAt: { gte: monthStart } } });
  return requestUid(now, count + 1);
}

export type RequestListOpts = { type?: string; status?: string; q?: string; page?: number; perPage?: number };

function requestWhere(o: RequestListOpts): Prisma.RequestWhereInput {
  return {
    archivedAt: null,
    ...(o.type && isRequestType(o.type) ? { type: o.type } : {}),
    ...(o.status ? { status: o.status } : {}),
    ...(o.q
      ? { OR: [
          { uid: { contains: o.q, mode: 'insensitive' } },
          { customer: { OR: [{ firstName: { contains: o.q, mode: 'insensitive' } }, { lastName: { contains: o.q, mode: 'insensitive' } }] } },
          { lines: { some: { product: { nameEn: { contains: o.q, mode: 'insensitive' } } } } },
        ] }
      : {}),
  };
}

export function listRequests(o: RequestListOpts = {}) {
  const perPage = o.perPage ?? 50;
  const page = Math.max(1, o.page ?? 1);
  return prisma.request.findMany({
    where: requestWhere(o),
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
      lines: { include: { product: { select: { id: true, nameEn: true, sku: true } } } },
      _count: { select: { lines: true, photos: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * perPage,
    take: perPage,
  });
}
export const countRequests = (o: RequestListOpts = {}) => prisma.request.count({ where: requestWhere(o) });

export function getRequest(id: string) {
  return prisma.request.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
      order: { select: { id: true, number: true } },
      lines: { include: { product: { select: { id: true, nameEn: true, sku: true } } } },
      photos: true,
    },
  });
}

/** Count per type + status for the list tabs/badges (open = not archived). */
export async function requestTabCounts(): Promise<Record<string, number>> {
  const rows = await prisma.request.groupBy({ by: ['type'], where: { archivedAt: null }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.type, r._count._all]));
}

/**
 * Create a request. Staff-driven (human-in-the-loop): the caller has already
 * confirmed type + quantities. `orderId` links a pre-order / special-order.
 */
export async function createRequest(input: RequestCreateInput) {
  const user = await requirePermission('requests.manage');
  const d = createSchema.parse(input);
  const errs = validateRequest({ type: d.type, customerId: d.customerId, lines: d.lines });
  if (Object.keys(errs).length) throw Object.assign(new Error('INVALID_REQUEST'), { fields: errs });

  const now = new Date();
  const uid = await nextUid(now);
  // Deposit: use the given value, else suggest from the special-order percent.
  let depositPiastres = toPiastres(d.depositEgp);
  if (d.type === 'SPECIAL_ORDER' && depositPiastres == null) {
    const pct = await getNumberSetting('specialOrder.depositPercent');
    depositPiastres = BigInt(expectedDepositPiastres(pct, d.lines.map((l) => ({ count: l.count, sellingPricePiastres: l.sellingPriceEgp != null ? Number(egpToPiastres(l.sellingPriceEgp)) : null }))));
  }

  const req = await prisma.request.create({
    data: {
      uid,
      type: d.type,
      scope: 'EGV',
      status: 'PENDING',
      customerId: d.customerId || null,
      orderId: d.orderId || null,
      notes: d.notes ?? null,
      depositPiastres,
      autoOptional: d.autoOptional ?? false,
      requestedById: user.id,
      requestedByName: user.name ?? user.email ?? null,
      lines: {
        create: d.lines.map((l) => ({
          productId: l.productId,
          count: l.count,
          sellingPricePiastres: toPiastres(l.sellingPriceEgp),
          notes: l.notes ?? null,
        })),
      },
      photos: { create: (d.photoUrls ?? []).filter((u) => /^\/uploads\//.test(u)).slice(0, 6).map((url) => ({ url })) },
    },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'request.create', entityType: 'Request', entityId: req.id, data: { type: d.type, uid } });
  return req;
}

/**
 * Place a purchasing request FROM an order (Phase B) — the "sales places a
 * request while creating / confirming the pre-order or special order" step.
 * Type SPECIAL_ORDER, linked to the order + its customer, pre-filled from the
 * pre-order lines (or all non-lost lines if none are flagged). The order itself
 * supplies the customer context (guest orders carry contact on the order), so
 * the customer-required validation is not applied here. Created PENDING +
 * editable so sales can adjust the quantities before approving.
 */
export async function createRequestFromOrder(orderId: string) {
  const user = await requirePermission('requests.manage');
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, number: true, customerId: true,
      items: { where: { lost: false }, select: { productId: true, qty: true, preorder: true, unitPricePiastres: true } },
    },
  });
  if (!order) throw new Error('NOT_FOUND');
  const src = pickOrderRequestLines(order.items);
  if (!src.length) throw new Error('NO_ITEMS');

  const now = new Date();
  const uid = await nextUid(now);
  const req = await prisma.request.create({
    data: {
      uid,
      type: 'SPECIAL_ORDER',
      scope: 'EGV',
      status: 'PENDING',
      customerId: order.customerId,
      orderId: order.id,
      notes: `From order ${order.number}`,
      requestedById: user.id,
      requestedByName: user.name ?? user.email ?? null,
      lines: { create: src.map((i) => ({ productId: i.productId, count: i.qty, sellingPricePiastres: i.unitPricePiastres })) },
    },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'request.create', entityType: 'Request', entityId: req.id, data: { type: 'SPECIAL_ORDER', uid, orderId } });
  return req;
}

/** Approve — the lines enter the purchasing pool (and, later, dispatch to YeldnIN). */
export async function approveRequest(id: string) {
  const user = await requirePermission('requests.manage');
  const req = await prisma.request.update({
    where: { id },
    data: { status: 'APPROVED', approvedById: user.id, approvedByName: user.name ?? user.email ?? null, approvedAt: new Date() },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'request.approve', entityType: 'Request', entityId: id });
  return req;
}

export async function rejectRequest(id: string, note?: string) {
  const user = await requirePermission('requests.manage');
  const req = await prisma.request.update({ where: { id }, data: { status: 'REJECTED', rejectedNote: note?.trim() || null } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'request.reject', entityType: 'Request', entityId: id });
  return req;
}

export async function archiveRequest(id: string) {
  const user = await requirePermission('requests.manage');
  const req = await prisma.request.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'request.archive', entityType: 'Request', entityId: id });
  return req;
}

/** Edit lines/notes — only while PENDING (once approved the lines are in the pool). */
export async function updateRequest(id: string, input: RequestCreateInput) {
  const user = await requirePermission('requests.manage');
  const existing = await prisma.request.findUnique({ where: { id }, select: { status: true } });
  if (!existing) throw new Error('NOT_FOUND');
  if (!requestEditable(existing.status)) throw new Error('NOT_EDITABLE');
  const d = createSchema.parse(input);
  const errs = validateRequest({ type: d.type, customerId: d.customerId, lines: d.lines });
  if (Object.keys(errs).length) throw Object.assign(new Error('INVALID_REQUEST'), { fields: errs });

  const req = await prisma.$transaction(async (tx) => {
    await tx.requestLine.deleteMany({ where: { requestId: id } });
    await tx.requestPhoto.deleteMany({ where: { requestId: id } });
    return tx.request.update({
      where: { id },
      data: {
        type: d.type,
        customerId: d.customerId || null,
        notes: d.notes ?? null,
        depositPiastres: toPiastres(d.depositEgp),
        lines: { create: d.lines.map((l) => ({ productId: l.productId, count: l.count, sellingPricePiastres: toPiastres(l.sellingPriceEgp), notes: l.notes ?? null })) },
        photos: { create: (d.photoUrls ?? []).filter((u) => /^\/uploads\//.test(u)).slice(0, 6).map((url) => ({ url })) },
      },
    });
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'request.update', entityType: 'Request', entityId: id });
  return req;
}

/**
 * Quick single-product request from the inventory suggestion tabs (A5). Staff
 * confirm the type + qty; this is the fast path that doesn't need the full form.
 */
export async function createQuickRequest(productId: string, count: number, type: string) {
  if (!isRequestType(type)) throw new Error('BAD_TYPE');
  return createRequest({ type, lines: [{ productId, count }] });
}
