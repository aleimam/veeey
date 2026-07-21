import { prisma } from '@/lib/prisma';
import type { SpecialOrderStatus } from '@/generated/prisma/client';
import { parseWireRequest } from '@/lib/integration/request-sync';
import { parseDeliveryTracking, orderStatusForDelivery, trackingNote } from '@/lib/integration/delivery-wire';
import { storeKey } from '@/lib/integration/delivery-sync';
import { transitionOrder } from '@/lib/order-service';
import { receiveShipment } from '@/lib/incoming-shipment-service';

/**
 * Inbound YeldnIN webhook handlers (INTEGRATION_CONTRACT §5). The status/
 * milestone/delivery handlers record progress; `shipment.received` lands a
 * stock-in for Sales to review (see `incoming-shipment-service`).
 *
 * ⚠️ The contract file is a SNAPSHOT and has drifted from what YeldnIN really
 * emits — re-baseline against the emitter before trusting it. `shipment.received`
 * was re-baselined 2026-07-21; the previous handler here built QUARANTINE lots
 * from `expiryMonth`/`expiryYear` items that YeldnIN never implemented, and was
 * deleted rather than left as a second, stale answer to "a shipment arrived".
 * (The dev Simulate button on /admin/inventory/intake is a separate mock path
 * and is unaffected.)
 */

const SALES_STATUS_MAP: Record<string, SpecialOrderStatus> = {
  ORDERED: 'SOURCING', PURCHASED: 'PURCHASED', SHIPPED: 'IN_TRANSIT', SHIPPED_SUPPLIER: 'IN_TRANSIT',
  IN_EGYPT: 'RECEIVED', RECEIVED: 'RECEIVED', DELIVERED: 'FULFILLED', CANCELLED: 'CANCELLED',
};

async function recordMilestone(requestUid: string, key: string, at?: string): Promise<{ matched: boolean }> {
  const so = await prisma.specialOrder.findFirst({ where: { yeldnRequestUid: requestUid } });
  if (!so) return { matched: false };
  const milestones: Record<string, string> = { ...((so.milestonesJson as Record<string, string> | null) ?? {}) };
  milestones[key] = at ?? new Date().toISOString();
  const mappedStatus = SALES_STATUS_MAP[key];
  await prisma.specialOrder.update({ where: { id: so.id }, data: { milestonesJson: milestones, ...(mappedStatus ? { status: mappedStatus } : {}) } });
  return { matched: true };
}

export function handleRequestStatusChanged(p: { requestUid: string; salesStatusCode: string; changedAt?: string }) {
  return recordMilestone(p.requestUid, p.salesStatusCode, p.changedAt);
}

export function handleSpecialOrderMilestone(p: { requestUid: string; milestone: string; occurredAt?: string }) {
  return recordMilestone(p.requestUid, p.milestone, p.occurredAt);
}

/**
 * `delivery.tracking` (YeldnIN → Veeey, contract v2 §2.3) — the Veeey Express
 * loop closing. Every courier milestone lands here; most are timeline-only (the
 * order stays Shipped), while DELIVERED completes the order and a FAILED or
 * CANCELLED delivery returns it to **Confirmed** so Ops can ship it again
 * (owner rule — it must NOT auto-cancel, and must not restock: the goods are
 * still out with the courier until a Return says otherwise).
 *
 * The transition runs as `system` — there is no signed-in user on a webhook, so
 * it skips the per-status RBAC gate (which constrains people) while keeping the
 * transition graph, the CAS claim and every effect.
 */
export async function handleDeliveryTracking(payload: unknown): Promise<{ matched: boolean; status?: string; advanced?: string | null; skipped?: string }> {
  const w = parseDeliveryTracking(payload);
  if (!w) return { matched: false, skipped: 'validation_failed' };

  // Order numbers are unique only WITHIN a store, so a mismatched storeKey means
  // this event is about the OTHER store's order — never touch it.
  const mine = storeKey();
  if (w.storeKey && mine && w.storeKey !== mine) return { matched: false, skipped: 'store_mismatch' };

  const order = await prisma.order.findFirst({ where: { number: w.orderNumber }, select: { id: true, status: true } });
  if (!order) return { matched: false, skipped: 'order_not_found' };

  // Durable, customer-visible trail of every milestone — including the ones that
  // don't change the order status (assigned / out for delivery / rescheduled).
  await prisma.orderStatusHistory
    .create({ data: { orderId: order.id, fromStatus: order.status, toStatus: order.status, actorId: null, note: trackingNote(w) } })
    .catch((e) => console.error('delivery tracking history write failed', e));

  const target = orderStatusForDelivery(w.status);
  if (!target || target === order.status) return { matched: true, status: w.status, advanced: null };

  try {
    await transitionOrder(order.id, target, trackingNote(w), { system: true });
    return { matched: true, status: w.status, advanced: target };
  } catch (e) {
    // An out-of-graph move (e.g. DELIVERED arriving for an already-Returned
    // order) must not 500 the webhook — the milestone is already on the timeline.
    console.error('delivery tracking transition failed', e);
    return { matched: true, status: w.status, advanced: null, skipped: 'transition_rejected' };
  }
}

