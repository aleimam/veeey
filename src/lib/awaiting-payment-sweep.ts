import { prisma } from '@/lib/prisma';
import { getNumberSetting } from '@/lib/settings-service';
import { transitionOrder } from '@/lib/order-service';

/**
 * Awaiting-payment sweep (checkout backlog P0-3). An online card order that was
 * never paid — the customer cancelled at the gateway, closed the tab, or the
 * session could not even be created — sits in AWAITING_PAYMENT holding stock.
 * Once the gateway session has certainly lapsed (Kashier v3 sessions expire at
 * 30 min; the window is admin-configurable and padded past that), the order is
 * cancelled SILENTLY: CANCELLED's stock effect restores the units (the order was
 * never shipped), and no customer notification fires — they never got an
 * "order placed" either, so a "cancelled" out of nowhere would only confuse.
 *
 * Worker-safe on purpose: no next/headers, no checkout-service import. A retry
 * that succeeds in the same instant is safe — transitionOrder's compare-and-swap
 * means whichever of {webhook→PENDING, sweep→CANCELLED} lands first wins and the
 * loser throws INVALID_TRANSITION (caught per order below). A payment that
 * settles AFTER the cancel is caught by markOrderPaid, which flags it for staff.
 */
export async function sweepAwaitingPayment(): Promise<{ cancelled: number }> {
  const minutes = (await getNumberSetting('payments.awaitingAutoCancelMinutes')) || 35;
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const stale = await prisma.order.findMany({
    where: { status: 'AWAITING_PAYMENT', placedAt: { lt: cutoff } },
    select: { id: true, number: true },
    take: 200,
  });
  let cancelled = 0;
  for (const o of stale) {
    try {
      await transitionOrder(o.id, 'CANCELLED', 'payment not completed — auto-cancelled', { system: true, silent: true });
      cancelled += 1;
    } catch (e) {
      // A concurrent webhook may have just paid it (CAS lost) — that's success,
      // not failure. Anything else is logged and retried next sweep.
      console.error('awaiting-payment sweep skip', o.number, e instanceof Error ? e.message : e);
    }
  }
  return { cancelled };
}
