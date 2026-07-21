import { prisma } from '@/lib/prisma';
import type { SpecialOrderStatus } from '@/generated/prisma/client';
import { parseWireRequest } from '@/lib/integration/request-sync';
import { parseDeliveryTracking, orderStatusForDelivery, trackingNote } from '@/lib/integration/delivery-wire';
import { storeKey } from '@/lib/integration/delivery-sync';
import { transitionOrder } from '@/lib/order-service';

/**
 * Inbound YeldnIN webhook handlers (INTEGRATION_CONTRACT §5). `shipment.received`
 * is the high-value stock-in handoff (builds FEFO lots); the status/milestone/
 * delivery handlers record progress. ⚠️ Exact status mapping + compensation math
 * trace to a contract snapshot — re-baseline before enabling in staging.
 */
// ⚠️ unitCostEgp is a contract field to confirm at re-baseline (V4 C10) — parsed
// tolerantly (lot-level wins over item-level; absent = cost left null).
type ShipmentLot = { quantity: number; expiryMonth: number; expiryYear: number; batchNumber?: string | null; unitCostEgp?: number | null };
type ShipmentItem = { batchId?: number; requestUid?: string; sku?: string | null; productName?: string; quantity: number; unitCostEgp?: number | null; lots?: ShipmentLot[] };
type ShipmentPayload = { shipmentId: number; receivedAt?: string; items?: ShipmentItem[] };

const costPiastresOf = (lot: ShipmentLot, item: ShipmentItem): bigint | null => {
  const egp = lot.unitCostEgp ?? item.unitCostEgp;
  return egp != null && Number.isFinite(egp) && egp >= 0 ? BigInt(Math.round(egp * 100)) : null;
};

/**
 * Real supplier receiving (V4 C10): shipments land as PENDING (QUARANTINE)
 * intake lots carrying the supplier expiry + unit cost — they flow through the
 * same confirm-and-publish step as the manual intake (publish is the single
 * point where stock becomes sellable + writes the STOCK_IN ledger row). This
 * whole handler is inert until INTEGRATION_ENABLED (webhook is flag-gated).
 */
export async function handleShipmentReceived(payload: ShipmentPayload): Promise<{ lotsCreated: number; unmatched: number }> {
  const location = await prisma.location.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!location) return { lotsCreated: 0, unmatched: 0 };

  let lotsCreated = 0;
  let unmatched = 0;
  for (const item of payload.items ?? []) {
    const product = item.sku ? await prisma.product.findFirst({ where: { sku: item.sku } }) : null;
    if (!product) { unmatched += 1; continue; }
    // Lots may be empty or sum to fewer than quantity → those units are "expiry unknown"; we only shelve specified lots.
    for (const lot of item.lots ?? []) {
      const expiry = new Date(Date.UTC(lot.expiryYear, Math.max(0, Math.min(11, lot.expiryMonth - 1)), 1));
      await prisma.lot.create({
        data: {
          productId: product.id,
          locationId: location.id,
          expiryDate: expiry,
          qtyOnHand: lot.quantity,
          sourceBatchId: item.batchId != null ? String(item.batchId) : null,
          costPiastres: costPiastresOf(lot, item),
          status: 'QUARANTINE', // pending intake — Ops confirms expiry/price/cost, then publishes
        },
      });
      lotsCreated += 1;
    }
  }
  return { lotsCreated, unmatched };
}

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
    case 'shipment.received':
      return { handled: true, detail: await handleShipmentReceived(payload as ShipmentPayload) };
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
