import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { normalizeMobile } from '@/lib/provider-config';

/**
 * Identifier → user resolution, shared by the Auth.js credentials provider and
 * the login server action. The action needs it *before* `signIn` so it can tell
 * the customer precisely what is wrong (owner 2026-07-22 #226) instead of the
 * single opaque `AuthError` the provider can raise.
 */

/** Resolve a user by any of email / username / phone. */
export function findByIdentifier(identifier: string) {
  const phone = normalizeMobile(identifier);
  return prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: 'insensitive' } },
        { username: { equals: identifier, mode: 'insensitive' } },
        { phone },
        { phone: identifier },
      ],
    },
  });
}

/**
 * A real bcrypt hash of a value nobody can supply. Comparing against it when
 * the identifier is unknown keeps the "no such account" reply roughly as slow
 * as the "wrong password" one, so the precise messages we now return don't get
 * a timing side-channel on top of them.
 */
const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/** Burn the same CPU a real password check would. Always resolves `false`. */
export async function dummyPasswordCheck(password: string): Promise<void> {
  try {
    await verifyPassword(password || 'x', DUMMY_HASH);
  } catch {
    /* never let the decoy affect the outcome */
  }
}
