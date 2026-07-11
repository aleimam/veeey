'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { registerCustomer, type AuthFormState } from '@/server/auth-actions';
import { RecaptchaToken } from '@/components/auth/recaptcha-token';

const field =
  'mt-1.5 w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-slate-45 focus:border-lime focus:bg-white';

export function RegisterForm({ locale, referralCode, social }: { locale: string; referralCode?: string; social?: React.ReactNode }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<AuthFormState, FormData>(registerCustomer, {});

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-3xl font-bold text-green-dark">{t('register.title')}</h1>

      {state.error && (
        <p role="alert" className="mt-4 rounded-[8px] bg-error-wash px-3 py-2 text-sm text-error">
          {t(`errors.${state.error}`)}
        </p>
      )}

      <form action={action} className="mt-5">
        <input type="hidden" name="locale" value={locale} />
        <RecaptchaToken action="register" />
        {referralCode && <input type="hidden" name="ref" value={referralCode} />}

        <label className="block text-sm font-semibold text-ink">
          {t('register.name')}
          <input name="name" type="text" required autoComplete="name" className={field} />
        </label>
        <label className="mt-4 block text-sm font-semibold text-ink">
          {t('register.email')}
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <label className="mt-4 block text-sm font-semibold text-ink">
          {t('register.phone')}
          <input name="phone" type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" className={field} />
        </label>
        <label className="mt-4 block text-sm font-semibold text-ink">
          {t('register.username')}
          <input name="username" type="text" autoComplete="username" minLength={3} className={field} />
        </label>
        <label className="mt-4 block text-sm font-semibold text-ink">
          {t('register.password')}
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />
        </label>

        <button type="submit" disabled={pending} className="v-btn v-btn--primary v-btn--block mt-6">
          {t('register.submit')}
        </button>
      </form>

      {social}

      <p className="mt-6 text-sm text-[color:var(--text-muted)]">
        {t('register.haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-green-dark hover:text-lime-press">
          {t('register.loginLink')}
        </Link>
      </p>
    </div>
  );
}
