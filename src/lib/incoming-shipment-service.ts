import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { integrationSecret, yeldninBaseUrl, VEEEY_CLIENT_ID } from '@/lib/integration/config';
import { recordOutbox } from '@/lib/integration/integration-service';
import { signRequest } from '@/lib/integration/hmac-logic';
import { parseShipmentReceived, parseShipmentReview, totalUnits, type WireShipmentReceived } from '@/lib/integration/shipment-wire';
import { egpRatesFor, type FxResult } from '@/lib/fx';
import { costToPiastres, normalizeCurrency } from '@/lib/fx-logic';
import type { Tx } from '@/lib/order-service';

/**
 * Incoming Shipments (YeldnIN stock-in), Stage 1 — the RECEIVER.
 *
 * A `shipment.received` event lands here as a **review record only**. It creates
 * NO lots and moves NO stock: Sales must compare the entered expiry dates against
 * Ops' photos and approve, and that approval is what makes stock sellable (Stage
 * 3, `approveShipment` below). So arming this channel is safe on its own.
 */

export type ReceiveResult =
  | { ok: true; shipmentId: string; created: boolean; units: number; unmatchedLines: number }
  | { ok: false; error: string };

/** Resolve a wire line to a Veeey product: canonical SKU first, legacy WP id as
 *  the fallback. Never guesses by name — an unmatched line is held for review. */
async function resolveProductId(sku: string | null, veeeyWpId: number | null): Promise<string | null> {
  if (sku) {
    const bySku = await prisma.product.findFirst({ where: { sku }, select: { id: true } });
    if (bySku) return bySku.id;
  }
  if (veeeyWpId != null) {
    const byWp = await prisma.product.findFirst({ where: { legacyWpId: veeeyWpId }, select: { id: true } });
    if (byWp) return byWp.id;
  }
  return null;
}

