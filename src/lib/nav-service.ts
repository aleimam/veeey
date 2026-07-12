import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { normalizeNav, type NavConfig } from '@/lib/nav-config';
import { isHrefDisabled } from '@/lib/feature-flags';
import { getFeatureStates } from '@/lib/feature-service';

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

/** Drop any nav entry (top item, mega link, or promo) that points at a
 *  switched-off feature, so disabled features vanish from the header/menus. */
export async function getVisibleNavConfig(): Promise<NavConfig> {
  const [nav, states] = await Promise.all([getNavConfig(), getFeatureStates()]);
  const off = (href: string) => isHrefDisabled(href, states);
  const items = nav.items
    .filter((it) => !off(it.href))
    .map((it) => {
      if (!it.mega) return it;
      const columns = it.mega.columns
        .map((c) => ({ ...c, links: c.links.filter((l) => !off(l.href)) }))
        .filter((c) => c.links.length > 0 || c.headingEn || c.headingAr);
      const promo = it.mega.promo && off(it.mega.promo.href) ? null : it.mega.promo;
      return { ...it, mega: { columns, promo } };
    });
  const promo = nav.promo.href && off(nav.promo.href) ? { ...nav.promo, enabled: false } : nav.promo;
  return { ...nav, items, promo };
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
