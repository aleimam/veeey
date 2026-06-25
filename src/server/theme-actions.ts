'use server';

import { revalidatePath } from 'next/cache';
import { saveThemeOverrides, resetTheme } from '@/lib/theme-service';
import type { ThemeOverrides } from '@/lib/theme';

/** Persist the Appearance editor's theme overrides (RBAC + audit live in the
 *  service). Revalidates so the storefront picks up the new tokens. */
export async function saveThemeAction(overrides: ThemeOverrides): Promise<{ ok: boolean }> {
  try {
    await saveThemeOverrides(overrides);
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Clear all overrides → revert to the design-system defaults. */
export async function resetThemeAction(): Promise<{ ok: boolean }> {
  try {
    await resetTheme();
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
