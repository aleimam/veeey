'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { getBoss, QUEUES } from '@/lib/jobs';
import { isAutofillActive } from '@/lib/attribute-autofill';
import { productsForBulk, assignValueToProducts, aiSuggestForProducts, applyPicks, getAutofillStatus, type ProductFilter, type BulkProduct, type AiPick } from '@/lib/attribute-bulk-service';

/** Load products (with current values) for the chosen attribute + filters. */
export async function fetchBulkProductsAction(filter: ProductFilter): Promise<{ items: BulkProduct[]; total: number }> {
  try {
    return await productsForBulk(filter);
  } catch {
    return { items: [], total: 0 };
  }
}

/** Assign one value to the selected products. */
export async function assignValueAction(input: { attributeId: string; attributeValueId: string; productIds: string[] }): Promise<{ applied: number; error?: string }> {
  try {
    return await assignValueToProducts(input);
  } catch (e) {
    return { applied: 0, error: e instanceof Error && e.message === 'FORBIDDEN' ? 'forbidden' : 'failed' };
  }
}

/** Get AI-suggested values for the selected products (not applied yet). */
export async function aiSuggestAction(input: { attributeId: string; productIds: string[] }): Promise<{ picks: AiPick[]; aiOff?: boolean; error?: string }> {
  try {
    return await aiSuggestForProducts(input);
  } catch (e) {
    return { picks: [], error: e instanceof Error && e.message === 'FORBIDDEN' ? 'forbidden' : 'failed' };
  }
}

/** Apply reviewed AI picks. */
export async function applyPicksAction(input: { attributeId: string; pairs: { productId: string; attributeValueId: string }[] }): Promise<{ applied: number; error?: string }> {
  try {
    return await applyPicks(input);
  } catch (e) {
    return { applied: 0, error: e instanceof Error && e.message === 'FORBIDDEN' ? 'forbidden' : 'failed' };
  }
}

/** Start the one-click background auto-fill of ALL filterable attributes.
 *  Long-running (chunked AI calls over the whole catalog) → runs in the worker;
 *  a 4h visibility window + no auto-retry so pg-boss never double-dispatches. */
export async function startAttributeAutofillAction(fd: FormData): Promise<void> {
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  const target = `/${locale}/admin/attributes/bulk`;
  const user = await requirePermission('catalog.write');
  if (isAutofillActive(await getAutofillStatus(), new Date())) redirect(`${target}?job=busy`);
  const boss = await getBoss();
  if (!boss) redirect(`${target}?job=offline`); // needs the worker process
  try {
    await boss.send(QUEUES.attributeAutofill, {}, { expireInSeconds: 14400, retryLimit: 0 });
    await audit({ actorType: 'USER', actorId: user.id, action: 'attribute.autofill.start', entityType: 'Attribute' });
  } catch {
    redirect(`${target}?job=offline`);
  }
  revalidatePath(target);
  redirect(`${target}?job=started`);
}
