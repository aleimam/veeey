'use server';

import { z } from 'zod';
import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { ensureCustomerProfile } from '@/lib/customer';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { requestOtp } from '@/lib/otp-service';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

export type AuthFormState = {
  error?: 'invalid' | 'exists' | 'recaptcha' | 'credentials';
  otp?: 'sent' | 'rate_limited' | 'sms_off' | 'error';
};

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');

const SOCIAL = new Set(['google', 'facebook', 'apple']);
/** Start an OAuth sign-in flow (Google / Facebook / Apple) — redirects to the provider. */
export async function socialSignInAction(fd: FormData): Promise<void> {
  const provider = String(fd.get('provider') ?? '');
  if (!SOCIAL.has(provider)) return;
  const locale = localeOf(fd);
  await signIn(provider, { redirectTo: `/${locale}` });
}

const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  username: z.string().trim().min(3).max(30).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
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
    username: formData.get('username'),
    phone: formData.get('phone'),
  });
  if (!parsed.success) return { error: 'invalid' };

  // Throttle regardless of reCAPTCHA (which fails OPEN when the secret is not
  // configured) — otherwise registration can be scripted without limit.
  if (!rateLimit(`register:${await clientIp()}`, 10, 3_600_000)) return { error: 'invalid' };

  const recaptchaOk = await verifyRecaptcha(
    (formData.get('recaptchaToken') as string) || undefined,
  );
  if (!recaptchaOk) return { error: 'recaptcha' };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: 'exists' };

  const passwordHash = await hashPassword(parsed.data.password);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        username: parsed.data.username || null,
        phone: parsed.data.phone || null,
      },
    });
  } catch {
    return { error: 'exists' }; // username/phone unique collision
  }
  await ensureCustomerProfile(user.id);

  // Referral attribution (FR-LOY): link to the referrer's customer if the code matches.
  const ref = ((formData.get('ref') as string) || '').trim();
  if (ref) {
    try {
      const referrer = await prisma.customer.findUnique({ where: { referralCode: ref } });
      const me = await prisma.customer.findUnique({ where: { userId: user.id } });
      if (referrer && me && referrer.id !== me.id) {
        await prisma.customer.update({ where: { id: me.id }, data: { referredById: referrer.id } });
      }
    } catch { /* referral attribution is best-effort */ }
  }

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
      identifier: parsed.data.email,
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
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

/** Validate a post-login return path (`?next=`): must be a site-relative path —
 *  never a protocol/host — so login can't become an open redirect. */
const safeNext = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const p = v.trim();
  return p.startsWith('/') && !p.startsWith('//') && !p.includes('://') ? p : null;
};

export async function loginCustomer(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = localeOf(formData);
  const parsed = loginSchema.safeParse({
    identifier: formData.get('identifier'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: 'invalid' };

  // Brute-force control independent of reCAPTCHA (which fails OPEN when the
  // secret is unset): per-account and per-IP fixed windows.
  const ident = parsed.data.identifier.toLowerCase();
  if (!rateLimit(`login:id:${ident}`, 10, 900_000) || !rateLimit(`login:ip:${await clientIp()}`, 30, 900_000)) {
    return { error: 'credentials' };
  }

  const recaptchaOk = await verifyRecaptcha(
    (formData.get('recaptchaToken') as string) || undefined,
  );
  if (!recaptchaOk) return { error: 'recaptcha' };

  try {
    await signIn('credentials', {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      redirectTo: safeNext(formData.get('next')) ?? `/${locale}`,
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: 'credentials' };
    throw error;
  }
  return {};
}

/** Step 1 of OTP login — send a code to the phone. */
export async function requestOtpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const phone = ((formData.get('phone') as string) || '').trim();
  const r = await requestOtp(phone);
  if (r.ok) return { otp: 'sent' };
  if (r.error === 'rate_limited') return { otp: 'rate_limited' };
  if (r.error === 'sms_not_configured') return { otp: 'sms_off' };
  return { otp: 'error' };
}

/** Step 2 of OTP login — verify the code and sign in. */
export async function loginWithOtp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeOf(formData);
  const phone = ((formData.get('phone') as string) || '').trim();
  const code = ((formData.get('code') as string) || '').trim();
  if (!phone || !code) return { error: 'invalid' };
  try {
    await signIn('otp', { phone, code, redirectTo: safeNext(formData.get('next')) ?? `/${locale}` });
  } catch (error) {
    if (error instanceof AuthError) return { error: 'credentials' };
    throw error;
  }
  return {};
}

export async function signOutAction(fd?: FormData): Promise<void> {
  // Respect the signer-out's language (was hardcoded '/en' — bounced AR users
  // to the English homepage).
  const locale = fd?.get('locale') === 'ar' ? 'ar' : 'en';
  await signOut({ redirectTo: `/${locale}` });
}
