import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { THEME_TOKEN_KEYS, type ThemeOverrides } from '@/lib/theme';

/**
 * Theme override storage (FR-SF / Appearance). The admin "Appearance" editor
 * persists a sparse cssVar→value map here; the storefront injects it on
 * `.veeey-shop` (see ThemeStyle). Gated by `settings.manage`, audited.
 */
const KEY = 'theme.tokens';

/** Read the stored theme overrides (cssVar → value). Empty on missing/error. */
export async function getThemeOverrides(): Promise<ThemeOverrides> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    if (!row?.value) return {};
    const parsed: unknown = JSON.parse(row.value);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: ThemeOverrides = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (THEME_TOKEN_KEYS.has(k) && typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Persist the theme overrides (only known, non-empty tokens are kept). */
export async function saveThemeOverrides(overrides: ThemeOverrides): Promise<void> {
  const user = await requirePermission('settings.manage');
  const clean: ThemeOverrides = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (THEME_TOKEN_KEYS.has(k) && typeof v === 'string' && v.trim()) clean[k] = v.trim();
  }
  const value = JSON.stringify(clean);
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'theme.update', entityType: 'Setting', entityId: KEY });
}

/** Clear all overrides → revert the storefront to the design-system defaults. */
export async function resetTheme(): Promise<void> {
  const user = await requirePermission('settings.manage');
  await prisma.setting.upsert({ where: { key: KEY }, update: { value: '{}' }, create: { key: KEY, value: '{}' } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'theme.reset', entityType: 'Setting', entityId: KEY });
}
