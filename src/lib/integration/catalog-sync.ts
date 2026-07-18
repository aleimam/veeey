/**
 * Catalog wire contract shared with YeldnIN (catalog sync channel — Veeey is the
 * catalog MASTER, so this direction is push-only). Veeey emits every product to
 * YeldnIN keyed on **`wpId`** (the WordPress product id — `Veeey.Product.legacyWpId`).
 * YeldnIN links each product to a stable `veeeyWpId` column; on first contact it
 * matches its current WP-id-in-`sku` (`sku === String(wpId)`), thereafter on
 * `veeeyWpId`.
 *
 * Pure mapping (no DB/IO) so the shape is unit-testable and stays byte-compatible
 * with YeldnIN's `catalog-wire.ts`. Mirrors `request-sync.ts`: this file holds only
 * the pure wire mapping; the best-effort emit + backfill DB glue live in
 * `catalog-service.ts`.
 */

export type WireProduct = {
  wpId: number | null; // WordPress product id (Veeey legacyWpId) — the correlation key
  sku: string | null; // Veeey's own SKU
  name: string;
  type: string; // Veeey ProductKind: SUPPLEMENT | DEVICE | INJECTION
  active: boolean; // status === "PUBLISHED"
};

/** Loaded (already-fetched) product shape → wire payload. Pure. */
export function productToWire(p: {
  legacyWpId: number | null;
  sku: string | null;
  nameEn: string;
  kind: string;
  status: string;
}): WireProduct {
  return {
    wpId: p.legacyWpId,
    sku: p.sku,
    name: p.nameEn,
    type: p.kind,
    active: p.status === 'PUBLISHED',
  };
}

/**
 * Validate + normalize an inbound wire product. Returns null when the payload is
 * malformed — no integer `wpId`, or no `name` — so a caller can reject rather than
 * write garbage. `wpId` is the required correlation key; `name` must be present.
 * `sku`/`type` are tolerated (null / empty string) so a product that lacks them
 * still round-trips.
 */
export function parseProductWire(input: unknown): WireProduct | null {
  if (!input || typeof input !== 'object') return null;
  const p = input as Record<string, unknown>;
  const wpId = typeof p.wpId === 'number' && Number.isInteger(p.wpId) ? p.wpId : null;
  const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : null;
  if (wpId == null || !name) return null;
  const sku = typeof p.sku === 'string' && p.sku.trim() ? p.sku.trim() : null;
  const type = typeof p.type === 'string' && p.type.trim() ? p.type.trim() : '';
  return { wpId, sku, name, type, active: p.active === true };
}