export async function receiveShipment(payload: unknown): Promise<ReceiveResult> {
  const wire = parseShipmentReceived(payload);
  if (!wire) return { ok: false, error: 'validation_failed' };

  // Idempotent on YeldnIN's uid. A re-fired event REPLACES the lines of a
  // still-pending shipment (Ops may have corrected an expiry and resent), but
  // never touches one Sales already decided on — that would silently rewrite
  // what somebody signed off.
  const existing = await prisma.incomingShipment.findUnique({
    where: { yeldninUid: wire.shipmentUid },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== 'PENDING_REVIEW') {
    return { ok: true, shipmentId: existing.id, created: false, units: 0, unmatchedLines: 0 };
  }

  const lots: { productId: string | null; sku: string | null; productName: string; expiryDate: Date | null; lotCode: string | null; quantity: number; unitCost: number | null; currency: string | null }[] = [];
  let unmatchedLines = 0;
  for (const line of wire.lines) {
    const productId = await resolveProductId(line.sku, line.veeeyWpId);
    if (!productId) unmatchedLines += 1;
    for (const lot of line.lots) {
      lots.push({
        productId,
        sku: line.sku,
        productName: line.productName,
        expiryDate: lot.expiryDate ? new Date(`${lot.expiryDate}T00:00:00.000Z`) : null,
        lotCode: lot.lotCode,
        quantity: lot.quantity,
        unitCost: lot.unitCost,
        currency: lot.currency,
      });
    }
  }

  const receivedAt = new Date(wire.receivedAt);
  const shipment = await prisma.$transaction(async (tx) => {
    const s = existing
      ? await tx.incomingShipment.update({
          where: { id: existing.id },
          data: { yeldninId: wire.shipmentId, receivedAt },
        })
      : await tx.incomingShipment.create({
          data: { yeldninUid: wire.shipmentUid, yeldninId: wire.shipmentId, receivedAt, status: 'PENDING_REVIEW' },
        });
    // Replace children wholesale — a resend is the corrected truth, and merging
    // would leave stale lots from the superseded version behind.
    if (existing) {
      await tx.incomingShipmentLot.deleteMany({ where: { shipmentId: s.id } });
      await tx.incomingShipmentPhoto.deleteMany({ where: { shipmentId: s.id } });
    }
    if (lots.length) await tx.incomingShipmentLot.createMany({ data: lots.map((l) => ({ ...l, shipmentId: s.id })) });
    if (wire.photoAssetIds.length) {
      await tx.incomingShipmentPhoto.createMany({ data: wire.photoAssetIds.map((assetId) => ({ shipmentId: s.id, assetId })) });
    }
    return s;
  });

  return { ok: true, shipmentId: shipment.id, created: !existing, units: totalUnits(wire), unmatchedLines };
}

export function listIncomingShipments(status?: string) {
  return prisma.incomingShipment.findMany({
    where: status ? { status } : undefined,
    orderBy: { receivedAt: 'desc' },
    take: 100,
    include: { _count: { select: { lots: true, photos: true } } },
  });
}

export function getIncomingShipment(id: string) {
  return prisma.incomingShipment.findUnique({
    where: { id },
    include: {
      lots: { orderBy: [{ productName: 'asc' }, { expiryDate: 'asc' }] },
      photos: { orderBy: { id: 'asc' } },
    },
  });
}

/** Units awaiting a Sales decision — the number worth badging in the nav. */
export function pendingShipmentCount() {
  return prisma.incomingShipment.count({ where: { status: 'PENDING_REVIEW' } });
}

/**
 * Fetch a shipment photo's bytes from YeldnIN (contract v2 §4.8). The bytes live
 * there and the endpoint is HMAC-only, so the admin browser can't reach it —
 * this is the server-side half of the proxy route.
 *
 * Only ever called with an assetId that is already attached to a stored
 * shipment, so a caller can't turn this into an arbitrary fetcher.
 */
export async function fetchShipmentPhoto(assetId: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const secret = integrationSecret();
  if (!secret) return null;
  const path = `/attachments/${encodeURIComponent(assetId)}`;
  // The signature covers the canonical path YeldnIN's verifier reads from
  // url.pathname — mismatch here reads as a bad signature, not a 404.
  const canonicalPath = `/api/integration/v1${path}`;
  const ts = String(Date.now());
  const nonce = randomUUID();
  const sig = signRequest(secret, 'GET', canonicalPath, ts, nonce, '');
  try {
    const res = await fetch(`${yeldninBaseUrl()}${path}`, {
      headers: { 'X-Client-Id': VEEEY_CLIENT_ID, 'X-Timestamp': ts, 'X-Nonce': nonce, 'X-Signature': sig },
      redirect: 'manual', // a redirect here would silently return an HTML page as "the photo"
    });
    if (!res.ok) return null;
    return { body: await res.arrayBuffer(), contentType: res.headers.get('content-type') ?? 'application/octet-stream' };
  } catch {
    return null;
  }
}

/** Is this asset actually attached to a shipment we hold? Gate for the proxy. */
export async function shipmentPhotoExists(assetId: string): Promise<boolean> {
  return (await prisma.incomingShipmentPhoto.count({ where: { assetId } })) > 0;
}

// ── Sales review ────────────────────────────────────────────────────────────
// Stage 3: approval is the single point where received goods become sellable.

/** Tell Ops the verdict. A REJECTED shipment reopens in YeldnIN for correction;
 *  an approval is sent too so Ops can see the outcome without asking. */
async function emitReview(yeldninUid: string, decision: 'APPROVED' | 'REJECTED', reason: string | null, at: Date) {
  await recordOutbox('shipment.review', yeldninUid, { shipmentUid: yeldninUid, decision, reason, reviewedAt: at.toISOString() });
}

export const NOTHING_STOCKED: StockResult = { lotsStocked: 0, units: 0, skippedUnmatched: 0, staleFx: 0, noRate: 0, costConflicts: 0 };

export type StockResult = {
  lotsStocked: number;
  units: number;
  /** Lines whose SKU matches no product — real goods we cannot book. */
  skippedUnmatched: number;
  /** Costs converted at a cached rate because the provider was unreachable. */
  staleFx: number;
  /** Priced in a currency we have no rate for at all — stocked without a cost. */
  noRate: number;
  /** Merged into a lot that already carries a different cost; the existing one stands. */
  costConflicts: number;
};

/**
 * Turn approved shipment lines into sellable stock.
 *
 * Units merge into the existing LIVE lot for the same product + expiry +
 * location + condition, exactly as the rest of the system defines a lot; a new
 * lot is created only when none exists. `lotId` on the line is the idempotency
 * guard — a line that already has one is skipped, so a re-fired approval or a
 * second click cannot stock the same goods twice.
 *
 * Runs inside the caller's transaction, alongside the status flip. Exported
 * because Sales may also approve from YeldnIN (owner decision), and that inbound
 * handler must stock through this exact path rather than a parallel one.
 */
export async function stockShipmentLines(
  tx: Tx,
  lines: { id: string; productId: string | null; quantity: number; expiryDate: Date | null; lotCode: string | null; unitCost: number | null; currency: string | null; lotId: string | null }[],
  locationId: string,
  rates: Map<string, FxResult>,
  receivedAt: Date,
  shipmentUid: string,
): Promise<StockResult> {
  const r: StockResult = { lotsStocked: 0, units: 0, skippedUnmatched: 0, staleFx: 0, noRate: 0, costConflicts: 0 };

  for (const line of lines) {
    if (line.lotId) continue; // already stocked — the guard, not an error
    if (!line.productId) { r.skippedUnmatched += 1; continue; }
    if (line.quantity <= 0) continue;

    const cur = normalizeCurrency(line.currency);
    const fx = rates.get(cur) ?? null;
    if (line.unitCost != null && !fx) r.noRate += 1;
    if (fx?.stale) r.staleFx += 1;
    const cost = fx ? costToPiastres(line.unitCost, fx.rate) : null;

    // A lot is product × expiry × location (× condition). Arrivals are always
    // NEW; damaged goods become a variant later, through spillage.
    const existing = await tx.lot.findFirst({
      where: { productId: line.productId, locationId, expiryDate: line.expiryDate, condition: 'NEW', status: 'LIVE' },
      select: { id: true, costPiastres: true },
      orderBy: { createdAt: 'asc' },
    });

    let lotId: string;
    if (existing) {
      lotId = existing.id;
      // Only fill a cost that is missing. Overwriting would silently re-value the
      // units already on that lot, which were bought at a different price — and
      // no costing method (FIFO / weighted average) has been chosen by the owner,
      // so averaging here would be inventing a business rule. The conflict is
      // reported instead.
      const fillCost = existing.costPiastres == null && cost != null;
      if (existing.costPiastres != null && cost != null && existing.costPiastres !== cost) r.costConflicts += 1;
      await tx.lot.update({
        where: { id: lotId },
        data: { qtyOnHand: { increment: line.quantity }, ...(fillCost ? { costPiastres: cost } : {}) },
      });
    } else {
      const created = await tx.lot.create({
        data: {
          productId: line.productId, locationId, expiryDate: line.expiryDate,
          qtyOnHand: line.quantity, costPiastres: cost, status: 'LIVE', condition: 'NEW',
          receivedAt, sourceBatchId: line.lotCode ?? null,
        },
        select: { id: true },
      });
      lotId = created.id;
    }

    await tx.movementLedger.create({
      data: {
        lotId, locationId, type: 'STOCK_IN', qtyDelta: line.quantity,
        reason: `incoming shipment ${shipmentUid}`,
        refType: 'INCOMING_SHIPMENT', refId: line.id,
      },
    });
    await tx.incomingShipmentLot.update({
      where: { id: line.id },
      data: { lotId, costPiastres: cost, fxRate: fx?.rate ?? null, fxRateDate: fx?.date ?? null, fxStale: fx?.stale ?? false },
    });
    r.lotsStocked += 1;
    r.units += line.quantity;
  }
  return r;
}

/**
 * The one decision path, whoever decided.
 *
 * Sales review the same shipment in Veeey OR in YeldnIN (owner decision — the
 * section is mirrored), so a verdict reaches this store either from the admin UI
 * or over the integration. Both must stock through this exact code: a parallel
 * implementation for the remote case would drift, and the drift would only show
 * up as wrong stock.
 *
 * `emit` is false for a verdict that ARRIVED from YeldnIN — echoing it back
 * would ping-pong the same decision between the two apps.
 */
type Decider = { kind: 'USER'; id: string } | { kind: 'SYSTEM' };

async function decideShipment(
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  reason: string | null,
  by: Decider,
  opts: { emit: boolean; at?: Date },
) {
  const s = await prisma.incomingShipment.findUnique({
    where: { id },
    select: {
      yeldninUid: true, status: true, locationId: true, receivedAt: true,
      lots: { select: { id: true, productId: true, quantity: true, expiryDate: true, lotCode: true, unitCost: true, currency: true, lotId: true } },
    },
  });
  if (!s) return { ok: false as const, error: 'not_found' };
  if (s.status !== 'PENDING_REVIEW') return { ok: false as const, error: 'not_pending' };

  const at = opts.at ?? new Date();
  const reviewedById = by.kind === 'USER' ? by.id : null;
  const actorType = by.kind === 'USER' ? ('USER' as const) : ('SYSTEM' as const);

  if (decision === 'REJECTED') {
    const r = await prisma.incomingShipment.updateMany({
      where: { id, status: 'PENDING_REVIEW' },
      data: { status: 'REJECTED', reviewedById, reviewedAt: at, rejectReason: reason?.slice(0, 500) ?? null },
    });
    if (r.count === 0) return { ok: false as const, error: 'not_pending' };
    await audit({ actorType, actorId: reviewedById, action: 'incoming_shipment.reject', entityType: 'IncomingShipment', entityId: id, data: { reason } });
    if (opts.emit) await emitReview(s.yeldninUid, 'REJECTED', reason?.slice(0, 500) ?? null, at);
    // A rejection genuinely stocked nothing — say so with zeros rather than an
    // absent field, so every caller gets the same shape.
    return { ok: true as const, stocked: NOTHING_STOCKED };
  }

  // No hard-coded 'loc_main' — that id only exists in the dev seed.
  const location = s.locationId
    ? await prisma.location.findUnique({ where: { id: s.locationId }, select: { id: true } })
    : await prisma.location.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!location) return { ok: false as const, error: 'no_location' };

  // Rates are network I/O — resolve them BEFORE opening the transaction, or a
  // slow third party would hold locks on the lot table.
  const rates = await egpRatesFor(s.lots.filter((l) => l.unitCost != null).map((l) => l.currency));

  const stocked = await prisma.$transaction(async (tx) => {
    // Single-winner: the claim and the stocking share one transaction, so two
    // approvals racing (one per app) cannot both stock — the second is a no-op.
    const claim = await tx.incomingShipment.updateMany({
      where: { id, status: 'PENDING_REVIEW' },
      data: { status: 'APPROVED', reviewedById, reviewedAt: at, rejectReason: null, locationId: location.id },
    });
    if (claim.count === 0) return null;
    return stockShipmentLines(tx, s.lots, location.id, rates, s.receivedAt, s.yeldninUid);
  });
  if (!stocked) return { ok: false as const, error: 'not_pending' };

  await audit({ actorType, actorId: reviewedById, action: 'incoming_shipment.approve', entityType: 'IncomingShipment', entityId: id, data: stocked });
  if (opts.emit) await emitReview(s.yeldninUid, 'APPROVED', null, at);
  return { ok: true as const, stocked };
}

