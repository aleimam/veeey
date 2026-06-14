import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';

/** Human-friendly, collision-resistant referral code (FR-PRC-06). */
export function generateReferralCode(): string {
  return `VEEEY-${randomBytes(4).toString('hex').toUpperCase()}`;
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
      referralCode: generateReferralCode(),
      wishlistLists: { create: { name: 'My Wishlist', isDefault: true } },
    },
  });
}
