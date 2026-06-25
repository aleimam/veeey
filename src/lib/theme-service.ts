import { prisma } from '@/lib/prisma';
import { requirePermission, getCurrentUser } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { THEME_TOKEN_KEYS, type ThemeOverrides } from '@/lib/theme';

/**
 * Multi-theme storage (FR-SF / Appearance). Each `Theme` is a named, sparse
 * cssVar→value override map. Exactly one theme is `isActive` (the global default
 * for guests / untiered viewers); tiers may point to their own theme. The
 * storefront injects the resolved theme on `.veeey-shop` (see ThemeStyle); the
 * admin panel is never themed. Writes are `settings.manage`-gated and audited.
 */

export type ThemeRecord = {
  id: string;
  name: string;
  tokens: ThemeOverrides;
  isActive: boolean;
  isDefault: boolean;
};

const LEGACY_KEY = 'theme.tokens';

/** Keep only known token keys with non-empty string values. */
function sanitizeTokens(raw: unknown): ThemeOverrides {
  const out: ThemeOverrides = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (THEME_TOKEN_KEYS.has(k) && typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}

function toRecord(t: { id: string; name: string; tokens: unknown; isActive: boolean; isDefault: boolean }): ThemeRecord {
  return { id: t.id, name: t.name, tokens: sanitizeTokens(t.tokens), isActive: t.isActive, isDefault: t.isDefault };
}

const cleanName = (name: string) => name.trim().slice(0, 60) || 'Untitled theme';

/** Read the legacy single-theme overrides (pre-multi-theme) from Settings. */
async function legacyOverrides(): Promise<ThemeOverrides> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: LEGACY_KEY } });
    if (!row?.value) return {};
    return sanitizeTokens(JSON.parse(row.value));
  } catch {
    return {};
  }
}

/**
 * Ensure at least one theme exists. On first run (admin side) seeds a built-in
 * "Veeey" default from the legacy Settings overrides so existing customizations
 * carry over. Idempotent; only writes when the table is empty.
 */
export async function ensureBootstrapped(): Promise<void> {
  const count = await prisma.theme.count();
  if (count > 0) return;
  const tokens = await legacyOverrides();
  await prisma.theme.create({
    data: { name: 'Veeey (default)', tokens, isActive: true, isDefault: true },
  });
}

/** All themes (default first, then newest). Bootstraps if empty. */
export async function listThemes(): Promise<ThemeRecord[]> {
  await ensureBootstrapped();
  const rows = await prisma.theme.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
  return rows.map(toRecord);
}

export async function getTheme(id: string): Promise<ThemeRecord | null> {
  const row = await prisma.theme.findUnique({ where: { id } });
  return row ? toRecord(row) : null;
}

/** The globally-active theme (guests / untiered viewers). */
export async function getActiveTheme(): Promise<ThemeRecord | null> {
  const row =
    (await prisma.theme.findFirst({ where: { isActive: true } })) ??
    (await prisma.theme.findFirst({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }));
  return row ? toRecord(row) : null;
}

/**
 * Resolve the effective overrides for the current viewer: a logged-in customer's
 * tier theme if assigned, else the global active theme. Falls back to the legacy
 * Settings overrides before bootstrap. Public read — never throws.
 */
export async function resolveOverridesForViewer(): Promise<ThemeOverrides> {
  try {
    if ((await prisma.theme.count()) === 0) return await legacyOverrides();
    const user = await getCurrentUser();
    if (user?.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: user.customerId },
        select: { tier: { select: { themeId: true } } },
      });
      const tierThemeId = customer?.tier?.themeId;
      if (tierThemeId) {
        const t = await prisma.theme.findUnique({ where: { id: tierThemeId } });
        if (t) return sanitizeTokens(t.tokens);
      }
    }
    const active = await getActiveTheme();
    return active?.tokens ?? {};
  } catch {
    return {};
  }
}

// ── Mutations (settings.manage, audited) ──────────────────────────────────

export async function createTheme(name: string, tokens: ThemeOverrides = {}): Promise<ThemeRecord> {
  const user = await requirePermission('settings.manage');
  const row = await prisma.theme.create({ data: { name: cleanName(name), tokens: sanitizeTokens(tokens) } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'theme.create', entityType: 'Theme', entityId: row.id });
  return toRecord(row);
}

export async function duplicateTheme(id: string): Promise<ThemeRecord> {
  const user = await requirePermission('settings.manage');
  const src = await prisma.theme.findUnique({ where: { id } });
  if (!src) throw new Error('NOT_FOUND');
  const row = await prisma.theme.create({ data: { name: cleanName(`${src.name} copy`), tokens: sanitizeTokens(src.tokens) } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'theme.duplicate', entityType: 'Theme', entityId: row.id });
  return toRecord(row);
}

export async function renameTheme(id: string, name: string): Promise<void> {
  const user = await requirePermission('settings.manage');
  await prisma.theme.update({ where: { id }, data: { name: cleanName(name) } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'theme.rename', entityType: 'Theme', entityId: id });
}

export async function updateThemeTokens(id: string, tokens: ThemeOverrides): Promise<void> {
  const user = await requirePermission('settings.manage');
  await prisma.theme.update({ where: { id }, data: { tokens: sanitizeTokens(tokens) } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'theme.update', entityType: 'Theme', entityId: id });
}

export async function deleteTheme(id: string): Promise<void> {
  const user = await requirePermission('settings.manage');
  const t = await prisma.theme.findUnique({ where: { id } });
  if (!t) return;
  if (t.isDefault) throw new Error('CANNOT_DELETE_DEFAULT');
  if (t.isActive) throw new Error('CANNOT_DELETE_ACTIVE');
  // Tier.themeId FK is ON DELETE SET NULL, so referencing tiers fall back to active.
  await prisma.theme.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'theme.delete', entityType: 'Theme', entityId: id });
}

export async function setActiveTheme(id: string): Promise<void> {
  const user = await requirePermission('settings.manage');
  await prisma.$transaction([
    prisma.theme.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    prisma.theme.update({ where: { id }, data: { isActive: true } }),
  ]);
  await audit({ actorType: 'USER', actorId: user.id, action: 'theme.setActive', entityType: 'Theme', entityId: id });
}

/** Assign a theme to a tier (or null to fall back to the active theme). */
export async function assignTierTheme(tierId: string, themeId: string | null): Promise<void> {
  const user = await requirePermission('settings.manage');
  await prisma.tier.update({ where: { id: tierId }, data: { themeId } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'theme.assignTier', entityType: 'Tier', entityId: tierId });
}
