'use server';

import { revalidatePath } from 'next/cache';
import {
  createTheme,
  duplicateTheme,
  renameTheme,
  updateThemeTokens,
  deleteTheme,
  setActiveTheme,
  assignTierTheme,
} from '@/lib/theme-service';
import type { ThemeOverrides } from '@/lib/theme';

// RBAC (settings.manage) + audit live in the service. The storefront layout is
// dynamic, so a layout revalidate lets the live site pick up theme changes.
type Result = { ok: boolean; id?: string; error?: string };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'ERROR');
function rev() {
  revalidatePath('/', 'layout');
}

/** Persist the Appearance editor's token overrides into a specific theme. */
export async function saveThemeAction(themeId: string, overrides: ThemeOverrides): Promise<Result> {
  try {
    await updateThemeTokens(themeId, overrides);
    rev();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Clear a theme's overrides → revert it to the design-system defaults. */
export async function resetThemeTokensAction(themeId: string): Promise<Result> {
  try {
    await updateThemeTokens(themeId, {});
    rev();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createThemeAction(name: string): Promise<Result> {
  try {
    const t = await createTheme(name);
    rev();
    return { ok: true, id: t.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function duplicateThemeAction(id: string): Promise<Result> {
  try {
    const t = await duplicateTheme(id);
    rev();
    return { ok: true, id: t.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function renameThemeAction(id: string, name: string): Promise<Result> {
  try {
    await renameTheme(id, name);
    rev();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function deleteThemeAction(id: string): Promise<Result> {
  try {
    await deleteTheme(id);
    rev();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function setActiveThemeAction(id: string): Promise<Result> {
  try {
    await setActiveTheme(id);
    rev();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Assign a theme to a tier; empty string clears it (falls back to active). */
export async function assignTierThemeAction(tierId: string, themeId: string): Promise<Result> {
  try {
    await assignTierTheme(tierId, themeId || null);
    rev();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
