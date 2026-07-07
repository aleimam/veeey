import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { normalizeNav, type NavConfig } from '@/lib/nav-config';

/** Primary-navigation persistence (JSON Setting `nav.config`). Mirrors
 *  home-layout-service / theme-service — no dedicated table. */
const KEY = 'nav.config';

export async function getNavConfig(): Promise<NavConfig> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    if (row?.value) return normalizeNav(JSON.parse(row.value));
  } catch {
    // table missing / bad JSON → shipped defaults
  }
  return normalizeNav(null);
}

export async function saveNavConfig(cfg: NavConfig): Promise<void> {
  const user = await requirePermission('settings.manage');
  const value = JSON.stringify(normalizeNav(cfg));
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'nav.config.update', entityType: 'Setting', entityId: KEY });
}

export async function resetNavConfig(): Promise<void> {
  const user = await requirePermission('settings.manage');
  await prisma.setting.deleteMany({ where: { key: KEY } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'nav.config.reset', entityType: 'Setting', entityId: KEY });
}
