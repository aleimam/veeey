import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings-service';
import { getCurrentUser } from '@/lib/auth-guards';
import { readCartId, getCart } from '@/lib/cart-service';
import { notify } from '@/lib/notification-service';

/**
 * Abandoned-cart recovery (#185). Keeps one CartSnapshot per signed-in customer,
 * refreshed on every cart change; an hourly sweep emails a single reminder for
 * carts left idle past `cart.abandonedIdleHours`. Guest (cookie-only) carts have
 * no customer to email and are never captured. All write paths are best-effort —
 * they never throw into the cart flow.
 */

const SITE = 'https://veeey.com';

/** Refresh (or clear) the signed-in customer's cart snapshot after a cart change. */
export async function syncCartSnapshot(): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user?.customerId) return;
    const cartId = await readCartId();
    const lines = cartId ? await getCart(cartId, 'en') : [];
    const itemCount = lines.reduce((s, l) => s + l.qty, 0);
    if (itemCount === 0 || !cartId) {
      await prisma.cartSnapshot.deleteMany({ where: { customerId: user.customerId } });
      return;
    }
    const subtotal = lines.reduce((s, l) => s + l.subtotalPiastres, 0);
    await prisma.cartSnapshot.upsert({
      where: { customerId: user.customerId },
      create: { customerId: user.customerId, cartId, itemCount, subtotalPiastres: BigInt(subtotal), reminderSentAt: null },
      update: { cartId, itemCount, subtotalPiastres: BigInt(subtotal), reminderSentAt: null }, // activity resets the reminder
    });
  } catch (e) {
    console.error('syncCartSnapshot failed', e);
  }
}

/** Drop a snapshot once its cart converts to an order (or is cleared). */
export async function clearCartSnapshotByCartId(cartId: string): Promise<void> {
  try {
    await prisma.cartSnapshot.deleteMany({ where: { cartId } });
  } catch (e) {
    console.error('clearCartSnapshotByCartId failed', e);
  }
}

/** Admin report: current open carts + totals + the most recent rows. */
export async function abandonedCartOverview(limit = 50) {
  const [agg, reminded, rows] = await Promise.all([
    prisma.cartSnapshot.aggregate({ _count: true, _sum: { subtotalPiastres: true } }),
    prisma.cartSnapshot.count({ where: { reminderSentAt: { not: null } } }),
    prisma.cartSnapshot.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        customerId: true, itemCount: true, subtotalPiastres: true, reminderSentAt: true, updatedAt: true,
        customer: { select: { firstName: true, lastName: true, user: { select: { email: true, name: true } } } },
      },
    }),
  ]);
  const now = Date.now();
  const withAge = rows.map((r) => ({ ...r, ageHours: Math.floor((now - r.updatedAt.getTime()) / 3_600_000) }));
  return { total: agg._count, reminded, valuePiastres: Number(agg._sum.subtotalPiastres ?? 0), rows: withAge };
}

/** Hourly sweep: email one reminder per cart left idle past the threshold. */
export async function sweepAbandonedCarts(): Promise<{ sent: number }> {
  if ((await getSetting('cart.abandonedReminderEnabled')).toLowerCase() !== 'true') return { sent: 0 };
  const idleHours = Number(await getSetting('cart.abandonedIdleHours')) || 6;
  const cutoff = new Date(Date.now() - idleHours * 60 * 60 * 1000);

  const due = await prisma.cartSnapshot.findMany({
    where: { reminderSentAt: null, itemCount: { gt: 0 }, updatedAt: { lt: cutoff } },
    select: {
      customerId: true, itemCount: true, subtotalPiastres: true,
      customer: { select: { user: { select: { email: true, name: true } } } },
    },
    take: 200,
  });

  let sent = 0;
  for (const snap of due) {
    // Mark first so a failure never re-sends on the next sweep.
    await prisma.cartSnapshot.update({ where: { customerId: snap.customerId }, data: { reminderSentAt: new Date() } });
    const email = snap.customer?.user.email;
    if (!email) continue;
    await notify({
      customerId: snap.customerId,
      toAddress: email,
      type: 'MARKETING',
      channel: 'EMAIL',
      templateKey: 'cart.abandoned',
      vars: { name: snap.customer?.user.name ?? 'there', count: snap.itemCount, total: (Number(snap.subtotalPiastres) / 100).toFixed(2), link: `${SITE}/en/cart` },
      refType: 'cart',
    });
    sent += 1;
  }
  return { sent };
}
