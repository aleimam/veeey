import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

/**
 * Set/reset-password tokens (checkout backlog P2 — guest→account creation).
 * The raw token exists only inside the emailed link; the DB stores its sha256,
 * so a DB leak cannot mint working links. Single-use, 7-day expiry. The server
 * NEVER invents a password (owner rule) — the customer sets their own.
 */
const TOKEN_TTL_MS = 7 * 24 * 3_600_000;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** Issue a fresh token for a user; returns the RAW token for the email link. */
export async function issueSetPasswordToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return raw;
}

/** Is this raw token currently redeemable? (Page-load check — consume happens on submit.) */
export async function isTokenValid(raw: string): Promise<boolean> {
  if (!raw) return false;
  const t = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(raw) } });
  return !!t && !t.usedAt && t.expiresAt > new Date();
}

/**
 * Redeem the token: set the user's password and burn the token, atomically —
 * the predicated updateMany means a double-submit can't set twice, and a token
 * is spent even if the same link is opened in two tabs.
 */
export async function consumeSetPasswordToken(raw: string, newPassword: string): Promise<{ ok: boolean }> {
  const t = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!t || t.usedAt || t.expiresAt <= new Date()) return { ok: false };
  const passwordHash = await hashPassword(newPassword);
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: t.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return { ok: false };
  await prisma.user.update({ where: { id: t.userId }, data: { passwordHash } });
  return { ok: true };
}
