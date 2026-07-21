/**
 * Outbound Deliveries channel (Veeey → YeldnIN), contract v2 §2.1
 * `delivery.created`. Fired when Ops ship an order via **VEEEY Express** (the
 * `OWN` courier) — Aramex/SMSA go straight to their own carrier APIs and never
 * reach YeldnIN.
 *
 * PURE (no DB/IO) so it stays byte-compatible with YeldnIN's
 * `parseDeliveryCreated`, which REJECTS (never coerces) an unknown store, a
 * missing order number, customer name, or address. Keep the two in step: a
 * silent shape drift here surfaces as a dead outbox event, not a loud error.
 */

export const STORE_KEYS = ['veeey.net', 'veeey.com'] as const;
export type StoreKey = (typeof STORE_KEYS)[number];

export type WireDeliveryLine = { sku: string | null; name: string; qty: number };

export interface WireDeliveryCreated {
  storeKey: StoreKey;
  orderNumber: string;
  placedAt: string | null;
  customer: { name: string; phone: string | null; altPhone: string | null };
  address: { text: string; zone: string | null; subArea: string | null; mapUrl: string | null };
  lines: WireDeliveryLine[];
  /** Field name is historical; the UNIT IS PIASTRES (contract v2 §2.1). */
  collectAmountEgp: number;
  paymentMethod: 'COD' | 'PREPAID';
  notes: string | null;
}

/**
 * This deployment's store key — half of YeldnIN's `(storeKey, orderNumber)`
 * correlation key. ONE codebase runs both stores, so it must come from the
 * environment; an unrecognised host returns null (caller refuses to send)
 * rather than guessing, because YeldnIN rejects an unknown store outright.
 */
export function resolveStoreKey(siteUrl?: string | null, override?: string | null): StoreKey | null {
  const pick = (v?: string | null): StoreKey | null => {
    if (!v || !v.trim()) return null;
    const raw = v.trim().toLowerCase();
    let host = raw;
    if (raw.includes('://')) {
      try { host = new URL(raw).host; } catch { host = raw; }
    }
    const bare = host.replace(/^www\./, '').split(':')[0];
    return (STORE_KEYS as readonly string[]).includes(bare) ? (bare as StoreKey) : null;
  };
  return pick(override) ?? pick(siteUrl);
}

/** Methods where the courier collects cash at the door; everything else is prepaid. */
const COLLECT_ON_DELIVERY = new Set(['COD', 'POS_ON_DELIVERY']);

export type DeliveryOrderInput = {
  number: string;
  placedAt?: Date | string | null;
  paymentMethod?: string | null;
  paymentState?: string | null;
  totalPiastres: bigint | number;
  /** Order.shippingAddressJson snapshot: { name, phone, governorate, city, area, street }. */
  shippingAddressJson: unknown;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  lines: WireDeliveryLine[];
};

/** Join the address snapshot into the single human line a courier actually reads. */
export function addressText(snap: Record<string, unknown>): string {
  const part = (k: string) => (typeof snap[k] === 'string' ? (snap[k] as string).trim() : '');
  return [part('street'), part('building'), part('area'), part('city'), part('governorate')]
    .filter(Boolean)
    .join(', ');
}

/**
 * Build the `delivery.created` payload. Returns null when the order can't make a
 * valid one (no store key, no customer name, or no address) — the caller must
 * surface that to Ops instead of queueing an event YeldnIN will reject.
 */
export function orderToDeliveryWire(storeKey: StoreKey | null, o: DeliveryOrderInput): WireDeliveryCreated | null {
  if (!storeKey) return null;
  const number = o.number?.trim();
  if (!number) return null;

  const snap = (o.shippingAddressJson ?? {}) as Record<string, unknown>;
  const snapStr = (k: string) => (typeof snap[k] === 'string' && (snap[k] as string).trim() ? (snap[k] as string).trim() : null);

  const name = (o.customerName?.trim() || snapStr('name') || '').trim();
  if (!name) return null;

  const text = addressText(snap);
  if (!text) return null;

  // Prepaid collects nothing. An order already marked PAID is prepaid whatever
  // the nominal method says — otherwise the courier would collect twice.
  const method = (o.paymentMethod ?? '').toUpperCase();
  const paid = (o.paymentState ?? '').toUpperCase() === 'PAID';
  const paymentMethod: 'COD' | 'PREPAID' = !paid && COLLECT_ON_DELIVERY.has(method) ? 'COD' : 'PREPAID';

  const total = typeof o.totalPiastres === 'bigint' ? Number(o.totalPiastres) : Number(o.totalPiastres || 0);
  const collect = paymentMethod === 'COD' && Number.isFinite(total) && total > 0 ? Math.round(total) : 0;

  const placed = o.placedAt instanceof Date ? o.placedAt.toISOString() : (typeof o.placedAt === 'string' ? o.placedAt : null);

  return {
    storeKey,
    orderNumber: number,
    placedAt: placed,
    // The snapshot phone is what the customer gave for THIS delivery, so it wins
    // over the account phone — it's the number the courier should actually call.
    customer: { name, phone: snapStr('phone') || o.customerPhone?.trim() || null, altPhone: null },
    address: { text, zone: snapStr('governorate'), subArea: snapStr('area'), mapUrl: null },
    lines: o.lines.filter((l) => l.name?.trim()).map((l) => ({ sku: l.sku, name: l.name.trim(), qty: Math.max(1, Math.floor(l.qty || 0)) })),
    collectAmountEgp: collect,
    paymentMethod,
    notes: o.notes?.trim() || null,
  };
}
