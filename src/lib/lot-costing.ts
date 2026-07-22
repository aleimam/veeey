/**
 * Lot costing — PURE (no DB/IO).
 *
 * **Owner decision 2026-07-22: weighted average.** When a shipment adds units to
 * a lot that already holds stock bought at a different price, the lot carries one
 * cost per unit, so the two prices have to become one. Averaging by quantity is
 * the only method that leaves the lot's total value equal to what was actually
 * paid for everything on it.
 *
 * All money is EGP piastres as BigInt — a cost is exact, never a float.
 */

/**
 * Blend an arriving cost into a lot's existing one, weighted by quantity.
 *
 * Returns null when there is nothing to set, so a caller can tell "leave the
 * column alone" from "write a zero".
 *
 * The asymmetric cases are deliberate:
 *  - arriving cost unknown → the existing cost stands. Averaging against a
 *    missing number would quietly write down the whole lot.
 *  - existing cost unknown → the arriving cost is adopted for the whole lot.
 *    It values the old units at the new price, which is an estimate, but a lot
 *    with no cost at all is worth nothing to a loss report.
 */
export function weightedAverageCost(
  existingQty: number,
  existingCost: bigint | null,
  addQty: number,
  addCost: bigint | null,
): bigint | null {
  const held = Math.max(0, Math.floor(existingQty));
  const added = Math.max(0, Math.floor(addQty));

  if (addCost == null) return existingCost;
  if (existingCost == null) return addCost;
  // Nothing on the shelf to average against — the arriving price IS the price.
  if (held <= 0) return addCost;
  if (added <= 0) return existingCost;

  const total = existingCost * BigInt(held) + addCost * BigInt(added);
  const denom = BigInt(held + added);
  // Round half up, in integer arithmetic: floor(total/denom + 1/2).
  return (2n * total + denom) / (2n * denom);
}
