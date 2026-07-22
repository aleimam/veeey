import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/password';
import { normalizeMobile, smsConfigured, emailConfigured } from '@/lib/provider-config';
import { dispatchSms, dispatchEmail } from '@/lib/notification-dispatch';

/**
 * One-time codes. Two uses share the OtpCode table, both through
 * `requestVerifyCode` / `verifyCode`, and the destination may be a phone (SMS)
 * or an email address:
 * - Code sign-in (FR-ACC-01b) — by phone OR email since owner 2026-07-22 #226.
 * - Checkout verification (V5 F30).
 * Codes are 6 digits, hashed at rest, valid for `OTP_TTL_MIN`, rate-limited
 * per destination. (The `phone` column holds the normalized destination.)
 */
const OTP_TTL_MIN = 5;
const MAX_PER_WINDOW = 5; // codes requested per destination per 10 minutes
const MAX_ATTEMPTS = 5;

export type OtpResult =
  | { ok: true }
  | { ok: false; error: 'rate_limited' | 'sms_not_configured' | 'sms_failed' | 'no_phone' | 'email_not_configured' | 'email_failed' | 'invalid_destination' };

/** Normalize a destination: emails lowercase, phones to SMSMisr 2011… form. */
export function normalizeDestination(raw: string): { dest: string; channel: 'email' | 'sms' } | null {
  const v = (raw || '').trim();
  if (!v) return null;
  if (v.includes('@')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? { dest: v.toLowerCase(), channel: 'email' } : null;
  }
  const phone = normalizeMobile(v);
  return phone.length >= 10 ? { dest: phone, channel: 'sms' } : null;
}

async function issueCode(dest: string): Promise<{ code: string } | { error: 'rate_limited' }> {
  const since = new Date(Date.now() - 10 * 60_000);
  const recent = await prisma.otpCode.count({ where: { phone: dest, createdAt: { gte: since } } });
  if (recent >= MAX_PER_WINDOW) return { error: 'rate_limited' };
  const code = String(randomInt(100_000, 1_000_000));
  const codeHash = await hashPassword(code);
  await prisma.otpCode.create({ data: { phone: dest, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) } });
  return { code };
}

/** Send a verification code to a phone (SMS) or email (V5 F30). */
export async function requestVerifyCode(rawDest: string, locale = 'en'): Promise<OtpResult> {
  const norm = normalizeDestination(rawDest);
  if (!norm) return { ok: false, error: 'invalid_destination' };

  if (norm.channel === 'sms' && !(await smsConfigured())) return { ok: false, error: 'sms_not_configured' };
  if (norm.channel === 'email' && !(await emailConfigured())) return { ok: false, error: 'email_not_configured' };

  const issued = await issueCode(norm.dest);
  if ('error' in issued) return { ok: false, error: 'rate_limited' };

  if (norm.channel === 'sms') {
    const msg = locale === 'ar'
      ? `كود التحقق من Veeey: ${issued.code} (صالح ${OTP_TTL_MIN} دقائق).`
      : `Veeey verification code: ${issued.code} (valid ${OTP_TTL_MIN} min).`;
    const r = await dispatchSms(norm.dest, msg);
    if (!r.ok) return { ok: false, error: r.skipped ? 'sms_not_configured' : 'sms_failed' };
    return { ok: true };
  }

  const subject = locale === 'ar' ? 'كود التحقق من Veeey' : 'Your Veeey verification code';
  const body = locale === 'ar'
    ? `كود التحقق الخاص بك هو: ${issued.code}\nصالح لمدة ${OTP_TTL_MIN} دقائق.`
    : `Your verification code is: ${issued.code}\nIt is valid for ${OTP_TTL_MIN} minutes.`;
  const r = await dispatchEmail(norm.dest, subject, body);
  if (!r.ok) return { ok: false, error: r.skipped ? 'email_not_configured' : 'email_failed' };
  return { ok: true };
}

/** Verify a code for any destination (phone or email). Consumes on success. */
export async function verifyCode(rawDest: string, code: string): Promise<boolean> {
  const norm = normalizeDestination(rawDest);
  if (!norm || !code) return false;
  const row = await prisma.otpCode.findFirst({
    where: { phone: norm.dest, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!row || row.attempts >= MAX_ATTEMPTS) return false;
  const ok = await verifyPassword(code, row.codeHash);
  if (!ok) {
    await prisma.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  await prisma.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return true;
}
