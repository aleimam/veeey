import { prisma } from '@/lib/prisma';

/**
 * Purely numeric order numbers (checkout backlog P1 — owner: no more
 * `VY-MRVZHS69-698`). Backed by the Postgres sequence `order_number_seq`
 * (migration `checkout_payment_flow`), seeded above both 1,000,000 and any
 * imported numeric WP order id, so a new number can never collide with history.
 *
 * Existing `VY-` / `EV-` numbers are deliberately LEFT AS THEY ARE: the order
 * number is echoed to Kashier/OPay and is half of YeldnIN's
 * (storeKey, orderNumber) correlation key — renumbering history would orphan
 * those references for zero benefit. Cross-store uniqueness is not required for
 * the same reason: the store key disambiguates.
 *
 * Sequences never roll back, so an aborted checkout burns a number — gaps are
 * expected and harmless (they are not an accounting record).
 */
export async function nextOrderNumber(): Promise<string> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_number_seq') AS n`;
  return String(rows[0].n);
}
