'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { INTEGRATION_TOGGLE_KEY } from '@/lib/integration/config';

/**
 * Flip the YeldnIN link on/off from the admin backend (Requests epic D). The
 * secret still lives in env; this DB toggle is the live switch (integrationEnabled
 * needs BOTH). RBAC-gated + audited.
 *
 * NB: writes the Setting row directly rather than via `saveSettings`, because that
 * helper whitelists only keys in the `SETTINGS` business-constant registry —
 * `integration.enabled` is a control flag, not a registry key, so it would be
 * silently dropped (the reason this toggle previously never persisted).
 */
export async function setIntegrationEnabledAction(fd: FormData): Promise<void> {
  const user = await requirePermission('settings.manage');
  const on = fd.get('enabled') === 'on' || fd.get('enabled') === 'true';
  const value = on ? 'true' : 'false';
  await prisma.setting.upsert({ where: { key: INTEGRATION_TOGGLE_KEY }, update: { value }, create: { key: INTEGRATION_TOGGLE_KEY, value } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'integration.toggle', entityType: 'Setting', entityId: INTEGRATION_TOGGLE_KEY, data: { enabled: on } });
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  revalidatePath(`/${locale}/admin/integration`);
  redirect(`/${locale}/admin/integration?toggled=1`);
}