export async function approveShipment(id: string) {
  const user = await requirePermission('inventory.manage');
  return decideShipment(id, 'APPROVED', null, { kind: 'USER', id: user.id }, { emit: true });
}

export async function rejectShipment(id: string, reason: string) {
  const user = await requirePermission('inventory.manage');
  const why = reason.trim();
  // A rejection with no reason is useless to the Ops team that has to fix it.
  if (!why) return { ok: false as const, error: 'reason_required' };
  return decideShipment(id, 'REJECTED', why, { kind: 'USER', id: user.id }, { emit: true });
}

/**
 * Inbound: Sales decided in YeldnIN instead. Applies the identical outcome here
 * — an approval really does create the stock — and deliberately does not emit,
 * because YeldnIN already knows what it decided.
 */
export async function applyRemoteReview(payload: unknown) {
  const w = parseShipmentReview(payload);
  if (!w) return { ok: false as const, error: 'validation_failed' };
  const found = await prisma.incomingShipment.findUnique({ where: { yeldninUid: w.shipmentUid }, select: { id: true } });
  if (!found) return { ok: false as const, error: 'shipment_not_found' };
  return decideShipment(found.id, w.decision, w.reason, { kind: 'SYSTEM' }, { emit: false, at: new Date(w.reviewedAt) });
}

export type { WireShipmentReceived };
