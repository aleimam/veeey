import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { invalidateSocialAuthCache, type SocialProviderId } from '@/lib/social-auth';

/**
 * Social-login (OAuth) credential WRITERS. Secrets (`clientSecret`, Apple `.p8`)
 * live in the DB and are write-only in the UI (blank = keep existing). Gated by
 * `settings.manage`, audited. Read-only resolvers live in social-auth.ts.
 */
const PERM = 'settings.manage';
const SECRET = new Set(['auth.google.clientSecret', 'auth.facebook.clientSecret', 'auth.apple.privateKey']);

async function saveKeys(keys: string[], values: Record<string, string>, action: string) {
  const user = await requirePermission(PERM);
  const ops = keys.map((key) => {
    const v = (values[key] ?? '').trim();
    if (SECRET.has(key)) {
      // blank secret → keep existing (no-op read); else upsert
      return v
        ? prisma.setting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } })
        : prisma.setting.findUnique({ where: { key } });
    }
    return v
      ? prisma.setting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } })
      : prisma.setting.deleteMany({ where: { key } });
  });
  await prisma.$transaction(ops);
  invalidateSocialAuthCache();
  await audit({ actorType: 'USER', actorId: user.id, action, entityType: 'Setting', entityId: `${action.replace('.update', '')}.*` });
}

export function saveGoogleAuth(values: Record<string, string>) {
  return saveKeys(['auth.google.enabled', 'auth.google.clientId', 'auth.google.clientSecret'], values, 'auth.google.update');
}
export function saveFacebookAuth(values: Record<string, string>) {
  return saveKeys(['auth.facebook.enabled', 'auth.facebook.clientId', 'auth.facebook.clientSecret'], values, 'auth.facebook.update');
}
export function saveAppleAuth(values: Record<string, string>) {
  return saveKeys(
    ['auth.apple.enabled', 'auth.apple.servicesId', 'auth.apple.teamId', 'auth.apple.keyId', 'auth.apple.privateKey'],
    values,
    'auth.apple.update',
  );
}

export async function clearSocialAuth(provider: SocialProviderId) {
  const user = await requirePermission(PERM);
  await prisma.setting.deleteMany({ where: { key: { startsWith: `auth.${provider}.` } } });
  invalidateSocialAuthCache();
  await audit({ actorType: 'USER', actorId: user.id, action: `auth.${provider}.clear`, entityType: 'Setting', entityId: `auth.${provider}.*` });
}
