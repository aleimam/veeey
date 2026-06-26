import { prisma } from '@/lib/prisma';
import { SignJWT, importPKCS8 } from 'jose';

/**
 * Social-login (OAuth) config resolvers. Credentials are admin-entered and stored
 * in DB Setting `auth.<provider>.*` keys (env vars as fallback) — the same
 * DB-secret pattern as the messaging/payment providers (provider-config.ts).
 * Read-only + free of auth/server-only imports so `auth.ts` can import it.
 * Writers live in social-auth-service.ts.
 */

export type SocialProviderId = 'google' | 'facebook' | 'apple';
type OAuthCfg = { clientId: string; clientSecret: string };
type AppleCfg = { servicesId: string; teamId: string; keyId: string; privateKey: string };
export type SocialAuthConfig = { google?: OAuthCfg; facebook?: OAuthCfg; apple?: AppleCfg };

async function rawMap(): Promise<Record<string, string>> {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { startsWith: 'auth.' } } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

let cfgCache: { at: number; cfg: SocialAuthConfig } | null = null;
let appleCache: { at: number; key: string; secret: string } | null = null;
const TTL = 60_000;

/** Drop the in-process cache after an admin save so changes apply immediately. */
export function invalidateSocialAuthCache() {
  cfgCache = null;
  appleCache = null;
}

export async function getSocialAuthConfig(): Promise<SocialAuthConfig> {
  const now = Date.now();
  if (cfgCache && now - cfgCache.at < TTL) return cfgCache.cfg;
  const m = await rawMap();
  const cfg: SocialAuthConfig = {};

  const gId = m['auth.google.clientId'] || process.env.AUTH_GOOGLE_ID || '';
  const gSec = m['auth.google.clientSecret'] || process.env.AUTH_GOOGLE_SECRET || '';
  if (m['auth.google.enabled'] !== 'false' && gId && gSec) cfg.google = { clientId: gId, clientSecret: gSec };

  const fId = m['auth.facebook.clientId'] || process.env.AUTH_FACEBOOK_ID || '';
  const fSec = m['auth.facebook.clientSecret'] || process.env.AUTH_FACEBOOK_SECRET || '';
  if (m['auth.facebook.enabled'] !== 'false' && fId && fSec) cfg.facebook = { clientId: fId, clientSecret: fSec };

  const aSvc = m['auth.apple.servicesId'] || process.env.AUTH_APPLE_ID || '';
  const aTeam = m['auth.apple.teamId'] || process.env.AUTH_APPLE_TEAM_ID || '';
  const aKey = m['auth.apple.keyId'] || process.env.AUTH_APPLE_KEY_ID || '';
  const aPk = m['auth.apple.privateKey'] || process.env.AUTH_APPLE_PRIVATE_KEY || '';
  if (m['auth.apple.enabled'] !== 'false' && aSvc && aTeam && aKey && aPk) cfg.apple = { servicesId: aSvc, teamId: aTeam, keyId: aKey, privateKey: aPk };

  cfgCache = { at: now, cfg };
  return cfg;
}

export async function getEnabledSocialProviders(): Promise<SocialProviderId[]> {
  const c = await getSocialAuthConfig();
  const out: SocialProviderId[] = [];
  if (c.google) out.push('google');
  if (c.facebook) out.push('facebook');
  if (c.apple) out.push('apple');
  return out;
}

/**
 * Apple Sign In has no static client secret — it's an ES256 JWT signed with the
 * `.p8` private key. We generate it on demand (cached ~30 min) so there's no
 * manual 6-month rotation. Returns '' if the key can't be parsed.
 */
export async function appleClientSecret(a: AppleCfg): Promise<string> {
  const now = Date.now();
  const ck = `${a.teamId}:${a.keyId}:${a.servicesId}`;
  if (appleCache && appleCache.key === ck && now - appleCache.at < 30 * 60_000) return appleCache.secret;
  try {
    const key = await importPKCS8(a.privateKey.replace(/\\n/g, '\n'), 'ES256');
    const nowSec = Math.floor(now / 1000);
    const secret = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: a.keyId })
      .setIssuer(a.teamId)
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + 60 * 60 * 24 * 150) // 150 days (< Apple's 6-month max)
      .setAudience('https://appleid.apple.com')
      .setSubject(a.servicesId)
      .sign(key);
    appleCache = { at: now, key: ck, secret };
    return secret;
  } catch {
    return '';
  }
}

/** Admin form values — secrets surfaced only as "is set" booleans. */
export async function getSocialAuthFormValues() {
  const m = await rawMap();
  return {
    google: { enabled: m['auth.google.enabled'] !== 'false', clientId: m['auth.google.clientId'] ?? '', hasSecret: !!m['auth.google.clientSecret'] },
    facebook: { enabled: m['auth.facebook.enabled'] !== 'false', clientId: m['auth.facebook.clientId'] ?? '', hasSecret: !!m['auth.facebook.clientSecret'] },
    apple: {
      enabled: m['auth.apple.enabled'] !== 'false',
      servicesId: m['auth.apple.servicesId'] ?? '',
      teamId: m['auth.apple.teamId'] ?? '',
      keyId: m['auth.apple.keyId'] ?? '',
      hasKey: !!m['auth.apple.privateKey'],
    },
  };
}
