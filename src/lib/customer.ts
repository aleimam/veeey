import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';

// Read a Setting directly (no settings-service import → avoids the auth chain /
// an import cycle with @/auth via this module).
async function rawSetting(key: string, fallback: string): Promise<string> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Human-friendly, collision-resistant referral code (FR-PRC-06). The prefix and
 * random length are admin-configurable (Settings → Referrals: referral.codePrefix
 * / referral.codeLength). Retries on the rare collision.
 */
export async function generateReferralCode(): Promise<string> {
  const prefix = await rawSetting('referral.codePrefix', 'VEEEY-');
  const len = Math.max(4, Math.min(16, Math.round(Number(await rawSetting('referral.codeLength', '8')) || 8)));
  for (let i = 0; i < 8; i++) {
    const rand = randomBytes(16).toString('hex').toUpperCase().slice(0, len);
    const code = `${prefix}${rand}`;
    if (!(await prisma.customer.findUnique({ where: { referralCode: code } }))) return code;
  }
  return `${prefix}${randomBytes(8).toString('hex').toUpperCase()}`;
}

/**
 * Ensure a User has a storefront Customer profile (FR-ACC-*). Called on OAuth
 * first sign-in (auth events.createUser) and from the credentials register
 * action. New customers default to the entry tier (Green) with a default
 * wishlist. Idempotent.
 */
export async function ensureCustomerProfile(userId: string) {
  const existing = await prisma.customer.findUnique({ where: { userId } });
  if (existing) return existing;

  const greenTier = await prisma.tier.findUnique({ where: { key: 'GREEN' } });

  return prisma.customer.create({
    data: {
      userId,
      tierId: greenTier?.id ?? null,
      referralCode: await generateReferralCode(),
      wishlistLists: { create: { name: 'My Wishlist', isDefault: true } },
    },
  });
}