/**
 * Requests epic Phase D: a request created/updated on the YeldnIN side lands
 * here. Upsert the Veeey `Request` by its shared `uid`, matching lines to
 * products by SKU (unknown SKUs are dropped — push the product first). This
 * writes DIRECTLY (never via emitRequestSync), which is what stops the sync
 * from echoing back to YeldnIN. Lenient: an inbound SPECIAL_ORDER without a
 * matching Veeey customer is still stored (customerId null).
 */
export async function handleRequestUpsert(payload: unknown): Promise<{ matched: boolean; created?: boolean; unmatchedLines?: number; skipped?: string }> {
  const wire = parseWireRequest(payload);
  if (!wire) return { matched: false, skipped: 'invalid' };

  const skus = wire.lines.map((l) => l.sku).filter((s): s is string => !!s);
  const products = skus.length ? await prisma.product.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true } }) : [];
  const bySku = new Map(products.map((p) => [p.sku, p.id] as const));
  const lineCreates = wire.lines
    .map((l) => {
      const pid = l.sku ? bySku.get(l.sku) : undefined;
      if (!pid) return null;
      return { productId: pid, count: l.quantity, sellingPricePiastres: l.sellingPriceEgp != null ? BigInt(Math.round(l.sellingPriceEgp * 100)) : null, notes: l.notes };
    })
    .filter((l): l is NonNullable<typeof l> => l != null);
  const unmatchedLines = wire.lines.length - lineCreates.length;
  if (!lineCreates.length) return { matched: false, unmatchedLines, skipped: 'no_known_products' };

  const customerId = wire.customer?.veeeyCustomerId
    ? (await prisma.customer.findUnique({ where: { id: wire.customer.veeeyCustomerId }, select: { id: true } }))?.id ?? null
    : null;
  const depositPiastres = wire.depositEgp != null ? BigInt(Math.round(wire.depositEgp * 100)) : null;
  const photoCreates = wire.photoUrls.filter((u) => /^(https?:\/\/|\/uploads\/)/.test(u)).slice(0, 6).map((url) => ({ url }));
  const base = {
    type: wire.type, status: wire.status, scope: wire.scope, notes: wire.notes, depositPiastres,
    autoOptional: wire.autoOptional, archivedAt: wire.archived ? new Date() : null,
    customerId, requestedByName: 'YeldnIN sync',
  };

  const existing = await prisma.request.findUnique({ where: { uid: wire.uid }, select: { id: true } });
  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.requestLine.deleteMany({ where: { requestId: existing.id } });
      await tx.requestPhoto.deleteMany({ where: { requestId: existing.id } });
      await tx.request.update({ where: { id: existing.id }, data: { ...base, lines: { create: lineCreates }, photos: { create: photoCreates } } });
    });
    return { matched: true, created: false, unmatchedLines };
  }
  await prisma.request.create({ data: { uid: wire.uid, ...base, lines: { create: lineCreates }, photos: { create: photoCreates } } });
  return { matched: true, created: true, unmatchedLines };
}

export async function dispatchInboundEvent(type: string, payload: unknown): Promise<{ handled: boolean; detail?: unknown }> {
  switch (type) {
    // Re-baselined 2026-07-21: YeldnIN now really emits this, and its shape is
    // NOT the old contract snapshot (which described expiryMonth/expiryYear lots
    // that were never implemented). It lands as a review record — Sales approve
    // before anything becomes sellable stock.
    case 'shipment.received':
      return { handled: true, detail: await receiveShipment(payload) };
    case 'request.upsert':
    case 'request.created':
    case 'request.updated':
      return { handled: true, detail: await handleRequestUpsert(payload) };
    case 'request.status_changed':
      return { handled: true, detail: await handleRequestStatusChanged(payload as { requestUid: string; salesStatusCode: string; changedAt?: string }) };
    case 'special_order.milestone':
      return { handled: true, detail: await handleSpecialOrderMilestone(payload as { requestUid: string; milestone: string; occurredAt?: string }) };
    // `delivery.tracking` is what YeldnIN actually emits; the older
    // `delivery.status_changed` name is kept as an alias so a queued event from
    // either side of a deploy still lands.
    case 'delivery.tracking':
    case 'delivery.status_changed':
      return { handled: true, detail: await handleDeliveryTracking(payload) };
    default:
      return { handled: false };
  }
}
