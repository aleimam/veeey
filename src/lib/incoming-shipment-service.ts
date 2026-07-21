import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { integrationSecret, yeldninBaseUrl, VEEEY_CLIENT_ID } from '@/lib/integration/config';
import { recordOutbox } from '@/lib/integration/integration-service';
import { signRequest } from '@/lib/integration/hmac-logic';
import { parseShipmentReceived, totalUnits, type WireShipmentReceived } from '@/lib/integration/shipment-wire';

/**
 * Incoming Shipments (YeldnIN stock-in), Stage 1 — the RECEIVER.
 *
 * A `shipment.received` event lands here as a **review record only**. It creates
 * NO lots and moves NO stock: Sales must compare the entered expiry dates against
 * Ops' photos and approve, and that approval (Stage 3) is what makes stock
 * sellable. So arming this channel is safe on its own.
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
// Stage 1 records the DECISION only. Approval does not yet create sellable lots
// — that is Stage 3, deliberately, so this can ship and be exercised before the
// stock-master inversion is anywhere near live.

/** Tell Ops the verdict. A REJECTED shipment reopens in YeldnIN for correction;
 *  an approval is sent too so Ops can see the outcome without asking. */
async function emitReview(yeldninUid: string, decision: 'APPROVED' | 'REJECTED', reason: string | null, at: Date) {
  await recordOutbox('shipment.review', yeldninUid, { shipmentUid: yeldninUid, decision, reason, reviewedAt: at.toISOString() });
}

export async function approveShipment(id: string) {
  const user = await requirePermission('inventory.manage');
  const found = await prisma.incomingShipment.findUnique({ where: { id }, select: { yeldninUid: true } });
  if (!found) return { ok: false as const, error: 'not_found' };
  const at = new Date();
  // Only a pending shipment can be decided — re-approving would let a second
  // click (or a stale tab) re-run whatever Stage 3 later attaches to approval.
  const r = await prisma.incomingShipment.updateMany({
    where: { id, status: 'PENDING_REVIEW' },
    data: { status: 'APPROVED', reviewedById: user.id, reviewedAt: at, rejectReason: null },
  });
  if (r.count === 0) return { ok: false as const, error: 'not_pending' };
  await audit({ actorType: 'USER', actorId: user.id, action: 'incoming_shipment.approve', entityType: 'IncomingShipment', entityId: id });
  await emitReview(found.yeldninUid, 'APPROVED', null, at);
  return { ok: true as const };
}

export async function rejectShipment(id: string, reason: string) {
  const user = await requirePermission('inventory.manage');
  const why = reason.trim();
  // A rejection with no reason is useless to the Ops team that has to fix it.
  if (!why) return { ok: false as const, error: 'reason_required' };
  const found = await prisma.incomingShipment.findUnique({ where: { id }, select: { yeldninUid: true } });
  if (!found) return { ok: false as const, error: 'not_found' };
  const at = new Date();
  const r = await prisma.incomingShipment.updateMany({
    where: { id, status: 'PENDING_REVIEW' },
    data: { status: 'REJECTED', reviewedById: user.id, reviewedAt: at, rejectReason: why.slice(0, 500) },
  });
  if (r.count === 0) return { ok: false as const, error: 'not_pending' };
  await audit({ actorType: 'USER', actorId: user.id, action: 'incoming_shipment.reject', entityType: 'IncomingShipment', entityId: id, data: { reason: why } });
  await emitReview(found.yeldninUid, 'REJECTED', why.slice(0, 500), at);
  return { ok: true as const };
}

export type { WireShipmentReceived };
