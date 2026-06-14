/**
 * Money is stored as EGP integer piastres (1 EGP = 100 piastres) — never floats.
 * These helpers format for display only.
 */

/** Format integer piastres as an EGP string, e.g. 960300 -> "9,603 EGP". */
export function formatEGP(piastres: number): string {
  const egp = Math.round(piastres) / 100;
  return `${egp.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(egp) ? 0 : 2,
    maximumFractionDigits: 2,
  })} EGP`;
}

/** Format a loyalty-points integer for display. */
export function formatPoints(points: number): string {
  return Math.round(points).toLocaleString('en-US');
}

/** Convert an EGP amount (number) to integer piastres BigInt. */
export function egpToPiastres(egp: number): bigint {
  return BigInt(Math.round(egp * 100));
}

/** Convert integer piastres BigInt to an EGP number (display/forms). */
export function piastresToEgp(piastres: bigint): number {
  return Number(piastres) / 100;
}

/** Parse a user-entered EGP string into piastres; null if invalid/negative. */
export function parseEgpInput(value: string): bigint | null {
  const n = Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return egpToPiastres(n);
}
