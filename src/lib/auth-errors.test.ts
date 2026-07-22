import { describe, expect, it } from 'vitest';
import {
  classifyOtpRequest,
  classifyPasswordLogin,
  otpChannelOf,
  retryMinutes,
  type PasswordLoginFacts,
} from '@/lib/auth-errors';

const facts = (over: Partial<PasswordLoginFacts> = {}): PasswordLoginFacts => ({
  identifier: 'shopper@example.com',
  password: 'hunter2hunter2',
  rateLimited: false,
  recaptchaOk: true,
  userFound: true,
  hasPassword: true,
  passwordOk: true,
  ...over,
});

describe('classifyPasswordLogin', () => {
  it('lets a good attempt through', () => {
    expect(classifyPasswordLogin(facts())).toBeNull();
  });

  it('distinguishes an unknown account from a wrong password (owner #226)', () => {
    expect(classifyPasswordLogin(facts({ userFound: false }))).toBe('unknown_identifier');
    expect(classifyPasswordLogin(facts({ passwordOk: false }))).toBe('wrong_password');
  });

  it('tells an OTP/social-only account to use a code instead', () => {
    expect(classifyPasswordLogin(facts({ hasPassword: false }))).toBe('no_password');
  });

  it('names the missing field before anything else', () => {
    expect(classifyPasswordLogin(facts({ identifier: '   ' }))).toBe('identifier_required');
    expect(classifyPasswordLogin(facts({ password: '' }))).toBe('password_required');
    // A blank identifier wins even when the password is also blank.
    expect(classifyPasswordLogin(facts({ identifier: '', password: '' }))).toBe('identifier_required');
  });

  it('reports throttling before it reveals whether the account exists', () => {
    expect(classifyPasswordLogin(facts({ rateLimited: true, userFound: false }))).toBe('too_many_attempts');
  });

  it('reports a failed reCAPTCHA before the account lookup', () => {
    expect(classifyPasswordLogin(facts({ recaptchaOk: false, userFound: false }))).toBe('recaptcha');
  });

  it('stays quiet when the lookup has not run (facts undefined)', () => {
    expect(classifyPasswordLogin({ identifier: 'a@b.co', password: 'x' })).toBeNull();
  });
});

describe('classifyOtpRequest', () => {
  it('maps every otp-service error to a precise reason', () => {
    expect(classifyOtpRequest('rate_limited')).toBe('too_many_attempts');
    expect(classifyOtpRequest('sms_not_configured')).toBe('sms_off');
    expect(classifyOtpRequest('email_not_configured')).toBe('email_off');
    expect(classifyOtpRequest('invalid_destination')).toBe('bad_destination');
    expect(classifyOtpRequest('no_phone')).toBe('bad_destination');
    expect(classifyOtpRequest('sms_failed')).toBe('send_failed');
    expect(classifyOtpRequest('email_failed')).toBe('send_failed');
  });
});

describe('otpChannelOf', () => {
  it('routes an email address to email and a phone to SMS', () => {
    expect(otpChannelOf('shopper@example.com')).toBe('email');
    expect(otpChannelOf('201012345678')).toBe('sms');
    expect(otpChannelOf('+20 101 234 5678')).toBe('sms');
  });
  it('rejects half-typed input', () => {
    expect(otpChannelOf('')).toBeNull();
    expect(otpChannelOf('shopper@')).toBeNull();
    expect(otpChannelOf('2010')).toBeNull();
  });
});

describe('retryMinutes', () => {
  it('rounds up and never says "try again in 0 minutes"', () => {
    expect(retryMinutes(0)).toBe(1);
    expect(retryMinutes(30_000)).toBe(1);
    expect(retryMinutes(60_001)).toBe(2);
    expect(retryMinutes(15 * 60_000)).toBe(15);
  });
});
