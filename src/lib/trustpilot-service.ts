import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { normalizeTrustpilot, type TrustpilotConfig } from '@/lib/trustpilot-config';

/** Trustpilot config persistence (JSON Setting `trustpilot.config`). Mirrors
 *  nav-service / theme-service — no dedicated table. */
const KEY = 'trustpilot.config';

export async function getTrustpilotConfig(): Promise<TrustpilotConfig> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    if (row?.value) return normalizeTrustpilot(JSON.parse(row.value));
  } catch {
    // missing / bad JSON → defaults (inert: no businessUnitId)
  }
  return normalizeTrustpilot(null);
}

export async function saveTrustpilotConfig(cfg: TrustpilotConfig): Promise<void> {
  const user = await requirePermission('settings.manage');
  const value = JSON.stringify(normalizeTrustpilot(cfg));
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'trustpilot.config.update', entityType: 'Setting', entityId: KEY });
}
