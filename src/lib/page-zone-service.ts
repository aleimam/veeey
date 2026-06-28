import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { normalizeLayout, parseLayout, type Block } from '@/lib/home-layout';

/**
 * Block "zones" injected around the fixed commerce core of the category and
 * product pages — a Top zone (above) and Bottom zone (below) per page type.
 * The core grid / buy-box is never replaced. Gadget blocks only (no home
 * built-ins). Stored as JSON Settings (`zone.<key>`) — no migration.
 */

export const ZONE_KEYS = ['category.top', 'category.bottom', 'pdp.top', 'pdp.bottom'] as const;
export type ZoneKey = (typeof ZONE_KEYS)[number];
const isZoneKey = (k: string): k is ZoneKey => (ZONE_KEYS as readonly string[]).includes(k);

const settingKey = (z: ZoneKey) => `zone.${z}`;

export async function getZone(z: ZoneKey): Promise<Block[]> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: settingKey(z) } });
    if (row?.value) return normalizeLayout(JSON.parse(row.value) as Block[], { appendBuiltins: false });
  } catch {
    // missing table / bad JSON → empty zone
  }
  return [];
}

export async function getZones(keys: readonly ZoneKey[]): Promise<Record<string, Block[]>> {
  const out: Record<string, Block[]> = {};
  await Promise.all(keys.map(async (k) => { out[k] = await getZone(k); }));
  return out;
}

export async function saveZone(zoneKey: string, blocks: Block[]): Promise<void> {
  const user = await requirePermission('settings.manage');
  if (!isZoneKey(zoneKey)) throw new Error('BAD_ZONE');
  const clean = parseLayout(blocks, { appendBuiltins: false });
  const value = JSON.stringify(clean);
  await prisma.setting.upsert({ where: { key: settingKey(zoneKey) }, update: { value }, create: { key: settingKey(zoneKey), value } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'page-zone.update', entityType: 'Setting', entityId: settingKey(zoneKey) });
}
