'use server';

import { saveBrand, saveTag, saveAttribute, addAttributeValue } from '@/lib/taxonomy-service';
import { translateToArabic } from '@/lib/ai';
import { requirePermission } from '@/lib/auth-guards';

/**
 * Inline quick-create actions (#C1/#C2) — called from the product form to add a
 * brand / tag / attribute / value without leaving the page. Each wraps the
 * RBAC-gated (catalog.write) service writer and returns {id,label} for the client
 * to insert + select.
 */
function keyFrom(name: string): string {
  const k = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return k || `attr_${crypto.randomUUID().slice(0, 8)}`;
}

export async function quickCreateBrand(name: string): Promise<{ id: string; label: string }> {
  const b = await saveBrand(null, { nameEn: name.trim() });
  return { id: b.id, label: b.nameEn };
}

export async function quickCreateTag(name: string): Promise<{ id: string; label: string }> {
  const t = await saveTag(null, { nameEn: name.trim() });
  return { id: t.id, label: t.nameEn };
}

export async function quickCreateAttribute(name: string, kind: 'SUPPLEMENT' | 'DEVICE' | 'INJECTION'): Promise<{ id: string; label: string }> {
  const a = await saveAttribute(null, { key: keyFrom(name), nameEn: name.trim(), kind });
  return { id: a.id, label: a.nameEn };
}

export async function quickCreateAttributeValue(attributeId: string, value: string): Promise<{ id: string; label: string }> {
  const v = await addAttributeValue(attributeId, value.trim());
  return { id: v.id, label: v.valueEn };
}

/** Translate English admin fields to Arabic via the configured AI (#D1). Staff
 *  review the result before saving. Returns null when AI is off. */
export async function translateFieldsAction(fields: Record<string, string>): Promise<Record<string, string> | null> {
  await requirePermission('catalog.write');
  return translateToArabic(fields);
}
