'use server';

import { z } from 'zod';
import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { ensureCustomerProfile } from '@/lib/customer';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { requestVerifyCode, normalizeDestination } from '@/lib/otp-service';
import { rateLimit, rateLimitStatus, clientIp } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';
import { findByIdentifier, dummyPasswordCheck } from '@/lib/user-lookup';
import { checkPhoneValue } from '@/lib/phone';
import {
  classifyPasswordLogin,
  classifyOtpRequest,
  retryMinutes,
  type OtpServiceError,
} from '@/lib/auth-errors';
import { PrismaClientKnownRequestError } from '@/generated/prisma/internal/prismaNamespace';

/**
 * Every precise error the auth forms can show. Each one maps 1:1 to an
 * `auth.errors.<code>` key in `messages/{en,ar}.json` (owner 2026-07-22 #226 —
 * "say exactly what is wrong", not one generic "Invalid credentials").
 * See `@/lib/auth-errors` for the enumeration tradeoff this deliberately takes.
 */
export type AuthErrorCode =
  // shared / legacy
  | 'invalid'
  | 'exists'
  | 'recaptcha'
  | 'credentials'
  // sign-in (password)
  | 'identifier_required'
  | 'password_required'
  | 'unknown_identifier'
  | 'no_password'
  | 'wrong_password'
  | 'too_many_attempts'
  // sign-in (code)
  | 'code_required'
  | 'bad_code'
  // registration
  | 'email_taken'
  | 'username_taken'
  | 'phone_taken'
  | 'invalid_email'
  | 'invalid_name'
  | 'invalid_username'
  | 'invalid_phone'
  | 'short_password';

/** Outcome of "send me a code" — `sent` plus every precise failure. */
export type OtpStatusCode = 'sent' | 'bad_destination' | 'too_many_attempts' | 'sms_off' | 'email_off' | 'send_failed';

export type AuthFormState = {
  error?: AuthErrorCode;
  otp?: OtpStatusCode;
  /** Filled for `too_many_attempts` — "try again in N minutes". */
  minutes?: number;
  /** Which channel the code went to, so the UI says SMS vs inbox. */
  channel?: 'sms' | 'email';
  /** Destination the code was sent to — the form compares it with what is
   *  currently typed, so editing the number (or switching channel) after
   *  sending hides the stale code box instead of verifying the wrong thing. */
  dest?: string;
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

/** Which unique column a P2002 collision hit → a precise "already taken" code. */
function takenCode(e: unknown): AuthErrorCode {
  if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
    const target = e.meta?.target;
    const fields = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
    if (fields.some((f) => f.includes('username'))) return 'username_taken';
    if (fields.some((f) => f.includes('phone'))) return 'phone_taken';
  }
  return 'email_taken';
}

