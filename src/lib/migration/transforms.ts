/**
 * Migration ETL transforms (P15, BUILD_PLAN §P15). Pure + unit-tested + self-
 * contained (no app imports) so the dry-run runner executes standalone under tsx.
 *
 * ⚠️ Tooling only. Runs against a SYNTHETIC fixture for validation. At cutover it
 * is re-pointed at the FRESH real export (sandboxed, real PII, OUTSIDE this repo
 * per AGENTS.md §3) and remapped to the actual export field names.
 */

// Mirrors src/lib/order-status.ts ORDER_STATUSES (kept inline to stay app-free).
export const VEEEY_ORDER_STATUSES = ['PENDING', 'EDIT', 'HOLD', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const;
export type VeeeyOrderStatus = (typeof VEEEY_ORDER_STATUSES)[number];

const ORDER_STATUS_MAP: Record<string, VeeeyOrderStatus> = {
  'pending confirmation': 'PENDING', pending: 'PENDING', draft: 'PENDING',
  processing: 'CONFIRMED', confirmed: 'CONFIRMED',
  hold: 'HOLD', 'on-hold': 'HOLD', 'on hold': 'HOLD',
  shipped: 'SHIPPED',
  'cash delivered': 'DELIVERED', 'card delivered': 'DELIVERED', delivered: 'DELIVERED', completed: 'DELIVERED',
  cancelled: 'CANCELLED', canceled: 'CANCELLED', failed: 'CANCELLED',
  refunded: 'REFUNDED', edit: 'EDIT',
};

export function mapOrderStatus(woo: string): { status: VeeeyOrderStatus | null; matched: boolean } {
  const key = woo.trim().toLowerCase().replace(/^wc-/, '').replace(/_/g, ' ');
  const status = ORDER_STATUS_MAP[key] ?? null;
  return { status, matched: status !== null };
}

const PAYMENT_MAP: Record<string, string> = {
  cod: 'COD', cash: 'COD', 'cash on delivery': 'COD',
  bacs: 'BANK_TRANSFER', bank: 'BANK_TRANSFER', 'bank transfer': 'BANK_TRANSFER', bank_transfer: 'BANK_TRANSFER',
  kashier_card: 'KASHIER', bank_card: 'KASHIER', card: 'KASHIER', kashier: 'KASHIER',
  wallet: 'WALLET', opay: 'OPAY', pos: 'POS_ON_DELIVERY',
};

export function mapPaymentMethod(woo: string): { method: string | null; matched: boolean; warning?: string } {
  const key = woo.trim().toLowerCase();
  if (key === 'cheque') return { method: null, matched: false, warning: 'cheque label is ambiguous (repurposed) — confirm wallet/POS mapping at cutover' };
  const method = PAYMENT_MAP[key] ?? null;
  return { method, matched: method !== null };
}

/** Free-text pharmacist → canonical key via an alias substring map ("Dr Eltaib"/"Eltaib" → same). */
export function normalizePharmacist(text: string, aliases: Record<string, string>): { value: string; matched: boolean } {
  const t = text.trim().replace(/^dr\.?\s+/i, '').replace(/\s+/g, ' ').toLowerCase();
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (t.includes(alias.toLowerCase())) return { value: canonical, matched: true };
  }
  return { value: text.trim(), matched: false };
}

/** Clamp out-of-range timestamps (legacy data has 2013→2031 bogus dates). */
export function clampDate(d: Date, min: Date, max: Date): { date: Date; clamped: boolean } {
  if (d < min) return { date: min, clamped: true };
  if (d > max) return { date: max, clamped: true };
  return { date: d, clamped: false };
}

export function normalizeLabel(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}
