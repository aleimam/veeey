import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { GOOGLE_KEYS as KEYS, sanitizeGoogleConfig, type GoogleConfig } from '@/lib/google-config';

/**
 * Google services for website managers (admin-configured, not env vars):
 * GA4, Google Tag Manager, and Search Console verification. Stored as Settings
 * so a manager can paste IDs without a deploy; the root layout injects the tags.
 */
export type { GoogleConfig } from '@/lib/google-config';

export async function getGoogleConfig(): Promise<GoogleConfig> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    ga4Id: map.get(KEYS.ga4Id) ?? '',
    gtmId: map.get(KEYS.gtmId) ?? '',
    searchConsole: map.get(KEYS.searchConsole) ?? '',
    adsId: map.get(KEYS.adsId) ?? '',
  };
}

export async function saveGoogleConfig(raw: Partial<GoogleConfig>): Promise<void> {
  const user = await requirePermission('settings.manage');
  const cfg = sanitizeGoogleConfig(raw);
  await Promise.all(
    (Object.keys(KEYS) as (keyof GoogleConfig)[]).map((k) =>
      prisma.setting.upsert({ where: { key: KEYS[k] }, update: { value: cfg[k] }, create: { key: KEYS[k], value: cfg[k] } }),
    ),
  );
  await audit({ actorType: 'USER', actorId: user.id, action: 'google.config.update', entityType: 'Setting', entityId: 'google.*', data: { ga4: !!cfg.ga4Id, gtm: !!cfg.gtmId, searchConsole: !!cfg.searchConsole, ads: !!cfg.adsId } });
}
