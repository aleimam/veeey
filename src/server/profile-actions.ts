'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { checkPhoneValue } from '@/lib/phone';
import { audit } from '@/lib/audit';
import { PrismaClientKnownRequestError } from '@/generated/prisma/internal/prismaNamespace';

/**
 * Staff self-profile update (any logged-in staff may edit their OWN profile —
 * no extra permission). Email is not editable. Audited; revalidates the page.
 */
export type ProfileFormState = { ok?: boolean; error?: 'taken' | 'invalid' | 'phone' };

const str = (fd: FormData, k: string): string | undefined => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'invalid' };

  const name = str(formData, 'name');
  if (!name || name.length < 1 || name.length > 120) return { error: 'invalid' };

  const username = str(formData, 'username') ?? null;
  if (username !== null && (username.length < 3 || username.length > 30)) return { error: 'invalid' };

  const phone = str(formData, 'phone') ?? null;
  // Server-side re-check of what <PhoneInput> submitted (owner 2026-07-22 #226).
  if (phone !== null && (phone.length > 20 || checkPhoneValue(phone))) return { error: 'phone' };

  const password = str(formData, 'password');
  if (password !== undefined && password.length < 8) return { error: 'invalid' };

  const data: { name: string; username: string | null; phone: string | null; passwordHash?: string } = {
    name,
    username,
    phone,
  };
  if (password) data.passwordHash = await hashPassword(password);

  try {
    await prisma.user.update({ where: { id: user.id }, data });
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: 'taken' };
    }
    console.error('profile.update failed', e);
    return { error: 'invalid' };
  }

  // Contract v2: the customer edited their own name/phone (Veeey-mastered) —
  // push to YeldnIN (best-effort; no-op unless the v2 channel is armed).
  try {
    const cust = await prisma.customer.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (cust) await (await import('@/lib/integration/product-customer-sync')).emitCustomerUpsertV2(cust.id);
  } catch (e) {
    console.error('v2 customer emit failed', e);
  }

  await audit({
    actorType: 'USER',
    actorId: user.id,
    action: 'profile.update',
    entityType: 'User',
    entityId: user.id,
  });

  revalidatePath('/admin/profile');
  return { ok: true };
}
