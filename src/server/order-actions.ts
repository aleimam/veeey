'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  transitionOrder,
  refundPayment,
  assignPharmacist,
  setPayCheck,
  setSystemPaymentMethod,
  setOrderChannel,
  setOrderMeta,
  setTracking,
  clearTracking,
  addOrderItem,
  removeOrderItem,
  markOrderItemLost,
  addGiftToOrder,
  removeGiftFromOrder,
  createManualOrder,
  searchOrderProducts,
} from '@/lib/order-service';
import { saveGift } from '@/lib/gift-service';
import { processReturn } from '@/lib/return-service';
import type { OrderStatus } from '@/lib/order-status';

export type AdminFormState = { error?: string };

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v == null ? undefined : Number(v);
};

function backToOrder(locale: string, id: string): never {
  revalidatePath(`/${locale}/admin/orders/${id}`);
  redirect(`/${locale}/admin/orders/${id}`);
}

/** Live product search for the staff order pickers (client-callable). */
export async function searchOrderProductsAction(q: string) {
  try { return await searchOrderProducts(q); } catch { return []; }
}

export async function createManualOrderAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  const productIds = fd.getAll('productId').filter((v): v is string => typeof v === 'string');
  const qtys = fd.getAll('qty').filter((v): v is string => typeof v === 'string');
  const lotIds = fd.getAll('lotId').filter((v): v is string => typeof v === 'string');
  const items = productIds
    .map((productId, i) => ({ productId, qty: Number(qtys[i] ?? 0), lotId: lotIds[i] ?? '' }))
    .filter((it) => it.productId && it.qty > 0);
  if (items.length === 0) return { error: 'no_items' };

  const giftIds = fd.getAll('giftId').filter((v): v is string => typeof v === 'string');
  const giftQtys = fd.getAll('giftQty').filter((v): v is string => typeof v === 'string');
  const gifts = giftIds
    .map((giftId, i) => ({ giftId, qty: Number(giftQtys[i] ?? 0) }))
    .filter((g) => g.giftId && g.qty > 0);

  let order;
  try {
    order = await createManualOrder({
      customerId: str(fd, 'customerId') ?? '',
      addressId: str(fd, 'addressId') ?? '',
      customerEmail: str(fd, 'customerEmail') ?? '',
      name: str(fd, 'name') ?? '',
      phone: str(fd, 'phone') ?? '',
      governorate: str(fd, 'governorate') ?? '',
      city: str(fd, 'city') ?? '',
      area: str(fd, 'area') ?? '',
      street: str(fd, 'street') ?? '',
      shippingType: (str(fd, 'shippingType') ?? 'FAST_FREE') as 'FAST_FREE' | 'ULTRAFAST' | 'PICK_FROM_OFFICE',
      paymentMethod: str(fd, 'paymentMethod') ?? 'COD', // customer-facing method code
      channel: str(fd, 'channel') ?? '', // backend channel (required; no Direct)
      discreetPackaging: fd.get('discreetPackaging') != null,
      items,
      gifts,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'INSUFFICIENT_STOCK') return { error: 'insufficient_stock' };
    if (e instanceof Error && e.message === 'NO_GIFT_STOCK') return { error: 'gift_stock' };
    if (e instanceof Error && e.message === 'FORBIDDEN') return { error: 'forbidden' };
    console.error('manual order failed', e);
    return { error: 'invalid' };
  }
  revalidatePath(`/${locale}/admin/orders`);
  redirect(`/${locale}/admin/orders/${order.id}`);
}

export async function transitionOrderAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const to = str(fd, 'status') as OrderStatus | undefined;
  if (id && to) {
    try { await transitionOrder(id, to, str(fd, 'reason')); } catch (e) { console.error(e); }
    backToOrder(locale, id);
  }
  redirect(`/${locale}/admin/orders`);
}

export async function refundPaymentAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) {
    try { await refundPayment(id, str(fd, 'reason')); } catch (e) { console.error(e); }
    backToOrder(locale, id);
  }
  redirect(`/${locale}/admin/orders`);
}

export async function assignPharmacistAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) { try { await assignPharmacist(id, str(fd, 'pharmacistId') ?? null); } catch (e) { console.error(e); } backToOrder(locale, id); }
  redirect(`/${locale}/admin/orders`);
}

export async function setPayCheckAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const pc = str(fd, 'payCheck') as 'NO' | 'YES' | 'PROBLEM' | undefined;
  if (id && pc) { try { await setPayCheck(id, pc); } catch (e) { console.error(e); } backToOrder(locale, id); }
  redirect(`/${locale}/admin/orders`);
}

