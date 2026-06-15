'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { registerCustomer, type AuthFormState } from '@/server/auth-actions';

const field =
  'mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

export function RegisterForm({ locale, referralCode }: { locale: string; referralCode?: string }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    registerCustomer,
    {},
  );

  return (
    <form action={action} className="w-full max-w-sm">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {t('register.title')}
      </h1>

      {state.error && (
        <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      )}

      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="recaptchaToken" value="" />
      {referralCode && <input type="hidden" name="ref" value={referralCode} />}

      <label className="mt-5 block text-sm font-medium">
        {t('register.name')}
        <input name="name" type="text" required autoComplete="name" className={field} />
      </label>
      <label className="mt-4 block text-sm font-medium">
        {t('register.email')}
        <input name="email" type="email" required autoComplete="email" className={field} />
      </label>
      <label className="mt-4 block text-sm font-medium">
        {t('register.password')}
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {t('register.submit')}
      </button>

      <p className="mt-6 text-sm text-muted-foreground">
        {t('register.haveAccount')}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('register.loginLink')}
        </Link>
      </p>
    </form>
  );
}
