import { cache } from 'react';
import { getAllSettings, getSetting } from '@/lib/settings-service';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { redirect } from '@/i18n/navigation';
import { FEATURES, FEATURE_IDS, featureSettingKey, isEnabledValue, featureEnabled, type FeatureId } from '@/lib/feature-flags';

/**
 * Server-side feature-flag access. Flags are stored as `feature.<id>` Settings
 * ('off' disables; anything else / unset = the registry default). Reads are
 * best-effort: if Settings are unreachable we fall back to defaults so the
 * storefront never hard-fails on a flag lookup.
 */

/** Is a single feature enabled? (best-effort; defaults to the registry value). */
export async function isFeatureEnabled(id: FeatureId): Promise<boolean> {
  const def = FEATURES.find((f) => f.id === id)?.default ?? true;
  try {
    const raw = await getSetting(featureSettingKey(id));
    return isEnabledValue(raw, def);
  } catch {
    return def;
  }
}

/** Per-request memoised single-flag check — safe to call from list items (e.g.
 *  product cards) without N database reads: React `cache` dedupes by argument. */
export const isFeatureEnabledCached = cache(isFeatureEnabled);

/** All feature states as a map, for the admin page + nav/footer/home gating. */
export async function getFeatureStates(): Promise<Record<FeatureId, boolean>> {
  let values: Record<string, string> = {};
  try {
    values = await getAllSettings();
  } catch {
    // fall through to defaults
  }
  const out = {} as Record<FeatureId, boolean>;
  for (const id of FEATURE_IDS) out[id] = featureEnabled(values, id);
  return out;
}

/** Set of enabled=false paths (locale-stripped) — handy for quick link filtering. */
export async function getDisabledPaths(): Promise<string[]> {
  const states = await getFeatureStates();
  return FEATURES.filter((f) => states[f.id] === false).flatMap((f) => f.paths);
}

/** Route guard for server pages: if the feature is OFF, redirect to the home page. */
export async function requireFeature(id: FeatureId, locale: string): Promise<void> {
  if (!(await isFeatureEnabled(id))) redirect({ href: '/', locale });
}

/** Admin write: persist the on/off state of every feature (settings.manage + audit).
 *  `next` is the fully-resolved map (every feature id → on/off) built by the action
 *  from the submitted checkboxes (an unchecked box = off). */
export async function saveFeatureStates(next: Record<FeatureId, boolean>): Promise<void> {
  const user = await requirePermission('settings.manage');
  await prisma.$transaction(
    FEATURES.map((f) => {
      const value = next[f.id] === false ? 'off' : 'on';
      return prisma.setting.upsert({
        where: { key: featureSettingKey(f.id) },
        create: { key: featureSettingKey(f.id), value },
        update: { value },
      });
    }),
  );
  await audit({ actorType: 'USER', actorId: user.id, action: 'features.update', entityType: 'Setting', entityId: 'features', data: Object.fromEntries(FEATURES.map((f) => [f.id, next[f.id] !== false])) });
}
