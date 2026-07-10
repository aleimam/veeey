import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { listSearchRules } from '@/lib/search-rules-service';
import { searchInsights } from '@/lib/analytics-insights';
import { saveSearchRuleAction, deleteSearchRuleAction } from '@/server/search-rule-actions';
import { inputCls } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
type SP = Record<string, string | string[] | undefined>;

export default async function SearchRulesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'catalog.write')) redirect({ href: '/admin', locale });

  const [rules, insights] = await Promise.all([listSearchRules(), searchInsights(90, 25)]);
  const ruled = new Set(rules.map((r) => r.query));
  const unfixed = insights.zeroResults.filter((z) => !ruled.has(z.q));

  const flag = one(sp.saved) ? 'saved' : one(sp.deleted) ? 'deleted' : one(sp.error);
  const card = 'rounded-xl border border-border bg-card p-4';
  const th = 'px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  const td = 'px-3 py-2 text-sm';
  const label = 'mb-1 block text-xs font-medium text-muted-foreground';

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold text-foreground">{tb('Search rules', 'قواعد البحث')}</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        {tb(
          'Turn "no results" searches into real results. Rewrite a query to different terms, or redirect it to a page. Matching ignores case, spacing, and common Arabic letter variants.',
          'حوّل عمليات البحث «بلا نتائج» إلى نتائج فعلية. أعد كتابة الاستعلام بكلمات أخرى، أو وجّهه إلى صفحة. تجاهل المطابقةُ حالةَ الأحرف والمسافات وبعض صور الحروف العربية.',
        )}
      </p>

      {flag === 'saved' && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Rule saved.', 'تم حفظ القاعدة.')}</div>}
      {flag === 'deleted' && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Rule deleted.', 'تم حذف القاعدة.')}</div>}
      {flag === 'forbidden' && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb("You don't have permission.", 'ليس لديك صلاحية.')}</div>}
      {(flag === 'invalid' || flag === '1') && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Check the values and try again.', 'راجع القيم وحاول مجددًا.')}</div>}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Add / edit rule */}
        <div className={card}>
          <h2 className="mb-3 font-heading text-sm font-semibold text-foreground">{tb('Add or update a rule', 'إضافة أو تحديث قاعدة')}</h2>
          <form action={saveSearchRuleAction} className="space-y-3">
            <input type="hidden" name="locale" value={locale} />
            <div>
              <label className={label}>{tb('Search query', 'استعلام البحث')}</label>
              <input name="query" required className={inputCls} placeholder={tb('e.g. vitamin d', 'مثال: فيتامين د')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{tb('Action', 'الإجراء')}</label>
                <select name="kind" className={inputCls} defaultValue="REWRITE">
                  <option value="REWRITE">{tb('Rewrite terms', 'إعادة كتابة الكلمات')}</option>
                  <option value="REDIRECT">{tb('Redirect to page', 'التوجيه إلى صفحة')}</option>
                </select>
              </div>
            </div>
            <div>
              <label className={label}>{tb('Rewrite to (for Rewrite)', 'أعد الكتابة إلى (للإعادة)')}</label>
              <input name="rewriteTo" className={inputCls} placeholder={tb('e.g. cholecalciferol vitamin d3', 'مثال: كولي كالسيفيرول فيتامين د٣')} />
            </div>
            <div>
              <label className={label}>{tb('Redirect to path (for Redirect)', 'وجّه إلى مسار (للتوجيه)')}</label>
              <input name="targetUrl" className={inputCls} placeholder="/collection/best-sellers" />
            </div>
            <div>
              <label className={label}>{tb('Note (optional)', 'ملاحظة (اختياري)')}</label>
              <input name="note" className={inputCls} />
            </div>
            <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">{tb('Save rule', 'حفظ القاعدة')}</button>
          </form>
        </div>

        {/* Zero-result searches to fix */}
        <div className={card}>
          <h2 className="mb-3 font-heading text-sm font-semibold text-foreground">{tb('Zero-result searches (last 90 days)', 'عمليات بحث بلا نتائج (آخر ٩٠ يومًا)')}</h2>
          {unfixed.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tb('No unfixed zero-result searches. 🎉', 'لا توجد عمليات بحث بلا نتائج غير مُعالَجة. 🎉')}</p>
          ) : (
            <div className="max-h-[380px] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead><tr className="border-b border-border"><th className={th}>{tb('Query', 'الاستعلام')}</th><th className={`${th} text-end`}>{tb('Hits', 'مرات')}</th><th className={th}>{tb('Quick rewrite', 'إعادة سريعة')}</th></tr></thead>
                <tbody>
                  {unfixed.map((z) => (
                    <tr key={z.q} className="border-b border-border last:border-0">
                      <td className={`${td} font-medium`}>{z.q}</td>
                      <td className={`${td} text-end tabular-nums text-muted-foreground`}>{z.count}</td>
                      <td className={td}>
                        <form action={saveSearchRuleAction} className="flex items-center gap-1.5">
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="query" value={z.q} />
                          <input type="hidden" name="kind" value="REWRITE" />
                          <input name="rewriteTo" required className="h-8 w-40 rounded-md border border-border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder={tb('rewrite to…', 'أعد الكتابة إلى…')} />
                          <button type="submit" className="h-8 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:opacity-90">{tb('Fix', 'إصلاح')}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Existing rules */}
      <div className={`${card} mt-5`}>
        <h2 className="mb-3 font-heading text-sm font-semibold text-foreground">{tb('Active rules', 'القواعد الفعّالة')} <span className="text-xs text-muted-foreground">({rules.length})</span></h2>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tb('No rules yet.', 'لا توجد قواعد بعد.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <thead><tr className="border-b border-border"><th className={th}>{tb('Query', 'الاستعلام')}</th><th className={th}>{tb('Action', 'الإجراء')}</th><th className={th}>{tb('Target', 'الهدف')}</th><th className={th}>{tb('Note', 'ملاحظة')}</th><th className={`${th} text-end`}></th></tr></thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className={`${td} font-medium`}>{r.query}</td>
                    <td className={td}>{r.kind === 'REDIRECT' ? tb('Redirect', 'توجيه') : tb('Rewrite', 'إعادة كتابة')}</td>
                    <td className={`${td} text-muted-foreground`}>{r.kind === 'REDIRECT' ? r.targetUrl : r.rewriteTo}</td>
                    <td className={`${td} text-muted-foreground`}>{r.note ?? '—'}</td>
                    <td className={`${td} text-end`}>
                      <form action={deleteSearchRuleAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="h-8 rounded-md border border-border px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10">{tb('Delete', 'حذف')}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
