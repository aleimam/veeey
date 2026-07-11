'use server';

import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { requestVerifyCode, verifyCode, normalizeDestination } from '@/lib/otp-service';
import { VERIFY_COOKIE, makeVerifyCookieValue } from '@/lib/verify-cookie';

/** Checkout contact verification (V5 F30) — request + confirm a one-time code
 *  for a phone (SMS) or email. Guests get a signed cookie; signed-in shoppers
 *  additionally get the verification persisted on their account. */
export type VerifyState = { sent?: boolean; verified?: boolean; error?: string };

export async function requestVerifyCodeAction(_p: VerifyState, fd: FormData): Promise<VerifyState> {
  const dest = String(fd.get('dest') ?? '');
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  const r = await requestVerifyCode(dest, locale);
  if (!r.ok) return { error: r.error };
  return { sent: true };
}

export async function confirmVerifyCodeAction(_p: VerifyState, fd: FormData): Promise<VerifyState> {
  const dest = String(fd.get('dest') ?? '');
  const code = String(fd.get('code') ?? '').trim();
  const ok = await verifyCode(dest, code);
  if (!ok) return { sent: true, error: 'bad_code' };

  const norm = normalizeDestination(dest);
  if (norm) {
    const jar = await cookies();
    jar.set(VERIFY_COOKIE, makeVerifyCookieValue(norm.dest), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 24 * 3600 });

    const session = await auth();
    const userId = session?.user?.id;
    if (userId) {
      if (norm.channel === 'sms') {
        await prisma.user.update({ where: { id: userId }, data: { phone: norm.dest, phoneVerified: new Date() } });
      } else {
        // Only mark the account email verified when it's the account's own email.
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (u?.email && u.email.toLowerCase() === norm.dest) {
          await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
        }
      }
    }
  }
  return { verified: true };
}
