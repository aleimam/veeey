'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { saveCoupon } from '@/lib/coupon-service';

export type AdminFormState = { error?: string };

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const bool = (fd: FormData, k: string) => fd.get(k) != null;

export async function saveCouponAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveCoupon(str(fd, 'id') ?? null, {
      code: str(fd, 'code') ?? '',
      type: (str(fd, 'type') ?? 'PERCENT') as 'PERCENT' | 'FIXED' | 'FREE_ITEM',
      value: str(fd, 'value') ?? '0',
      minSpendEgp: str(fd, 'minSpendEgp') ?? null,
      firstOrderOnly: bool(fd, 'firstOrderOnly'),
      singleUse: bool(fd, 'singleUse'),
      usageLimit: str(fd, 'usageLimit') ?? null,
      perCustomerLimit: str(fd, 'perCustomerLimit') ?? null,
      stackable: fd.get('stackable') != null,
      startsAt: str(fd, 'startsAt') ?? null,
      endsAt: str(fd, 'endsAt') ?? null,
      active: fd.get('active') != null,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'FORBIDDEN') return { error: 'forbidden' };
    return { error: 'invalid' };
  }
  revalidatePath(`/${locale}/admin/coupons`);
  redirect(`/${locale}/admin/coupons`);
}

export async function assignTierAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const customerId = str(fd, 'customerId');
  const tierId = str(fd, 'tierId') ?? null;
  if (customerId) {
    const user = await requirePermission('pricing.manage');
    await prisma.customer.update({ where: { id: customerId }, data: { tierId } });
    await audit({ actorType: 'USER', actorId: user.id, action: 'customer.tier', entityType: 'Customer', entityId: customerId, data: { tierId } });
  }
  revalidatePath(`/${locale}/admin/customers`);
  redirect(`/${locale}/admin/customers`);
}
