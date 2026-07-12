'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { saveSettings } from '@/lib/settings-service';
import { logSystemError, clearErrorLogs } from '@/lib/error-log';
import { rateLimit, clientIp } from '@/lib/rate-limit';

/** Record a client-side runtime error (from the error boundary). Rate-limited. */
export async function logClientErrorAction(payload: { message: string; source?: string; stack?: string }): Promise<void> {
  if (!rateLimit(`clienterr:${await clientIp()}`, 30, 10 * 60_000)) return;
  await logSystemError({ level: 'ERROR', message: payload.message || 'client error', source: payload.source, stack: payload.stack });
}

/** Record a 404 (from not-found). Rate-limited so bots/scanners don't flood. */
export async function log404Action(path: string): Promise<void> {
  if (!rateLimit(`notfound:${await clientIp()}`, 60, 10 * 60_000)) return;
  await logSystemError({ level: 'NOT_FOUND', message: `404 ${path}`.slice(0, 300), source: path });
}

// ---- Admin ------------------------------------------------------------------
export async function toggleErrorLogAction(fd: FormData): Promise<void> {
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  const user = await requirePermission('settings.manage');
  const enabled = fd.get('enabled') != null;
  await saveSettings({ 'errorLog.enabled': enabled ? 'true' : 'false' });
  await audit({ actorType: 'USER', actorId: user.id, action: 'errorLog.toggle', entityType: 'Setting', entityId: 'errorLog.enabled', data: { enabled } });
  revalidatePath(`/${locale}/admin/error-log`);
  redirect(`/${locale}/admin/error-log?saved=1`);
}

export async function clearErrorLogAction(fd: FormData): Promise<void> {
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  const user = await requirePermission('settings.manage');
  const n = await clearErrorLogs();
  await audit({ actorType: 'USER', actorId: user.id, action: 'errorLog.clear', entityType: 'ErrorLog', entityId: `${n} rows` });
  revalidatePath(`/${locale}/admin/error-log`);
  redirect(`/${locale}/admin/error-log?cleared=${n}`);
}