export async function setSystemPaymentMethodAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) { try { await setSystemPaymentMethod(id, str(fd, 'systemPaymentMethod') ?? null); } catch (e) { console.error(e); } backToOrder(locale, id); }
  redirect(`/${locale}/admin/orders`);
}

export async function setOrderMetaAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) {
    try { await setOrderMeta(id, { customerOrderType: str(fd, 'customerOrderType') ?? null, orderProductType: str(fd, 'orderProductType') ?? null, source: str(fd, 'source') ?? null }); } catch (e) { console.error(e); }
    backToOrder(locale, id);
  }
  redirect(`/${locale}/admin/orders`);
}

export async function setTrackingAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const tracking = str(fd, 'trackingNumber');
  if (id && tracking) { try { await setTracking(id, tracking, str(fd, 'courier')); } catch (e) { console.error(e); } backToOrder(locale, id); }
  redirect(`/${locale}/admin/orders`);
}

export async function clearTrackingAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) { try { await clearTracking(id); } catch (e) { console.error(e); } backToOrder(locale, id); }
  redirect(`/${locale}/admin/orders`);
}

export async function setChannelAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) { try { await setOrderChannel(id, str(fd, 'channel') ?? ''); } catch (e) { console.error(e); } backToOrder(locale, id); }
  redirect(`/${locale}/admin/orders`);
}

export async function addOrderItemAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const productId = str(fd, 'productId');
  const qty = num(fd, 'qty') ?? 1;
  const lotId = str(fd, 'lotId') ?? null;
  if (id && productId) { try { await addOrderItem(id, productId, qty, lotId); } catch (e) { console.error(e); } backToOrder(locale, id); }
  redirect(`/${locale}/admin/orders`);
}

export async function removeOrderItemAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const orderItemId = str(fd, 'orderItemId');
  if (orderItemId) { try { await removeOrderItem(orderItemId); } catch (e) { console.error(e); } }
  if (id) backToOrder(locale, id);
  redirect(`/${locale}/admin/orders`);
}

export async function markOrderItemLostAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const orderItemId = str(fd, 'orderItemId');
  const lost = fd.get('lost') === '1';
  if (orderItemId) { try { await markOrderItemLost(orderItemId, lost, str(fd, 'reason')); } catch (e) { console.error(e); } }
  if (id) backToOrder(locale, id);
  redirect(`/${locale}/admin/orders`);
}

export async function addGiftToOrderAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const giftId = str(fd, 'giftId');
  if (id && giftId) { try { await addGiftToOrder(id, giftId, num(fd, 'qty') ?? 1); } catch (e) { console.error(e); } backToOrder(locale, id); }
  redirect(`/${locale}/admin/orders`);
}

export async function removeGiftFromOrderAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const orderGiftId = str(fd, 'orderGiftId');
  if (orderGiftId) { try { await removeGiftFromOrder(orderGiftId); } catch (e) { console.error(e); } }
  if (id) backToOrder(locale, id);
  redirect(`/${locale}/admin/orders`);
}

export async function saveGiftAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveGift(str(fd, 'id') ?? null, {
      code: str(fd, 'code') ?? '',
      internalName: str(fd, 'internalName') ?? '',
      stock: str(fd, 'stock') ?? '0',
      expiry: str(fd, 'expiry') ?? null,
      costEgp: str(fd, 'costEgp') ?? null,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'FORBIDDEN') return { error: 'forbidden' };
    return { error: 'invalid' };
  }
  revalidatePath(`/${locale}/admin/gifts`);
  redirect(`/${locale}/admin/gifts`);
}

export async function processReturnAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const status = str(fd, 'status') as 'QUARANTINE' | 'RESTOCKED' | 'WRITTEN_OFF' | 'REFUNDED' | 'REJECTED' | undefined;
  if (id && status) {
    const dispositions = fd.getAll('disposition').map((d, i) => ({ returnItemId: String(fd.getAll('returnItemId')[i]), disposition: String(d) as 'RESTOCK' | 'WRITE_OFF' | 'PENDING' }));
    try { await processReturn(id, { status, refundMethod: str(fd, 'refundMethod'), refundEgp: num(fd, 'refundEgp') ?? null, dispositions }); } catch (e) { console.error(e); }
  }
  revalidatePath(`/${locale}/admin/returns`);
  redirect(`/${locale}/admin/returns`);
}
