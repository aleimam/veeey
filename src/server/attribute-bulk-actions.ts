'use server';

import { productsForBulk, assignValueToProducts, aiSuggestForProducts, applyPicks, type ProductFilter, type BulkProduct, type AiPick } from '@/lib/attribute-bulk-service';

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
