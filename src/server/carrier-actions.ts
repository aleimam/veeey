'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';
import { setTracking } from '@/lib/order-service';
import { createAramexShipment, trackAramex } from '@/lib/carriers/aramex';
import { createSmsaShipment, trackSmsa } from '@/lib/carriers/smsa';
import { sendVeeeyExpressDelivery } from '@/lib/integration/delivery-sync';
import type { AwbEdit } from '@/lib/carriers/awb';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' ? v.trim() : ''; };
const numOf = (fd: FormData, k: string) => { const n = Number(str(fd, k)); return Number.isFinite(n) && str(fd, k) !== '' ? n : undefined; };

/** The staff-reviewed AWB fields from the "Ship this order" review form (Aramex/SMSA). */
function parseAwbEdit(fd: FormData): AwbEdit {
  return {
    name: str(fd, 'awbName') || undefined,
    phone: str(fd, 'awbPhone') || undefined,
    governorate: str(fd, 'awbGovernorate') || undefined,
    city: str(fd, 'awbCity') || undefined,
    area: str(fd, 'awbArea') || undefined,
    street: str(fd, 'awbStreet') || undefined,
    pieces: numOf(fd, 'awbPieces'),
    weightKg: numOf(fd, 'awbWeightKg'),
    contents: str(fd, 'awbContents') || undefined,
    codAmount: numOf(fd, 'awbCod'),
  };
}

/** Create an Aramex shipment for an order → AWB + label; marks it shipped. */
export async function createAramexShipmentAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  await requirePermission('orders.fulfill');
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) redirect(`/${locale}/admin/orders`);

  const r = await createAramexShipment({ number: order.number, totalPiastres: order.totalPiastres, paymentMethod: order.paymentMethod, shippingAddressJson: order.shippingAddressJson }, parseAwbEdit(fd));
  if (!r.ok) {
    revalidatePath(`/${locale}/admin/orders/${id}`);
    redirect(`/${locale}/admin/orders/${id}/edit?ship=aramex&shiperr=${encodeURIComponent(r.error)}`);
  }
  await setTracking(id, r.awb, 'ARAMEX'); // sets SHIPPED + notifies
  revalidatePath(`/${locale}/admin/orders/${id}`);
  redirect(`/${locale}/admin/orders/${id}/edit?shipok=1${r.labelUrl ? `&label=${encodeURIComponent(r.labelUrl)}` : ''}`);
}

/** Fetch the latest Aramex tracking status for the order's waybill. */
export async function trackAramexAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const awb = str(fd, 'awb');
  await requirePermission('orders.read');
  const r = await trackAramex(awb);
  const last = r.ok && r.updates && r.updates.length ? r.updates[0].status : (r.error ?? 'no_updates');
  redirect(`/${locale}/admin/orders/${id}/edit?track=${encodeURIComponent(String(last).slice(0, 90))}`);
}

/** Create an SMSA shipment for an order → AWB; marks it shipped. */
export async function createSmsaShipmentAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  await requirePermission('orders.fulfill');
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) redirect(`/${locale}/admin/orders`);
  const r = await createSmsaShipment({ number: order.number, totalPiastres: order.totalPiastres, paymentMethod: order.paymentMethod, shippingAddressJson: order.shippingAddressJson }, parseAwbEdit(fd));
  if (!r.ok) {
    revalidatePath(`/${locale}/admin/orders/${id}`);
    redirect(`/${locale}/admin/orders/${id}/edit?ship=smsa&shiperr=${encodeURIComponent(r.error)}`);
  }
  await setTracking(id, r.awb, 'SMSA');
  revalidatePath(`/${locale}/admin/orders/${id}`);
  redirect(`/${locale}/admin/orders/${id}/edit?shipok=1`);
}

/**
 * Ship with VEEEY Express (our own courier): hand the delivery to YeldnIN, whose
 * Ops assign the actual courier — their name/phone come back as the customer's
 * tracking detail. No AWB exists yet, so the order number IS the reference (it's
 * half of YeldnIN's idempotency key). Queue FIRST: if the hand-off can't be
 * built we must not mark the order shipped.
 */
export async function createVeeeyExpressShipmentAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  await requirePermission('orders.fulfill');
  const order = await prisma.order.findUnique({ where: { id }, select: { number: true } });
  if (!order) redirect(`/${locale}/admin/orders`);

  const r = await sendVeeeyExpressDelivery(id);
  if (!r.ok) {
    revalidatePath(`/${locale}/admin/orders/${id}`);
    redirect(`/${locale}/admin/orders/${id}/edit?ship=veeey&shiperr=${encodeURIComponent(r.error)}`);
  }
  await setTracking(id, order.number, 'OWN'); // sets SHIPPED + notifies
  revalidatePath(`/${locale}/admin/orders/${id}`);
  redirect(`/${locale}/admin/orders/${id}/edit?shipok=1${r.queued ? '' : '&offline=1'}`);
}

/** Fetch the latest SMSA tracking status for the order's waybill. */
export async function trackSmsaAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const awb = str(fd, 'awb');
  await requirePermission('orders.read');
  const r = await trackSmsa(awb);
  const last = r.ok && r.updates && r.updates.length ? r.updates[0].status : (r.error ?? 'no_updates');
  redirect(`/${locale}/admin/orders/${id}/edit?track=${encodeURIComponent(String(last).slice(0, 90))}`);
}
