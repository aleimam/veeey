/**
 * Precise sign-in failure classification (owner batch 2026-07-22, task #226).
 *
 * The owner's complaint: one generic "Invalid credentials" for every failure
 * tells the customer nothing. These pure mappers turn the facts a server action
 * has gathered into a specific code that `messages/{en,ar}.json` renders in red.
 *
 * ⚠️ SECURITY TRADEOFF — user enumeration. Distinguishing "no account with this
 * identifier" from "wrong password" is an explicit owner requirement, so we do
 * it. The compensating controls live in `@/server/auth-actions`:
 *   (a) per-identifier AND per-IP fixed-window rate limits (tightened for #226),
 *   (b) nothing beyond *existence* is ever revealed — no name, no email, no
 *       masked phone, no "did you mean",
 *   (c) a dummy bcrypt comparison runs when the user is NOT found, so the reply
 *       takes about as long either way and timing leaks nothing extra.
 * NOTE: `unknown_identifier` still lets an attacker enumerate which emails have
 * accounts (at ~8 tries per 15 min per IP). That is the accepted cost of the
 * requirement; if it ever needs revisiting, collapse `unknown_identifier` and
 * `wrong_password` into `credentials` here — nothing else has to change.
 */

/** Every precise reason a password sign-in can fail. */
export type LoginFailure =
  | 'identifier_required'
  | 'password_required'
  | 'too_many_attempts'
  | 'recaptcha'
  | 'unknown_identifier'
  | 'no_password'
  | 'wrong_password';

export type PasswordLoginFacts = {
  identifier: string;
  password: string;
  /** The per-identifier / per-IP limiter rejected this attempt. */
  rateLimited?: boolean;
  /** reCAPTCHA verdict (fails OPEN — `true` when the secret is unconfigured). */
  recaptchaOk?: boolean;
  /** An account matched the identifier (email / username / phone). */
  userFound?: boolean;
  /** That account has a password hash at all (social/OTP-only accounts do not). */
  hasPassword?: boolean;
  /** The supplied password verified. */
  passwordOk?: boolean;
};

/**
 * Ordered so the *first* thing wrong is what the customer is told about.
 * Returns `null` when the attempt should be allowed through.
 */
export function classifyPasswordLogin(f: PasswordLoginFacts): LoginFailure | null {
  if (!f.identifier.trim()) return 'identifier_required';
  if (!f.password) return 'password_required';
  if (f.rateLimited) return 'too_many_attempts';
  if (f.recaptchaOk === false) return 'recaptcha';
  if (f.userFound === false) return 'unknown_identifier';
  if (f.hasPassword === false) return 'no_password';
  if (f.passwordOk === false) return 'wrong_password';
  return null;
}

/** Error codes `@/lib/otp-service` can return (mirrored here to keep this pure). */
export type OtpServiceError =
  | 'rate_limited'
  | 'sms_not_configured'
  | 'sms_failed'
  | 'no_phone'
  | 'email_not_configured'
  | 'email_failed'
  | 'invalid_destination';

/** Precise reasons a "send me a code" request can fail. */
export type OtpFailure =
  | 'bad_destination'
  | 'too_many_attempts'
  | 'sms_off'
  | 'email_off'
  | 'send_failed';

export function classifyOtpRequest(e: OtpServiceError): OtpFailure {
  switch (e) {
    case 'rate_limited':
      return 'too_many_attempts';
    case 'sms_not_configured':
      return 'sms_off';
    case 'email_not_configured':
      return 'email_off';
    case 'invalid_destination':
    case 'no_phone':
      return 'bad_destination';
    default:
      return 'send_failed';
  }
}

/**
 * Which channel a typed OTP identifier would use — drives the "check your SMS"
 * vs "check your inbox" copy *before* the server round-trip. Mirrors
 * `normalizeDestination()` without pulling the DB-backed provider config in.
 */
export function otpChannelOf(raw: string): 'email' | 'sms' | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (v.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'email' : null;
  return v.replace(/\D/g, '').length >= 8 ? 'sms' : null;
}

/** Whole minutes a customer must wait, floored at 1 (never "try again in 0"). */
export function retryMinutes(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 60_000));
}
