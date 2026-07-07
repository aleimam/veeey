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
  const reasonId = (fd.get('reasonId') as string) || '';
  const reasonNote = ((fd.get('reasonNote') as string) || '').trim().slice(0, 500) || null;

  const user = await getCurrentUser();
  if (user?.customerId && orderId) {
    const order = await prisma.order.findFirst({ where: { id: orderId, customerId: user.customerId }, include: { items: true } });
    if (order && order.items.length > 0) {
      // Resolve the selected managed reason (snapshot its label into reasonCode
      // so the return stays readable even if the reason is later renamed).
      const reason = reasonId ? await prisma.returnReason.findUnique({ where: { id: reasonId } }) : null;
      let reasonCode = reason?.labelEn ?? 'Customer request';
      if (reasonNote) reasonCode = `${reasonCode} — ${reasonNote}`;
      try {
        await requestReturn(
          order.id,
          user.customerId,
          { reasonCode: reasonCode.slice(0, 300), reasonId: reason?.id ?? null, reasonNote },
          order.items.map((i) => ({ orderItemId: i.id, qty: i.qty })),
        );
      } catch {
        // ignore
      }
    }
  }
  revalidatePath(`/${locale}/account`);
  redirect(`/${locale}/account`);
}