export async function registerCustomer(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = localeOf(formData);
  const raw = {
    name: String(formData.get('name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    username: String(formData.get('username') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
  };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    // Name the offending field rather than "check your details".
    if (!raw.name) return { error: 'invalid_name' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email)) return { error: 'invalid_email' };
    if (raw.password.length < 8) return { error: 'short_password' };
    if (raw.username && (raw.username.length < 3 || raw.username.length > 30)) return { error: 'invalid_username' };
    return { error: 'invalid' };
  }
  // Server-side re-validation of the phone the PhoneInput submitted.
  if (parsed.data.phone && checkPhoneValue(parsed.data.phone)) return { error: 'invalid_phone' };

  // Throttle regardless of reCAPTCHA (which fails OPEN when the secret is not
  // configured) — otherwise registration can be scripted without limit.
  const limit = rateLimitStatus(`register:${await clientIp()}`, 10, 3_600_000);
  if (!limit.ok) return { error: 'too_many_attempts', minutes: retryMinutes(limit.retryAfterMs) };

  const recaptchaOk = await verifyRecaptcha(
    (formData.get('recaptchaToken') as string) || undefined,
  );
  if (!recaptchaOk) return { error: 'recaptcha' };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: 'email_taken' };

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
  } catch (e) {
    return { error: takenCode(e) };
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
  const identifier = String(formData.get('identifier') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  // Brute-force control independent of reCAPTCHA (which fails OPEN when the
  // secret is unset). Tightened for #226 (was 10 / 30) because the reply now
  // distinguishes "no such account" from "wrong password": per-identifier and
  // per-IP fixed windows, both reported with a wait time.
  const ident = identifier.toLowerCase();
  const byId = identifier ? rateLimitStatus(`login:id:${ident}`, 8, 900_000) : { ok: true, retryAfterMs: 0 };
  const byIp = rateLimitStatus(`login:ip:${await clientIp()}`, 20, 900_000);
  const rateLimited = !byId.ok || !byIp.ok;

  const recaptchaOk = identifier && password && !rateLimited
    ? await verifyRecaptcha((formData.get('recaptchaToken') as string) || undefined)
    : true;

  // Look the account up BEFORE signIn: the Auth.js credentials provider can only
  // raise one opaque AuthError, which is exactly the uselessly-vague message the
  // owner complained about.
  let userFound: boolean | undefined;
  let hasPassword: boolean | undefined;
  if (identifier && password && !rateLimited && recaptchaOk) {
    const user = await findByIdentifier(identifier);
    userFound = user != null;
    hasPassword = user?.passwordHash != null;
    // Constant-ish timing: burn a bcrypt round even when there is no account.
    if (!user?.passwordHash) await dummyPasswordCheck(password);
  }

  const failure = classifyPasswordLogin({ identifier, password, rateLimited, recaptchaOk, userFound, hasPassword });
  if (failure) {
    return failure === 'too_many_attempts'
      ? { error: 'too_many_attempts', minutes: retryMinutes(Math.max(byId.retryAfterMs, byIp.retryAfterMs)) }
      : { error: failure };
  }

  try {
    await signIn('credentials', {
      identifier,
      password,
      redirectTo: safeNext(formData.get('next')) ?? `/${locale}`,
    });
  } catch (error) {
    // The account exists and has a password, so the only thing left is a bad one.
    if (error instanceof AuthError) return { error: 'wrong_password' };
    throw error;
  }
  return {};
}

/** Step 1 of code sign-in — send a 6-digit code to an email address OR a phone. */
export async function requestOtpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeOf(formData);
  // `dest` is the new field name; `phone` is kept for any cached client bundle.
  const dest = String(formData.get('dest') ?? formData.get('phone') ?? '').trim();
  if (!dest) return { otp: 'bad_destination' };

  const norm = normalizeDestination(dest);
  if (!norm) return { otp: 'bad_destination' };

  // Per-IP throttle on top of otp-service's per-destination window, so one
  // machine cannot walk a list of addresses.
  const byIp = rateLimitStatus(`otp:ip:${await clientIp()}`, 15, 900_000);
  if (!byIp.ok) return { otp: 'too_many_attempts', minutes: retryMinutes(byIp.retryAfterMs) };

  const r = await requestVerifyCode(dest, locale);
  if (r.ok) return { otp: 'sent', channel: norm.channel, dest };
  const failure = classifyOtpRequest(r.error as OtpServiceError);
  // The per-destination window in otp-service is 10 minutes.
  return failure === 'too_many_attempts'
    ? { otp: 'too_many_attempts', minutes: 10, channel: norm.channel, dest }
    : { otp: failure, channel: norm.channel, dest };
}

/** Step 2 of code sign-in — verify the code and sign in. */
export async function loginWithOtp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeOf(formData);
  const dest = String(formData.get('dest') ?? formData.get('phone') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  if (!dest) return { error: 'invalid' };
  if (!code) return { error: 'code_required' };

  // Codes are single-use with a 5-attempt cap in otp-service; this stops a
  // distributed guess of the 10^6 space from a single machine.
  if (!rateLimit(`otp:verify:${await clientIp()}`, 20, 900_000)) {
    return { error: 'too_many_attempts', minutes: 15 };
  }

  try {
    await signIn('otp', { dest, code, redirectTo: safeNext(formData.get('next')) ?? `/${locale}` });
  } catch (error) {
    if (error instanceof AuthError) return { error: 'bad_code' };
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
