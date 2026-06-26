import { pick } from '@/lib/admin-i18n';
import { socialSignInAction } from '@/server/auth-actions';
import type { SocialProviderId } from '@/lib/social-auth';

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);
const FacebookMark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95H15.8c-1.49 0-1.95.93-1.95 1.87V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12z" />
  </svg>
);
const AppleMark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#000" d="M17.05 12.04c-.03-2.6 2.13-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.83 1.3 10.39.86 1.25 1.89 2.66 3.23 2.61 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.28 3.15-2.54.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.72-1.04-2.75-4.13zM14.6 4.5c.71-.87 1.2-2.07 1.07-3.27-1.03.04-2.28.69-3.02 1.55-.66.76-1.24 1.99-1.08 3.16 1.15.09 2.32-.58 3.03-1.44z" />
  </svg>
);

const META: Record<SocialProviderId, { mark: () => React.ReactElement; en: string; ar: string }> = {
  google: { mark: GoogleMark, en: 'Google', ar: 'Google' },
  facebook: { mark: FacebookMark, en: 'Facebook', ar: 'فيسبوك' },
  apple: { mark: AppleMark, en: 'Apple', ar: 'Apple' },
};

/** OAuth sign-in buttons, shown only for admin-enabled providers. Bilingual, RTL-safe. */
export function SocialAuthButtons({ providers, locale }: { providers: SocialProviderId[]; locale: string }) {
  if (!providers.length) return null;
  const t = pick(locale);
  return (
    <div className="mt-6">
      <div className="my-4 flex items-center gap-3 text-xs text-[color:var(--text-muted)]">
        <span className="h-px flex-1 bg-[color:var(--slate-border)]" />
        {t('or continue with', 'أو تابع باستخدام')}
        <span className="h-px flex-1 bg-[color:var(--slate-border)]" />
      </div>
      <div className="flex flex-col gap-2.5">
        {providers.map((p) => {
          const m = META[p];
          const Mark = m.mark;
          return (
            <form key={p} action={socialSignInAction}>
              <input type="hidden" name="provider" value={p} />
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2.5 rounded-full border border-[color:var(--slate-border)] bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface"
              >
                <Mark />
                {t(`Continue with ${m.en}`, `المتابعة عبر ${m.ar}`)}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
