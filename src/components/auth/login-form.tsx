'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { loginCustomer, requestOtpAction, loginWithOtp, type AuthFormState } from '@/server/auth-actions';
import { RecaptchaToken } from '@/components/auth/recaptcha-token';

const field =
  'mt-1.5 w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-slate-45 focus:border-lime focus:bg-white';
const errBox = 'rounded-[8px] bg-error-wash px-3 py-2 text-sm text-error';
const tabCls = (active: boolean) =>
  `flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${active ? 'bg-green-dark text-white' : 'text-slate-70 hover:bg-surface'}`;

export function LoginForm({ locale, social }: { locale: string; social?: React.ReactNode }) {
  const t = useTranslations('auth');
  const [mode, setMode] = useState<'password' | 'otp'>('password');

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-3xl font-bold text-green-dark">{t('login.title')}</h1>

      <div className="mt-5 flex gap-1 rounded-full border border-[color:var(--slate-border)] bg-white p-1">
        <button type="button" onClick={() => setMode('password')} className={tabCls(mode === 'password')}>{t('login.withPassword')}</button>
        <button type="button" onClick={() => setMode('otp')} className={tabCls(mode === 'otp')}>{t('login.withOtp')}</button>
      </div>

      {mode === 'password' ? <PasswordLogin locale={locale} /> : <OtpLogin locale={locale} />}

      {social}

      <p className="mt-6 text-sm text-[color:var(--text-muted)]">
        {t('login.noAccount')}{' '}
        <Link href="/register" className="font-semibold text-green-dark hover:text-lime-press">{t('login.registerLink')}</Link>
      </p>
    </div>
  );
}

function PasswordLogin({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<AuthFormState, FormData>(loginCustomer, {});
  return (
    <form action={action} className="mt-5">
      {state.error && <p role="alert" className={`mb-4 ${errBox}`}>{t(`errors.${state.error}`)}</p>}
      <input type="hidden" name="locale" value={locale} />
      <RecaptchaToken action="login" />
      <label className="block text-sm font-semibold text-ink">
        {t('login.identifier')}
        <input name="identifier" type="text" required autoComplete="username" className={field} />
      </label>
      <label className="mt-4 block text-sm font-semibold text-ink">
        {t('login.password')}
        <input name="password" type="password" required autoComplete="current-password" className={field} />
      </label>
      <button type="submit" disabled={pending} className="v-btn v-btn--primary v-btn--block mt-6">{t('login.submit')}</button>
    </form>
  );
}

function OtpLogin({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const [phone, setPhone] = useState('');
  const [req, reqAction, reqPending] = useActionState<AuthFormState, FormData>(requestOtpAction, {});
  const [login, loginAction, loginPending] = useActionState<AuthFormState, FormData>(loginWithOtp, {});
  const sent = req.otp === 'sent';

  return (
    <div className="mt-5 space-y-4">
      <form action={reqAction}>
        <input type="hidden" name="locale" value={locale} />
        <label className="block text-sm font-semibold text-ink">
          {t('login.phone')}
          <input name="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" autoComplete="tel" className={field} />
        </label>
        <button type="submit" disabled={reqPending} className="v-btn v-btn--secondary v-btn--block mt-3">{t('login.sendCode')}</button>
      </form>

      {req.otp && req.otp !== 'sent' && (
        <p role="alert" className={errBox}>{t(req.otp === 'rate_limited' ? 'errors.rate_limited' : req.otp === 'sms_off' ? 'errors.sms_off' : 'errors.invalid')}</p>
      )}
      {sent && <p className="rounded-[8px] bg-green-wash px-3 py-2 text-sm text-green-dark">{t('login.otpSent')}</p>}

      {sent && (
        <form action={loginAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="phone" value={phone} />
          {login.error && <p role="alert" className={`mb-3 ${errBox}`}>{t(`errors.${login.error}`)}</p>}
          <label className="block text-sm font-semibold text-ink">
            {t('login.code')}
            <input name="code" inputMode="numeric" required autoComplete="one-time-code" className={field} />
          </label>
          <button type="submit" disabled={loginPending} className="v-btn v-btn--primary v-btn--block mt-3">{t('login.verify')}</button>
        </form>
      )}
    </div>
  );
}
