'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  createRequest, updateRequest, approveRequest, rejectRequest, archiveRequest, createQuickRequest,
} from '@/lib/request-service';
import type { RequestCreateInput } from '@/lib/request-service';
import { isRequestType } from '@/lib/request-logic';

/**
 * Server actions for the purchasing-Requests admin surface. Thin FormData
 * adapters over request-service (which owns the RBAC gate + audit + validation).
 * Product lines arrive as parallel arrays (lineProductId[]/lineCount[]/…).
 */

export type RequestFormState = { error?: string; ok?: boolean; fields?: Record<string, string> };

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

/** Parse the repeated line inputs into the service's line shape (skips blank rows). */
function parseLines(fd: FormData): RequestCreateInput['lines'] {
  const ids = fd.getAll('lineProductId').map((v) => (typeof v === 'string' ? v.trim() : ''));
  const counts = fd.getAll('lineCount').map((v) => (typeof v === 'string' ? v : ''));
  const prices = fd.getAll('lineSellingPrice').map((v) => (typeof v === 'string' ? v : ''));
  const notes = fd.getAll('lineNotes').map((v) => (typeof v === 'string' ? v : ''));
  const lines: RequestCreateInput['lines'] = [];
  for (let i = 0; i < ids.length; i++) {
    if (!ids[i]) continue;
    lines.push({
      productId: ids[i],
      count: Number(counts[i] ?? '1') || 1,
      sellingPriceEgp: prices[i]?.trim() ? Number(prices[i]) : null,
      notes: notes[i]?.trim() || null,
    });
  }
  return lines;
}

function parseCreate(fd: FormData): RequestCreateInput {
  const type = str(fd, 'type') ?? '';
  return {
    type: (isRequestType(type) ? type : 'RESTOCK') as RequestCreateInput['type'],
    customerId: str(fd, 'customerId') ?? null,
    orderId: str(fd, 'orderId') ?? null,
    notes: str(fd, 'notes') ?? null,
    depositEgp: str(fd, 'depositEgp') ? Number(str(fd, 'depositEgp')) : null,
    photoUrls: fd.getAll('photoUrls').filter((v): v is string => typeof v === 'string' && v.trim() !== ''),
    autoOptional: fd.get('autoOptional') === 'on' || fd.get('autoOptional') === 'true',
    lines: parseLines(fd),
  };
}

/** Map a thrown service error to a form-state result (field errors surface inline). */
function toFormError(e: unknown): RequestFormState {
  if (e instanceof Error) {
    const fields = (e as { fields?: Record<string, string> }).fields;
    if (fields) return { error: 'invalid', fields };
    if (e.message === 'NOT_EDITABLE') return { error: 'not_editable' };
    if (e.message === 'NOT_FOUND') return { error: 'not_found' };
  }
  return { error: 'invalid' };
}

export async function createRequestAction(_p: RequestFormState, fd: FormData): Promise<RequestFormState> {
  const locale = localeOf(fd);
  try {
    await createRequest(parseCreate(fd));
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath(`/${locale}/admin/requests`);
  redirect(`/${locale}/admin/requests`);
}

export async function updateRequestAction(_p: RequestFormState, fd: FormData): Promise<RequestFormState> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (!id) return { error: 'invalid' };
  try {
    await updateRequest(id, parseCreate(fd));
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath(`/${locale}/admin/requests/${id}`);
  redirect(`/${locale}/admin/requests/${id}`);
}

export async function approveRequestAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id') ?? '';
  try { await approveRequest(id); } catch (e) { console.error('request approve failed', e); }
  revalidatePath(`/${locale}/admin/requests/${id}`);
  redirect(`/${locale}/admin/requests/${id}`);
}

export async function rejectRequestAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id') ?? '';
  try { await rejectRequest(id, str(fd, 'note')); } catch (e) { console.error('request reject failed', e); }
  revalidatePath(`/${locale}/admin/requests/${id}`);
  redirect(`/${locale}/admin/requests/${id}`);
}

export async function archiveRequestAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id') ?? '';
  try { await archiveRequest(id); } catch (e) { console.error('request archive failed', e); }
  revalidatePath(`/${locale}/admin/requests`);
  redirect(`/${locale}/admin/requests`);
}

/**
 * Fast path from the inventory suggestion tabs (A5): one product, staff-confirmed
 * type + qty. Redirects back to the tab it came from so the suggestion clears.
 */
export async function quickRequestAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const productId = str(fd, 'productId') ?? '';
  const type = str(fd, 'type') ?? '';
  const count = Number(str(fd, 'count') ?? '1') || 1;
  const back = str(fd, 'back') ?? `/${locale}/admin/inventory/requests`;
  try { await createQuickRequest(productId, count, type); } catch (e) { console.error('quick request failed', e); }
  revalidatePath(back);
  redirect(back);
}
