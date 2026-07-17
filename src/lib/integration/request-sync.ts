import { REQUEST_TYPES, REQUEST_STATUSES } from '@/lib/request-logic';

/**
 * The Request wire contract shared with YeldnIN (Phase D, re-baselined
 * INTEGRATION_CONTRACT §4.3 / §5). One request = a uid-keyed, multi-line
 * purchasing request; `uid` (REQ<YY><MM><seq3>) is the correlation key both
 * sides upsert on. Pure mapping so the shape is unit-testable and identical to
 * YeldnIN's — money crosses the wire as **EGP numbers** (both apps store minor
 * units internally: Veeey piastres BigInt, YeldnIN float EGP).
 */

export type WireRequestLine = {
  sku: string | null;
  productName: string;
  quantity: number;
  sellingPriceEgp: number | null;
  notes: string | null;
};

export type WireRequest = {
  uid: string;
  type: string; // SPECIAL_ORDER | OUT_OF_STOCK | RESTOCK | OPTIONAL
  status: string; // PENDING | APPROVED | REJECTED
  scope: string; // EGV
  notes: string | null;
  depositEgp: number | null;
  autoOptional: boolean;
  archived: boolean;
  customer: { name: string | null; phone: string | null; veeeyCustomerId: string | null } | null;
  veeeyOrderId: string | null;
  lines: WireRequestLine[];
  photoUrls: string[];
};

const piastresToEgpN = (p: bigint | null): number | null => (p == null ? null : Number(p) / 100);

/** Normalized (already-loaded) request shape → wire payload. Pure. */
export function requestToWire(r: {
  uid: string | null;
  type: string;
  status: string;
  scope: string;
  notes: string | null;
  depositPiastres: bigint | null;
  autoOptional: boolean;
  archivedAt: Date | null;
  customer: { id: string; name: string; phone: string | null } | null;
  orderNumber: string | null;
  lines: { count: number; sellingPricePiastres: bigint | null; notes: string | null; sku: string | null; productName: string }[];
  photoUrls: string[];
}): WireRequest {
  return {
    uid: r.uid ?? '',
    type: r.type,
    status: r.status,
    scope: r.scope,
    notes: r.notes,
    depositEgp: piastresToEgpN(r.depositPiastres),
    autoOptional: r.autoOptional,
    archived: r.archivedAt != null,
    customer: r.customer ? { name: r.customer.name || null, phone: r.customer.phone, veeeyCustomerId: r.customer.id } : null,
    veeeyOrderId: r.orderNumber,
    lines: r.lines.map((l) => ({
      sku: l.sku,
      productName: l.productName,
      quantity: l.count,
      sellingPriceEgp: piastresToEgpN(l.sellingPricePiastres),
      notes: l.notes,
    })),
    photoUrls: r.photoUrls,
  };
}

const asType = (v: unknown) => (typeof v === 'string' && (REQUEST_TYPES as readonly string[]).includes(v) ? v : null);
const asStatus = (v: unknown) => (typeof v === 'string' && (REQUEST_STATUSES as readonly string[]).includes(v) ? v : null);

/**
 * Validate + normalize an inbound wire request (from YeldnIN). Returns null when
 * the payload is malformed (unknown type/status, no uid, no lines) so the
 * handler can reject rather than write garbage.
 */
export function parseWireRequest(input: unknown): WireRequest | null {
  if (!input || typeof input !== 'object') return null;
  const p = input as Record<string, unknown>;
  const uid = typeof p.uid === 'string' && p.uid.trim() ? p.uid.trim() : null;
  const type = asType(p.type);
  const status = asStatus(p.status) ?? 'PENDING';
  if (!uid || !type) return null;
  const rawLines = Array.isArray(p.lines) ? p.lines : [];
  const lines: WireRequestLine[] = rawLines
    .map((l): WireRequestLine | null => {
      if (!l || typeof l !== 'object') return null;
      const o = l as Record<string, unknown>;
      const quantity = Math.max(1, Math.floor(Number(o.quantity) || 0));
      const productName = typeof o.productName === 'string' ? o.productName : '';
      const sku = typeof o.sku === 'string' && o.sku.trim() ? o.sku.trim() : null;
      if (!sku && !productName) return null;
      const price = o.sellingPriceEgp;
      return {
        sku,
        productName,
        quantity,
        sellingPriceEgp: typeof price === 'number' && Number.isFinite(price) && price >= 0 ? price : null,
        notes: typeof o.notes === 'string' ? o.notes : null,
      };
    })
    .filter((l): l is WireRequestLine => l != null);
  if (!lines.length) return null;
  const cust = p.customer as Record<string, unknown> | null | undefined;
  const dep = p.depositEgp;
  return {
    uid,
    type,
    status,
    scope: typeof p.scope === 'string' ? p.scope : 'EGV',
    notes: typeof p.notes === 'string' ? p.notes : null,
    depositEgp: typeof dep === 'number' && Number.isFinite(dep) && dep >= 0 ? dep : null,
    autoOptional: p.autoOptional === true,
    archived: p.archived === true,
    customer: cust && typeof cust === 'object'
      ? {
          name: typeof cust.name === 'string' ? cust.name : null,
          phone: typeof cust.phone === 'string' ? cust.phone : null,
          veeeyCustomerId: typeof cust.veeeyCustomerId === 'string' ? cust.veeeyCustomerId : null,
        }
      : null,
    veeeyOrderId: typeof p.veeeyOrderId === 'string' ? p.veeeyOrderId : null,
    lines,
    photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls.filter((u): u is string => typeof u === 'string') : [],
  };
}
