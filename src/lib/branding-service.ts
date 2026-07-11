import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { parseBranding, type Branding } from '@/lib/branding';

/** Branding persistence (Settings keys `branding.*`). Mirrors nav-service —
 *  no dedicated table. */
const PREFIX = 'branding.';

export async function getBranding(): Promise<Branding> {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { startsWith: PREFIX } } });
    return parseBranding(Object.fromEntries(rows.map((r) => [r.key.slice(PREFIX.length), r.value])));
  } catch {
    // table missing / DB hiccup → shipped defaults
    return parseBranding({});
  }
}

export async function saveBranding(values: Record<string, string | undefined>): Promise<void> {
  const user = await requirePermission('settings.manage');
  const clean = parseBranding(values);
  await prisma.$transaction(
    (Object.entries(clean) as [string, string][]).map(([k, value]) =>
      prisma.setting.upsert({ where: { key: PREFIX + k }, update: { value }, create: { key: PREFIX + k, value } }),
    ),
  );
  await audit({ actorType: 'USER', actorId: user.id, action: 'branding.update', entityType: 'Setting', entityId: 'branding' });
}
