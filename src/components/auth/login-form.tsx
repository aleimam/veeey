'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { loginCustomer, requestOtpAction, loginWithOtp, type AuthFormState } from '@/server/auth-actions';

const field =
  'mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';
const tabCls = (active: boolean) =>
  `flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface'}`;

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const [mode, setMode] = useState<'password' | 'otp'>('password');

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{t('login.title')}</h1>

      <div className="mt-5 flex gap-1 rounded-lg border border-border bg-card p-1">
        <button type="button" onClick={() => setMode('password')} className={tabCls(mode === 'password')}>{t('login.withPassword')}</button>
        <button type="button" onClick={() => setMode('otp')} className={tabCls(mode === 'otp')}>{t('login.withOtp')}</button>
      </div>

      {mode === 'password' ? <PasswordLogin locale={locale} /> : <OtpLogin locale={locale} />}

      <p className="mt-6 text-sm text-muted-foreground">
        {t('login.noAccount')}{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">{t('login.registerLink')}</Link>
      </p>
    </div>
  );
}

function PasswordLogin({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<AuthFormState, FormData>(loginCustomer, {});
  return (
    <form action={action} className="mt-4">
      {state.error && <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{t(`errors.${state.error}`)}</p>}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="recaptchaToken" value="" />
      <label className="block text-sm font-medium">
        {t('login.identifier')}
        <input name="identifier" type="text" required autoComplete="username" className={field} />
      </label>
      <label className="mt-4 block text-sm font-medium">
        {t('login.password')}
        <input name="password" type="password" required autoComplete="current-password" className={field} />
      </label>
      <button type="submit" disabled={pending} className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">{t('login.submit')}</button>
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
    <div className="mt-4 space-y-4">
      <form action={reqAction}>
        <input type="hidden" name="locale" value={locale} />
        <label className="block text-sm font-medium">
          {t('login.phone')}
          <input name="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" autoComplete="tel" className={field} />
        </label>
        <button type="submit" disabled={reqPending} className="mt-3 w-full rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-60">{t('login.sendCode')}</button>
      </form>

      {req.otp && req.otp !== 'sent' && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{t(req.otp === 'rate_limited' ? 'errors.rate_limited' : req.otp === 'sms_off' ? 'errors.sms_off' : 'errors.invalid')}</p>}
      {sent && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{t('login.otpSent')}</p>}

      {sent && (
        <form action={loginAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="phone" value={phone} />
          {login.error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{t(`errors.${login.error}`)}</p>}
          <label className="block text-sm font-medium">
            {t('login.code')}
            <input name="code" inputMode="numeric" required autoComplete="one-time-code" className={field} />
          </label>
          <button type="submit" disabled={loginPending} className="mt-3 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">{t('login.verify')}</button>
        </form>
      )}
    </div>
  );
}
