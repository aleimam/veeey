'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveVariantGroup, deleteVariantGroup, type SaveGroupInput } from '@/lib/variant-service';

/** Save a variant group (client editor submits the full payload). */
export async function saveVariantGroupAction(input: SaveGroupInput): Promise<{ id?: string; error?: string }> {
  try {
    return await saveVariantGroup(input);
  } catch (e) {
    if (e instanceof Error && e.message === 'FORBIDDEN') return { error: 'forbidden' };
    if (e instanceof Error && e.message === 'INVALID') return { error: 'invalid' };
    return { error: 'failed' };
  }
}

/** Delete a group (list-page form action) — members are unlinked, not deleted. */
export async function deleteVariantGroupAction(fd: FormData): Promise<void> {
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  const id = typeof fd.get('id') === 'string' ? (fd.get('id') as string) : '';
  let flag = 'deleted=1';
  try {
    await deleteVariantGroup(id);
  } catch (e) {
    flag = e instanceof Error && e.message === 'FORBIDDEN' ? 'error=forbidden' : 'error=1';
  }
  revalidatePath(`/${locale}/admin/variant-groups`);
  redirect(`/${locale}/admin/variant-groups?${flag}`);
}
