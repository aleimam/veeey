/**
 * SKU generation (FR-CAT-02). New products get a canonical Veeey SKU; the legacy
 * WordPress id is preserved separately (`legacyWpId`). SKUs are deterministic from
 * (brand code, sequence) so they're stable and testable — no hidden randomness.
 */

const SKU_PREFIX = 'VEY';

/** Lowercase, ASCII-fold to a-z0-9 and hyphens. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/** A short uppercase brand code (3 letters) derived from a brand name. */
export function brandCode(brandName: string): string {
  const letters = slugify(brandName).replace(/-/g, '');
  return (letters.slice(0, 3) || 'GEN').toUpperCase();
}

/** Build a SKU from a brand code and a numeric sequence, e.g. VEY-SOL-00042. */
export function skuFromParts(code: string, seq: number): string {
  const safe = (code || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${SKU_PREFIX}-${safe}-${String(seq).padStart(5, '0')}`;
}

/** Convenience: SKU from a brand name + sequence. */
export function generateSku(brandName: string, seq: number): string {
  return skuFromParts(brandCode(brandName), seq);
}
