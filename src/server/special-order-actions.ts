'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSpecialOrderRequest, createSpecialOrderByAdmin, advanceSpecialOrder, setSpecialOrderDetails, SPECIAL_ORDER_STATUSES } from '@/lib/special-order-service';
import { getCurrentUser } from '@/lib/auth-guards';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import type { SpecialOrderStatus } from '@/generated/prisma/client';

export type SpecialOrderFormState = { error?: string; ok?: boolean };

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

// ---- Customer (public) -----------------------------------------------------
export async function createSpecialOrderRequestAction(_p: SpecialOrderFormState, fd: FormData): Promise<SpecialOrderFormState> {
  const locale = localeOf(fd);
  // Public + guest-allowed → throttle per IP against automated spam.
  if (!rateLimit(`special-order:${await clientIp()}`, 5, 3_600_000)) return { error: 'invalid' };
  let user = null;
  try { user = await getCurrentUser(); } catch { /* guest */ }
  // Logged-in: pull name/phone/email from the account (form omits those fields).
  let account: { name: string | null; phone: string | null; email: string | null } | null = null;
  if (user) {
    const { prisma } = await import('@/lib/prisma');
    account = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, phone: true, email: true } });
  }
  const photoUrls = fd.getAll('photoUrls').filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  try {
    await createSpecialOrderRequest(
      {
        requestedProductText: str(fd, 'requestedProductText') ?? '',
        productUrl: str(fd, 'productUrl') ?? '',
        requesterName: account?.name ?? str(fd, 'requesterName') ?? '',
        requesterPhone: account?.phone ?? str(fd, 'requesterPhone') ?? '',
        requesterEmail: account?.email ?? str(fd, 'requesterEmail') ?? '',
        size: str(fd, 'size') ?? '',
        concentration: str(fd, 'concentration') ?? '',
        photoUrls,
        notes: str(fd, 'notes') ?? null,
      },
      user?.customerId ?? null,
    );
  } catch (e) {
    if (e instanceof Error && e.message === 'BAD_PHONE') return { error: 'phone' };
    return { error: 'invalid' };
  }
  revalidatePath(`/${locale}/special-order`);
  redirect(`/${locale}/special-order?submitted=1`);
}

// ---- Admin -----------------------------------------------------------------
export async function createSpecialOrderAdminAction(_p: SpecialOrderFormState, fd: FormData): Promise<SpecialOrderFormState> {
  const locale = localeOf(fd);
  try {
    await createSpecialOrderByAdmin({
      requestedProductText: str(fd, 'requestedProductText') ?? '',
      productUrl: str(fd, 'productUrl') ?? '',
      requesterName: str(fd, 'requesterName') ?? '',
      requesterPhone: str(fd, 'requesterPhone') ?? '',
      requesterEmail: str(fd, 'requesterEmail') ?? '',
      notes: str(fd, 'notes') ?? null,
      customerEmail: str(fd, 'customerEmail') ?? '',
    });
  } catch {
    return { error: 'invalid' };
  }
  revalidatePath(`/${locale}/admin/special-orders`);
  redirect(`/${locale}/admin/special-orders`);
}

export async function advanceSpecialOrderAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const status = str(fd, 'status');
  if (id && status && (SPECIAL_ORDER_STATUSES as string[]).includes(status)) {
    try { await advanceSpecialOrder(id, status as SpecialOrderStatus); } catch (e) { console.error('special order advance failed', e); }
  }
  revalidatePath(`/${locale}/admin/special-orders/${id}`);
  redirect(`/${locale}/admin/special-orders/${id}`);
}

export async function setSpecialOrderDetailsAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id') ?? '';
  try {
    await setSpecialOrderDetails(id, {
      slaType: str(fd, 'slaType') ?? null,
      deadlineAt: str(fd, 'deadlineAt') ?? null,
      requestedProductText: str(fd, 'requestedProductText') ?? null,
      notes: str(fd, 'notes') ?? null,
      compensationEgp: str(fd, 'compensationEgp') ?? null,
    });
  } catch (e) { console.error('special order details failed', e); }
  revalidatePath(`/${locale}/admin/special-orders/${id}`);
  redirect(`/${locale}/admin/special-orders/${id}`);
}
