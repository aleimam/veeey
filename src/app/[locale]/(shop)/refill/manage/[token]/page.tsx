import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { pick } from '@/lib/admin-i18n';
import { getPlanByToken, refillSettings } from '@/lib/refill-service';
import { refillTokenOpAction } from '@/server/refill-actions';
import { Link } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Login-free Refill plan management (linked from every plan SMS). The token in
 *  the URL is the capability — it only ever controls this single plan. Kept
 *  outside the feature-flag redirect so links keep working for existing plans. */
export default async function RefillManagePage({ params, searchParams }: { params: Promise<{ locale: string; token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale, token } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const plan = await getPlanByToken(token);
  if (!plan) notFound();
  const { frequencies } = await refillSettings();
  const flag = one(sp.r);
  const ar = locale === 'ar';
  const pname = ar ? plan.productNameAr ?? plan.productName : plan.productName;
  const paused = plan.status === 'PAUSED';
  const cancelled = plan.status === 'CANCELLED';
  const btn = 'rounded-[10px] border border-[color:var(--slate-border)] bg-white px-3.5 py-2.5 text-sm font-semibold text-slate hover:border-green-dark';

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-green-dark">{tb('Manage your Refill plan', 'إدارة خطة ريفيل')}</h1>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">{tb('Changes apply instantly — no sign-in needed from this link.', 'تُطبَّق التغييرات فورًا — لا حاجة لتسجيل الدخول من هذا الرابط.')}</p>

      {flag === 'ok' && <div className="mt-4 rounded-[12px] bg-green-wash px-4 py-3 text-sm font-medium text-green-dark">{tb('Plan updated.', 'تم تحديث الخطة.')}</div>}
      {flag === 'failed' && <div className="mt-4 rounded-[12px] bg-gold-wash px-4 py-3 text-sm font-medium text-ink">{tb('Could not update — the plan may be cancelled.', 'تعذّر التحديث — قد تكون الخطة ملغاة.')}</div>}

      <div className="mt-6 rounded-[16px] border border-[color:var(--green-dark-05)] bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-bold text-ink">{pname}</span>
          <span className="text-[13px] text-[color:var(--text-muted)]">×{plan.qty}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cancelled ? 'bg-surface text-[color:var(--text-subtle)]' : paused ? 'bg-gold-wash text-gold-deep' : 'bg-green-wash text-green-dark'}`}>
            {cancelled ? tb('Cancelled', 'ملغاة') : paused ? tb('Paused', 'موقوفة') : tb('Active', 'نشطة')}
          </span>
        </div>
        {!cancelled && !paused && (
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            {tb(`Next delivery: ${plan.nextRunAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} · every ${plan.frequencyDays} days · cash on delivery`,
                `التوصيلة القادمة: ${plan.nextRunAt.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })} · كل ${plan.frequencyDays} يومًا · دفع عند الاستلام`)}
            {plan.skipNext && <span className="ms-1 font-bold text-gold-deep">{tb('(next one will be skipped)', '(ستُتخطى القادمة)')}</span>}
          </p>
        )}

        {!cancelled && (
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {!paused && (
              <form action={refillTokenOpAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="op" value={plan.skipNext ? 'unskip' : 'skip'} />
                <button className={btn}>{plan.skipNext ? tb('Undo skip', 'إلغاء التخطي') : tb('Skip next delivery', 'تخطَّ التوصيلة القادمة')}</button>
              </form>
            )}
            <form action={refillTokenOpAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="op" value={paused ? 'resume' : 'pause'} />
              <button className={btn}>{paused ? tb('Resume plan', 'استئناف الخطة') : tb('Pause plan', 'إيقاف مؤقت')}</button>
            </form>
            <form action={refillTokenOpAction} className="flex items-center gap-1.5">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="op" value="frequency" />
              <select name="frequency" defaultValue={plan.frequencyDays} className="rounded-[10px] border border-[color:var(--slate-border)] bg-white px-2.5 py-2.5 text-sm">
                {(frequencies.includes(plan.frequencyDays) ? frequencies : [plan.frequencyDays, ...frequencies]).map((d) => (
                  <option key={d} value={d}>{tb(`Every ${d} days`, `كل ${d} يومًا`)}</option>
                ))}
              </select>
              <button className={btn}>{tb('Update', 'تحديث')}</button>
            </form>
            <form action={refillTokenOpAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="op" value="cancel" />
              <button className="rounded-[10px] border border-[color:var(--slate-border)] px-3.5 py-2.5 text-sm font-semibold text-[color:var(--error,#b3261e)] hover:border-[color:var(--error,#b3261e)]">{tb('Cancel plan', 'إلغاء الخطة')}</button>
            </form>
          </div>
        )}
      </div>

      <p className="mt-6 text-sm text-[color:var(--text-muted)]">
        {tb('Have an account?', 'لديك حساب؟')}{' '}
        <Link href="/account" className="font-semibold text-green-dark hover:text-lime-press">{tb('Manage all your plans', 'أدر كل خططك')}</Link>
      </p>
    </div>
  );
}
