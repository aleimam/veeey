/**
 * net-sync customers — PURE transform (no DB/PII imports → unit-testable with
 * synthetic data only). Maps a raw WP user row → the Veeey customer shape.
 *
 * Owner decisions: registered users only · name/email/phone/addresses ·
 * marketing consent OFF (no WP opt-in flag exists) · NO passwords (OTP later) ·
 * lifetime-spend snapshot from WP order totals drives the tier.
 */
import { egpToPiastres } from '@/lib/format';

export type RawCustomer = {
  wpUserId: number;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  billingFirst: string | null;
  billingLast: string | null;
  billingPhone: string | null;
  billingAddress1: string | null;
  billingAddress2: string | null;
  billingCity: string | null;
  billingState: string | null;
  shippingPhone: string | null;
  shippingAddress1: string | null;
  shippingAddress2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
};

export type PlannedAddress = {
  governorate: string;
  city: string;
  area: string;
  street: string | null;
  phone: string | null;
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
};

export type PlannedCustomer = {
  wpUserId: number;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  addresses: PlannedAddress[];
};

const clean = (v: string | null | undefined): string | null => {
  const s = (v ?? '').trim();
  return s ? s : null;
};

/** WooCommerce stores emails as entered; Veeey keys on a lowercased email. */
export const normalizeEmail = (e: string): string => e.trim().toLowerCase();

/** Egyptian mobile normalization: strip spaces/dashes, keep leading + once. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const s = (raw ?? '').replace(/[\s()-]/g, '').trim();
  if (!s) return null;
  const plus = s.startsWith('+');
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return null;
  return (plus ? '+' : '') + digits;
}

/** Resolve first/last/display into a {firstName,lastName,name} triple. */
export function resolveName(c: Pick<RawCustomer, 'displayName' | 'firstName' | 'lastName' | 'billingFirst' | 'billingLast'>): {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
} {
  const firstName = clean(c.firstName) ?? clean(c.billingFirst);
  const lastName = clean(c.lastName) ?? clean(c.billingLast);
  const display = clean(c.displayName);
  const composed = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
  let name = display ?? composed;
  // A display name that is just the email local-part is noise, not a real name.
  if (name && !firstName && !lastName && /@/.test(c.displayName ?? '')) name = null;
  return { firstName, lastName, name };
}

/** Build an address from a billing/shipping field set, or null if it's empty.
 *  Mirrors the veeey.com WooCommerce importer's field mapping. */
function buildAddress(
  parts: { address1: string | null; address2: string | null; city: string | null; state: string | null; phone: string | null },
  flags: { isDefaultBilling: boolean; isDefaultShipping: boolean },
): PlannedAddress | null {
  const street = clean(parts.address1);
  const city = clean(parts.city);
  const state = clean(parts.state);
  const area = clean(parts.address2) ?? city;
  if (!street && !city && !state && !area) return null; // nothing worth storing
  return {
    governorate: state ?? '—',
    city: city ?? '—',
    area: area ?? city ?? '—',
    street,
    phone: normalizePhone(parts.phone),
    isDefaultBilling: flags.isDefaultBilling,
    isDefaultShipping: flags.isDefaultShipping,
  };
}

/** Map a raw WP customer → the Veeey plan (pure). Addresses: billing is the
 *  default for both; a distinct shipping address is added only when it differs. */
export function planCustomer(c: RawCustomer): PlannedCustomer {
  const { firstName, lastName, name } = resolveName(c);
  const phone = normalizePhone(c.billingPhone) ?? normalizePhone(c.shippingPhone);

  const billing = buildAddress(
    { address1: c.billingAddress1, address2: c.billingAddress2, city: c.billingCity, state: c.billingState, phone: c.billingPhone },
    { isDefaultBilling: true, isDefaultShipping: true },
  );
  const shipping = buildAddress(
    { address1: c.shippingAddress1, address2: c.shippingAddress2, city: c.shippingCity, state: c.shippingState, phone: c.shippingPhone },
    { isDefaultBilling: false, isDefaultShipping: false },
  );

  const addresses: PlannedAddress[] = [];
  if (billing) addresses.push(billing);
  // Add shipping only when it's a real, distinct address.
  if (shipping && (!billing || shipping.street !== billing.street || shipping.city !== billing.city)) {
    if (billing) { shipping.isDefaultShipping = true; billing.isDefaultShipping = false; }
    else { shipping.isDefaultShipping = true; shipping.isDefaultBilling = true; }
    addresses.push(shipping);
  }

  return { wpUserId: c.wpUserId, email: normalizeEmail(c.email), name, firstName, lastName, phone, addresses };
}

/** Convert a WP order-stats total (EGP major-unit double) → integer piastres. */
export const spendToPiastres = (egp: number): bigint => (Number.isFinite(egp) && egp > 0 ? egpToPiastres(egp) : 0n);

/** Highest tier whose minSpend ≤ spend (tiers pre-sorted ascending by rank). PURE. */
export function pickTierId(tiers: Array<{ id: string; rank: number; minSpendPiastres: bigint }>, spend: bigint): string | null {
  let chosen: string | null = null;
  let bestRank = -Infinity;
  for (const t of tiers) {
    if (spend >= t.minSpendPiastres && t.rank > bestRank) { chosen = t.id; bestRank = t.rank; }
  }
  return chosen;
}
