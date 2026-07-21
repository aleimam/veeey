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
