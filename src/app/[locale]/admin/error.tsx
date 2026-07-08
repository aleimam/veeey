'use client';

import { useLocale } from 'next-intl';
import { pick } from '@/lib/admin-i18n';

/**
 * Admin error boundary. Most admin errors are permission denials
 * (requirePermission throws 'FORBIDDEN' during SSR when a staffer opens a page
 * their departments don't cover) — show a friendly explanation instead of the
 * generic crash screen. Anything else gets a retry + the digest for the logs.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useLocale();
  const tb = pick(locale);
  // In production Next redacts server error messages but forwards `digest` —
  // requirePermission sets digest: 'FORBIDDEN' so this works in both modes.
  const forbidden = error.digest === 'FORBIDDEN' || error.message === 'FORBIDDEN';
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
        <div className="mb-2 text-3xl">{forbidden ? '🔒' : '⚠️'}</div>
        <h1 className="mb-2 font-heading text-lg font-semibold text-foreground">
          {forbidden ? tb('No access to this page', 'لا تملك صلاحية لهذه الصفحة') : tb('Something went wrong', 'حدث خطأ ما')}
        </h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {forbidden
            ? tb('Your departments don’t include the permission this page needs. Ask an administrator to add you to the right department.', 'أقسامك لا تتضمن الصلاحية المطلوبة لهذه الصفحة. اطلب من المسؤول إضافتك إلى القسم المناسب.')
            : tb('An unexpected error occurred. Try again — if it keeps happening, share the code below with support.', 'حدث خطأ غير متوقع. حاول مجددًا — إذا تكرر، شارك الرمز أدناه مع الدعم.')}
        </p>
        {!forbidden && error.digest && <p className="mb-4 font-mono text-xs text-muted-foreground">{error.digest}</p>}
        <div className="flex justify-center gap-2">
          {!forbidden && (
            <button onClick={reset} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              {tb('Try again', 'حاول مجددًا')}
            </button>
          )}
          <a href={`/${locale}/admin`} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface">
            {tb('Back to dashboard', 'العودة للوحة التحكم')}
          </a>
        </div>
      </div>
    </div>
  );
}
