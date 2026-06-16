import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/password';
import { normalizeMobile, smsConfigured } from '@/lib/provider-config';
import { dispatchSms } from '@/lib/notification-dispatch';

/**
 * Phone-OTP login (FR-ACC-01b). Codes are 6 digits, hashed at rest, valid for
 * `OTP_TTL_MIN`, and rate-limited per phone. Sent over the configured SMS
 * provider (SMSMisr). Used by the `otp` credentials provider in src/auth.ts.
 */
const OTP_TTL_MIN = 5;
const MAX_PER_WINDOW = 5; // codes requested per phone per 10 minutes
const MAX_ATTEMPTS = 5;

export type OtpResult = { ok: true } | { ok: false; error: 'rate_limited' | 'sms_not_configured' | 'sms_failed' | 'no_phone' };

export async function requestOtp(rawPhone: string): Promise<OtpResult> {
  const phone = normalizeMobile(rawPhone || '');
  if (!phone || phone.length < 10) return { ok: false, error: 'no_phone' };
  if (!(await smsConfigured())) return { ok: false, error: 'sms_not_configured' };

  const since = new Date(Date.now() - 10 * 60_000);
  const recent = await prisma.otpCode.count({ where: { phone, createdAt: { gte: since } } });
  if (recent >= MAX_PER_WINDOW) return { ok: false, error: 'rate_limited' };

  const code = String(randomInt(100_000, 1_000_000));
  const codeHash = await hashPassword(code);
  await prisma.otpCode.create({ data: { phone, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) } });

  const r = await dispatchSms(phone, `Veeey login code: ${code} (valid ${OTP_TTL_MIN} min).`);
  if (!r.ok) return { ok: false, error: r.skipped ? 'sms_not_configured' : 'sms_failed' };
  return { ok: true };
}

/** Verify a code for a phone. Consumes the matching code on success. */
export async function verifyOtp(rawPhone: string, code: string): Promise<boolean> {
  const phone = normalizeMobile(rawPhone || '');
  if (!phone || !code) return false;
  const row = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
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
