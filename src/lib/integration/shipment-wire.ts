/**
 * Inbound Incoming-Shipments channel (YeldnIN → Veeey): `shipment.received`.
 *
 * PURE (no DB/IO). Mirrors YeldnIN's `buildShipmentWire` — keep the two in step;
 * this is the RE-BASELINED shape, not the old contract snapshot (which described
 * `expiryMonth`/`expiryYear` lots that YeldnIN never actually implemented).
 *
 * The event only REPORTS an arrival. Nothing here becomes sellable stock until
 * Sales compare the expiry dates against the photos and approve.
 */

export interface WireIncomingLot {
  /** YYYY-MM-DD; null = non-perishable (a device) or not entered. */
  expiryDate: string | null;
  lotCode: string | null;
  quantity: number;
  /** RAW supplier cost per unit — not converted. Veeey pins the FX rate at approval. */
  unitCost: number | null;
  /** null = EGP (YeldnIN's convention). */
  currency: string | null;
}

export interface WireIncomingLine {
  sku: string | null;
  veeeyWpId: number | null;
  productName: string;
  lots: WireIncomingLot[];
}

export interface WireShipmentReceived {
  shipmentUid: string;
  shipmentId: number;
  receivedAt: string;
  lines: WireIncomingLine[];
  photoAssetIds: string[];
}

const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : null);

function parseLot(raw: unknown): WireIncomingLot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const quantity = int(o.quantity);
  // A lot with no positive quantity says nothing arrived — drop it rather than
  // storing a zero row that later reads as "we received none of this".
  if (!quantity || quantity <= 0) return null;
  const cost = typeof o.unitCost === 'number' && Number.isFinite(o.unitCost) ? o.unitCost : null;
  return {
    expiryDate: s(o.expiryDate),
    lotCode: s(o.lotCode),
    quantity,
    unitCost: cost,
    currency: s(o.currency)?.toUpperCase() ?? null,
  };
}

/**
 * Validate an inbound `shipment.received`. Requires a shipment uid (the
 * idempotency key) and at least one line with at least one real lot — an empty
 * shipment is a bug upstream, not a fact worth storing.
 */
export function parseShipmentReceived(input: unknown): WireShipmentReceived | null {
  if (!input || typeof input !== 'object') return null;
  const p = input as Record<string, unknown>;
  const shipmentUid = s(p.shipmentUid);
  if (!shipmentUid) return null;

  const lines: WireIncomingLine[] = (Array.isArray(p.lines) ? p.lines : [])
    .map((raw): WireIncomingLine | null => {
      if (!raw || typeof raw !== 'object') return null;
      const o = raw as Record<string, unknown>;
      const productName = s(o.productName);
      const lots = (Array.isArray(o.lots) ? o.lots : []).map(parseLot).filter((l): l is WireIncomingLot => l != null);
      if (!productName || !lots.length) return null;
      return { sku: s(o.sku), veeeyWpId: int(o.veeeyWpId), productName, lots };
    })
    .filter((l): l is WireIncomingLine => l != null);

  if (!lines.length) return null;

  const at = s(p.receivedAt);
  return {
    shipmentUid,
    shipmentId: int(p.shipmentId) ?? 0,
    receivedAt: at && !Number.isNaN(Date.parse(at)) ? at : new Date().toISOString(),
    lines,
    photoAssetIds: (Array.isArray(p.photoAssetIds) ? p.photoAssetIds : [])
      .map((v) => s(v))
      .filter((v): v is string => v != null),
  };
}

/** Total units in the shipment — what Sales sign off on. */
export function totalUnits(w: WireShipmentReceived): number {
  return w.lines.reduce((n, l) => n + l.lots.reduce((m, lot) => m + lot.quantity, 0), 0);
}

// ── Review verdict ──────────────────────────────────────────────────────────
// The SAME event travels both ways: Veeey emits it when Sales decide here, and
// YeldnIN emits it when Sales decide there (owner decision — the section is
// mirrored in both apps). Each side applies it to its own state and does NOT
// re-emit, or the two would ping-pong the same verdict forever.

export const REVIEW_DECISIONS = ['APPROVED', 'REJECTED'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface WireShipmentReview {
  shipmentUid: string;
  decision: ReviewDecision;
  reason: string | null;
  reviewedAt: string;
}

/**
 * Mirror of YeldnIN's `parseShipmentReview` — keep the two byte-compatible.
 *
 * An unrecognised decision is REJECTED as a payload, never coerced to a default:
 * guessing "APPROVED" would put unreviewed goods on sale, and guessing
 * "REJECTED" would bounce a shipment nobody rejected.
 */
export function parseShipmentReview(input: unknown): WireShipmentReview | null {
  if (!input || typeof input !== 'object') return null;
  const p = input as Record<string, unknown>;
  const uid = typeof p.shipmentUid === 'string' && p.shipmentUid.trim() ? p.shipmentUid.trim() : null;
  const decision = typeof p.decision === 'string' ? p.decision.trim().toUpperCase() : '';
  if (!uid || !(REVIEW_DECISIONS as readonly string[]).includes(decision)) return null;
  const at = typeof p.reviewedAt === 'string' && !Number.isNaN(Date.parse(p.reviewedAt)) ? p.reviewedAt : new Date().toISOString();
  const reason = typeof p.reason === 'string' && p.reason.trim() ? p.reason.trim().slice(0, 500) : null;
  return { shipmentUid: uid, decision: decision as ReviewDecision, reason, reviewedAt: at };
}
