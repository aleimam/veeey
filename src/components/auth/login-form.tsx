'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { loginCustomer, requestOtpAction, loginWithOtp, type AuthFormState } from '@/server/auth-actions';
import { RecaptchaToken } from '@/components/auth/recaptcha-token';
import { PhoneInput } from '@/components/ui/phone-input';
import { PasswordInput } from '@/components/ui/password-input';
import { otpChannelOf } from '@/lib/auth-errors';

const field =
  'mt-1.5 w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-slate-45 focus:border-lime focus:bg-white';
const errBox = 'rounded-[8px] bg-error-wash px-3 py-2 text-sm text-error';
const tabCls = (active: boolean) =>
  `flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${active ? 'bg-green-dark text-white' : 'text-slate-70 hover:bg-surface'}`;
const subTabCls = (active: boolean) =>
  `flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-green-wash text-green-dark' : 'text-slate-70 hover:bg-surface'}`;

/**
 * Turn a precise error code into its red message. Every code has an
 * `auth.errors.<code>` key in EN + AR; `too_many_attempts` takes the wait time
 * (owner 2026-07-22 #226 — no more single generic "Invalid credentials").
 */
function errorText(t: ReturnType<typeof useTranslations<'auth'>>, state: AuthFormState): string | null {
  if (!state.error) return null;
  if (state.error === 'too_many_attempts') return t('errors.too_many_attempts', { minutes: state.minutes ?? 15 });
  return t(`errors.${state.error}`);
}

/** Same, for the "send me a code" step. */
function otpErrorText(t: ReturnType<typeof useTranslations<'auth'>>, state: AuthFormState): string | null {
  if (!state.otp || state.otp === 'sent') return null;
  if (state.otp === 'too_many_attempts') return t('errors.too_many_attempts', { minutes: state.minutes ?? 10 });
  return t(`errors.${state.otp}`);
}

export function LoginForm({ locale, social, next }: { locale: string; social?: React.ReactNode; next?: string }) {
  const t = useTranslations('auth');
  const [mode, setMode] = useState<'password' | 'otp'>('password');

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-3xl font-bold text-green-dark">{t('login.title')}</h1>

      <div className="mt-5 flex gap-1 rounded-full border border-[color:var(--slate-border)] bg-white p-1">
        <button type="button" onClick={() => setMode('password')} className={tabCls(mode === 'password')}>{t('login.withPassword')}</button>
        <button type="button" onClick={() => setMode('otp')} className={tabCls(mode === 'otp')}>{t('login.withOtp')}</button>
      </div>

      {mode === 'password' ? <PasswordLogin locale={locale} next={next} /> : <OtpLogin locale={locale} next={next} />}

      {social}

      <p className="mt-6 text-sm text-[color:var(--text-muted)]">
        {t('login.noAccount')}{' '}
        <Link href="/register" className="font-semibold text-green-dark hover:text-lime-press">{t('login.registerLink')}</Link>
      </p>
    </div>
  );
}

function PasswordLogin({ locale, next }: { locale: string; next?: string }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<AuthFormState, FormData>(loginCustomer, {});
  const msg = errorText(t, state);
  return (
    <form action={action} className="mt-5">
      {msg && <p role="alert" className={`mb-4 ${errBox}`}>{msg}</p>}
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      <RecaptchaToken action="login" />
      <label className="block text-sm font-semibold text-ink">
        {t('login.identifier')}
        <input name="identifier" type="text" required autoComplete="username" className={field} />
      </label>
      <label className="mt-4 block text-sm font-semibold text-ink">
        {t('login.password')}
        <PasswordInput name="password" required autoComplete="current-password" />
      </label>
      <button type="submit" disabled={pending} className="v-btn v-btn--primary v-btn--block mt-6">{t('login.submit')}</button>
    </form>
  );
}

/**
 * Code sign-in. The customer picks a channel and types either a phone number
 * (country selector, Egypt by default) or an email address — both issue the
 * same 6-digit code through `requestVerifyCode`.
 */
function OtpLogin({ locale, next }: { locale: string; next?: string }) {
  const t = useTranslations('auth');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [req, reqAction, reqPending] = useActionState<AuthFormState, FormData>(requestOtpAction, {});
  const [login, loginAction, loginPending] = useActionState<AuthFormState, FormData>(loginWithOtp, {});

  const dest = channel === 'sms' ? phone : email.trim();
  const destOk = otpChannelOf(dest) === channel;
  // Only show the code box while what is typed still matches what the code was
  // sent to — editing the number or switching channel invalidates it.
  const sent = req.otp === 'sent' && req.dest === dest;
  const reqMsg = otpErrorText(t, req);
  const loginMsg = errorText(t, login);

  return (
    <div className="mt-5 space-y-4">
      <div className="flex gap-1 rounded-full border border-[color:var(--slate-border)] bg-white p-1">
        <button type="button" onClick={() => setChannel('sms')} className={subTabCls(channel === 'sms')}>{t('login.byPhone')}</button>
        <button type="button" onClick={() => setChannel('email')} className={subTabCls(channel === 'email')}>{t('login.byEmail')}</button>
      </div>

      <form action={reqAction}>
        <input type="hidden" name="locale" value={locale} />
        {channel === 'sms' ? (
          <label className="block text-sm font-semibold text-ink">
            {t('login.phone')}
            <PhoneInput name="dest" value={phone} onChange={setPhone} required autoComplete="tel" />
          </label>
        ) : (
          <label className="block text-sm font-semibold text-ink">
            {t('login.email')}
            <input
              name="dest"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="name@example.com"
              className={field}
              dir="ltr"
            />
            {email.trim() !== '' && !destOk && (
              <span role="alert" className="mt-1 block text-xs font-normal text-error">{t('errors.invalid_email')}</span>
            )}
          </label>
        )}
        <p className="mt-1.5 text-xs text-[color:var(--text-muted)]">{t('login.otpHint')}</p>
        <button type="submit" disabled={reqPending || !destOk} className="v-btn v-btn--secondary v-btn--block mt-3 disabled:opacity-50">{t('login.sendCode')}</button>
      </form>

      {reqMsg && <p role="alert" className={errBox}>{reqMsg}</p>}
      {sent && (
        <p className="rounded-[8px] bg-green-wash px-3 py-2 text-sm text-green-dark">
          {req.channel === 'email' ? t('login.otpSentEmail') : t('login.otpSentSms')}
        </p>
      )}

      {sent && (
        <form action={loginAction}>
          <input type="hidden" name="locale" value={locale} />
          {next && <input type="hidden" name="next" value={next} />}
          <input type="hidden" name="dest" value={dest} />
          {loginMsg && <p role="alert" className={`mb-3 ${errBox}`}>{loginMsg}</p>}
          <label className="block text-sm font-semibold text-ink">
            {t('login.code')}
            <input name="code" inputMode="numeric" maxLength={6} required autoComplete="one-time-code" className={`${field} tracking-widest`} dir="ltr" />
          </label>
          <button type="submit" disabled={loginPending} className="v-btn v-btn--primary v-btn--block mt-3">{t('login.verify')}</button>
        </form>
      )}
    </div>
  );
}
