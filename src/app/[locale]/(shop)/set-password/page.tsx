import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { isTokenValid } from '@/lib/password-token-service';
import { setPasswordAction } from '@/server/password-actions';
import { PasswordInput } from '@/components/ui/password-input';
import { pick } from '@/lib/admin-i18n';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/**
 * Set-password landing (checkout backlog P2-6): the page a guest-created
 * account's emailed link opens. Public — the (hashed, single-use, expiring)
 * token is the credential. Also serves any future forgot-password flow.
 */
export default async function SetPasswordPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const token = one(sp.token);
  const error = one(sp.error);
  const valid = token ? await isTokenValid(token) : false;

  const field =
    'mt-1.5 w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-lime focus:bg-white';

  if (!valid) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-green-dark">{tb('This link is no longer valid', 'هذا الرابط لم يعد صالحًا')}</h1>
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">
          {tb('Set-password links can be used once and expire after 7 days. You can still sign in with a one-time code sent to your phone or email.', 'روابط تعيين كلمة المرور تُستخدم مرة واحدة وتنتهي بعد ٧ أيام. لا يزال بإمكانك تسجيل الدخول برمز لمرة واحدة يصلك على هاتفك أو بريدك.')}
        </p>
        <Link href="/login" className="mt-6 inline-block font-semibold text-green-dark hover:text-lime-press">{tb('Go to sign in', 'الذهاب لتسجيل الدخول')}</Link>
      </div>
    );
  }

  const errMsg =
    error === 'short' ? tb('Password must be at least 8 characters.', 'يجب ألا تقل كلمة المرور عن ٨ أحرف.')
    : error === 'mismatch' ? tb('The two passwords do not match.', 'كلمتا المرور غير متطابقتين.')
    : error === 'invalid' ? tb('This link is no longer valid — it may have just been used.', 'هذا الرابط لم يعد صالحًا — ربما استُخدم للتو.')
    : null;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-green-dark">{tb('Set your password', 'عيّن كلمة المرور')}</h1>
      <p className="mt-2 text-sm text-[color:var(--text-muted)]">
        {tb('Choose a password to finish setting up your Veeey account.', 'اختر كلمة مرور لإكمال إعداد حسابك في فيي.')}
      </p>
      {errMsg && <p role="alert" className="mt-4 rounded-[8px] bg-error-wash px-3 py-2 text-sm text-error">{errMsg}</p>}
      <form action={setPasswordAction} className="mt-6 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="token" value={token} />
        <label className="block text-sm font-semibold text-ink">{tb('New password', 'كلمة المرور الجديدة')}
          <PasswordInput name="password" required minLength={8} autoComplete="new-password" inputClassName={field} />
        </label>
        <label className="block text-sm font-semibold text-ink">{tb('Confirm password', 'تأكيد كلمة المرور')}
          <PasswordInput name="confirm" required minLength={8} autoComplete="new-password" inputClassName={field} />
        </label>
        <button type="submit" className="v-btn v-btn--primary v-btn--block">{tb('Save password', 'حفظ كلمة المرور')}</button>
      </form>
    </div>
  );
}
