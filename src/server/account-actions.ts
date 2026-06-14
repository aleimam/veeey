'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';
import { requestReturn } from '@/lib/return-service';

/** Customer-initiated return (FR-RET-01) — returns all items of one of the
 *  customer's own orders for pharmacist review. */
export async function requestReturnAction(fd: FormData): Promise<void> {
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  const orderId = (fd.get('orderId') as string) || '';
  const reason = ((fd.get('reason') as string) || 'Customer request').slice(0, 200);

  const user = await getCurrentUser();
  if (user?.customerId && orderId) {
    const order = await prisma.order.findFirst({ where: { id: orderId, customerId: user.customerId }, include: { items: true } });
    if (order && order.items.length > 0) {
      try {
        await requestReturn(order.id, user.customerId, reason, order.items.map((i) => ({ orderItemId: i.id, qty: i.qty })));
      } catch {
        // ignore
      }
    }
  }
  revalidatePath(`/${locale}/account`);
  redirect(`/${locale}/account`);
}
