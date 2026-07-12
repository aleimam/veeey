'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveFeatureStates } from '@/lib/feature-service';
import { FEATURE_IDS, type FeatureId } from '@/lib/feature-flags';

/** Save the feature-toggle form. An unchecked box submits nothing, so every id
 *  not present in the form is treated as OFF. */
export async function saveFeaturesAction(fd: FormData): Promise<void> {
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  let flag = 'saved=1';
  try {
    const next = {} as Record<FeatureId, boolean>;
    for (const id of FEATURE_IDS) next[id] = fd.get(id) === 'on';
    await saveFeatureStates(next);
  } catch (e) {
    flag = e instanceof Error && e.message === 'FORBIDDEN' ? 'error=forbidden' : 'error=1';
  }
  revalidatePath(`/${locale}/admin/features`);
  redirect(`/${locale}/admin/features?${flag}`);
}
