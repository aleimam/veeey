'use server';

import { redirect } from 'next/navigation';
import { consumeSetPasswordToken } from '@/lib/password-token-service';
import { audit } from '@/lib/audit';

/**
 * Redeem a set-password link (checkout backlog P2-6, also the future
 * forgot-password flow). Public by design — the emailed token IS the
 * credential; it is hashed at rest, single-use and expiring. The server never
 * chooses a password (owner rule).
 */
export async function setPasswordAction(fd: FormData): Promise<void> {
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  const token = typeof fd.get('token') === 'string' ? (fd.get('token') as string).trim() : '';
  const password = typeof fd.get('password') === 'string' ? (fd.get('password') as string) : '';
  const confirm = typeof fd.get('confirm') === 'string' ? (fd.get('confirm') as string) : '';

  const back = (err: string) => redirect(`/${locale}/set-password?token=${encodeURIComponent(token)}&error=${err}`);
  if (!token) redirect(`/${locale}/login`);
  if (password.length < 8) back('short');
  if (password !== confirm) back('mismatch');

  const res = await consumeSetPasswordToken(token, password);
  if (!res.ok) back('invalid');

  await audit({ actorType: 'SYSTEM', action: 'customer.password_set', entityType: 'User', entityId: token.slice(0, 8), data: {} });
  redirect(`/${locale}/login?set=1`);
}
