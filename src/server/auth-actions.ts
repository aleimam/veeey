'use server';

import { z } from 'zod';
import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { ensureCustomerProfile } from '@/lib/customer';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { audit } from '@/lib/audit';

export type AuthFormState = { error?: 'invalid' | 'exists' | 'recaptcha' | 'credentials' };

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');

const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export async function registerCustomer(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = localeOf(formData);
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: 'invalid' };

  const recaptchaOk = await verifyRecaptcha(
    (formData.get('recaptchaToken') as string) || undefined,
  );
  if (!recaptchaOk) return { error: 'recaptcha' };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: 'exists' };

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: { email: parsed.data.email, name: parsed.data.name, passwordHash },
  });
  await ensureCustomerProfile(user.id);
  await audit({
    actorType: 'CUSTOMER',
    actorId: user.id,
    action: 'customer.register',
    entityType: 'User',
    entityId: user.id,
  });

  // Sign the new customer in (throws NEXT_REDIRECT on success).
  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: `/${locale}`,
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: 'credentials' };
    throw error; // re-throw the redirect
  }
  return {};
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginCustomer(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = localeOf(formData);
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: 'invalid' };

  const recaptchaOk = await verifyRecaptcha(
    (formData.get('recaptchaToken') as string) || undefined,
  );
  if (!recaptchaOk) return { error: 'recaptcha' };

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: `/${locale}`,
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: 'credentials' };
    throw error;
  }
  return {};
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/en' });
}
