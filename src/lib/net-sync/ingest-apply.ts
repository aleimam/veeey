import type { Tx } from '@/lib/order-service';
import { planFefoTake, type IngestDirection } from '@/lib/net-sync/ingest-logic';

/**
 * Stage 2 `apply` — actually MOVING veeey.net stock for a sale made on
 * egyptvitamins.net. This is the half that makes veeey.net the stock master:
 * both storefronts sell from one physical pool, so a unit leaving via ev.net has
 * to leave a Veeey lot too.
 *
 * Runs inside the SAME transaction that writes the `WpStockIngest` row, so the
 * idempotency token and the movement are all-or-nothing. A movement without its
 * token would be re-applied on the next poll; a token without its movement would
 * suppress the retry forever.
 *
 * 🔴 Never emits to `NetStockOutbox`. Woo already decremented its own stock when
 * the order was placed — writing it back would subtract the unit a second time,
 * on the side that never lost it.
 */

export const INGEST_REF_TYPE = 'WP_INGEST';
export const ingestRefId = (wpOrderId: number, wpId: number) => `${wpOrderId}:${wpId}`;

export type ApplyResult = { moved: number; shortfall: number; lotsTouched: number };

export type ApplyInput = {
  productId: string;
  qty: number;
  direction: IngestDirection;
  wpOrderId: number;
  wpId: number;
};

/**
 * FEFO decrement, mirroring what veeey.net's own checkout does so a unit sold on
 * either site consumes the same physical lot. The `updateMany` predicate is the
 * safety rail: stock can never go negative even if a Veeey order claims the same
 * lot in the gap between our read and our write — the claim simply fails and the
 * units land in the shortfall instead.
 */
async function applySale(tx: Tx, input: ApplyInput): Promise<ApplyResult> {
  const lots = await tx.lot.findMany({
    where: { productId: input.productId, status: 'LIVE', qtyOnHand: { gt: 0 } },
    orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
    select: { id: true, locationId: true, qtyOnHand: true },
  });
  const byId = new Map(lots.map((l) => [l.id, l]));
  const plan = planFefoTake(lots, input.qty);

  let moved = 0;
  let lost = plan.shortfall;
  for (const t of plan.takes) {
    const lot = byId.get(t.lotId)!;
    const claimed = await tx.lot.updateMany({
      where: { id: t.lotId, status: 'LIVE', qtyOnHand: { gte: t.qty } },
      data: { qtyOnHand: { decrement: t.qty } },
    });
    if (claimed.count === 0) { lost += t.qty; continue; } // raced — report, don't force
    moved += t.qty;
    await tx.movementLedger.create({
      data: {
        lotId: t.lotId, locationId: lot.locationId, type: 'SALE', qtyDelta: -t.qty,
        reason: `egyptvitamins.net order ${input.wpOrderId}`,
        refType: INGEST_REF_TYPE, refId: ingestRefId(input.wpOrderId, input.wpId),
      },
    });
  }
  return { moved, shortfall: lost, lotsTouched: plan.takes.length };
}

/**
 * Put units back after a cancel/refund on ev.net.
 *
 * Prefers to REVERSE the exact lots the matching sale took, which is the only way
 * to keep expiry honest — restocking a 2027 unit into a 2026 lot would put a date
 * on the shelf that the goods don't have. Falls back to the soonest-expiry live
 * lot only when there's no sale to reverse (an order placed before the cutover),
 * and reports what it couldn't land rather than inventing a lot.
 */
async function applyRestore(tx: Tx, input: ApplyInput): Promise<ApplyResult> {
  const refId = ingestRefId(input.wpOrderId, input.wpId);
  const prior = await tx.movementLedger.findMany({
    where: { refType: INGEST_REF_TYPE, refId, type: 'SALE' },
    select: { lotId: true, locationId: true, qtyDelta: true },
    orderBy: { createdAt: 'asc' },
  });

  let left = Math.max(0, Math.floor(input.qty));
  let moved = 0;
  let touched = 0;

  const targets: { lotId: string; locationId: string; cap: number }[] = prior.map((p) => ({
    lotId: p.lotId, locationId: p.locationId, cap: Math.abs(p.qtyDelta),
  }));
  if (!targets.length) {
    const lot = await tx.lot.findFirst({
      where: { productId: input.productId, status: 'LIVE' },
      orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
      select: { id: true, locationId: true },
    });
    if (lot) targets.push({ lotId: lot.id, locationId: lot.locationId, cap: left });
  }

  for (const t of targets) {
    if (left <= 0) break;
    const qty = Math.min(left, t.cap);
    if (qty <= 0) continue;
    await tx.lot.update({ where: { id: t.lotId }, data: { qtyOnHand: { increment: qty } } });
    await tx.movementLedger.create({
      data: {
        lotId: t.lotId, locationId: t.locationId, type: 'RETURN', qtyDelta: qty,
        reason: `egyptvitamins.net order ${input.wpOrderId} reversed`,
        refType: INGEST_REF_TYPE, refId,
      },
    });
    moved += qty;
    left -= qty;
    touched++;
  }
  return { moved, shortfall: left, lotsTouched: touched };
}

export function applyIngestMovement(tx: Tx, input: ApplyInput): Promise<ApplyResult> {
  return input.direction === 'SALE' ? applySale(tx, input) : applyRestore(tx, input);
}
