'use server';

import { revalidatePath } from 'next/cache';
import { saveNavConfig, resetNavConfig } from '@/lib/nav-service';
import { normalizeNav } from '@/lib/nav-config';

/** Save the whole nav config (JSON from the editor). Revalidates the storefront
 *  layout so the header picks up the change immediately. */
export async function saveNavAction(json: string): Promise<{ ok: boolean }> {
  await saveNavConfig(normalizeNav(JSON.parse(json)));
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function resetNavAction(): Promise<{ ok: boolean }> {
  await resetNavConfig();
  revalidatePath('/', 'layout');
  return { ok: true };
}
