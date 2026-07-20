'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guards';
import {
  saveBackupConfig,
  saveTiers,
  testBackupConnection,
  runTierNow,
  MANUAL_TIER_KEY,
  type SaveBackupInput,
  type SaveTierInput,
} from '@/lib/backup/backup-service';

/** Every write here is RBAC-gated and audited inside the service (AGENTS.md). */

export async function saveBackupAction(
  input: SaveBackupInput,
  tiers?: SaveTierInput[],
): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePermission('settings.manage');
  try {
    await saveBackupConfig(input, user.id);
    if (tiers?.length) await saveTiers(tiers, user.id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save the backup settings.' };
  }
  revalidatePath('/admin/backup');
  return { ok: true };
}

export async function testBackupAction(): Promise<{ ok: boolean; message: string }> {
  const user = await requirePermission('settings.manage');
  const res = await testBackupConnection(user.id);
  revalidatePath('/admin/backup');
  return res;
}

/** "Back up now" → the MANUAL level, so an ad-hoc run lands in its own folder
 *  instead of consuming a scheduled level's retention slot. */
export async function runBackupNowAction(): Promise<{ ok: boolean; error?: string; fileName?: string }> {
  const user = await requirePermission('settings.manage');
  const r = await runTierNow(user.id, MANUAL_TIER_KEY);
  revalidatePath('/admin/backup');
  return { ok: r.ok, error: r.error, fileName: r.fileName };
}

/** Run one level on demand — proves a single folder/contents choice without
 *  waiting for its slot. */
export async function runTierNowAction(key: string): Promise<{ ok: boolean; error?: string; fileName?: string }> {
  const user = await requirePermission('settings.manage');
  const r = await runTierNow(user.id, key);
  revalidatePath('/admin/backup');
  return { ok: r.ok, error: r.error, fileName: r.fileName };
}
