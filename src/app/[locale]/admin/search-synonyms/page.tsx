import { setRequestLocale } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { listSynonyms } from '@/lib/search-synonyms-service';
import { saveSynonymAction, deleteSynonymAction } from '@/server/search-synonym-actions';
import { inputCls } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
type SP = Record<string, string | string[] | undefined>;

export default async function SearchSynonymsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'catalog.write')) redirect({ href: '/admin', locale });

  const rows = await listSynonyms();
  const prefill = one(sp.term) ?? '';
  const flag = one(sp.saved) ? 'saved' : one(sp.deleted) ? 'deleted' : one(sp.error);
  const card = 'rounded-xl border border-border bg-card p-4';
  const th = 'px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  const td = 'px-3 py-2 text-sm';
  const label = 'mb-1 block text-xs font-medium text-muted-foreground';

  return (
    <div className="p-4 sm:p-6">
      <Link href="/admin/analytics/search" className="text-sm text-primary hover:underline">← {tb('Search analytics', 'تحليلات البحث')}</Link>
      <h1 className="mb-1 mt-1 font-heading text-xl font-semibold text-foreground">{tb('Search synonyms & aliases', 'مرادفات البحث والأسماء البديلة')}</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        {tb(
          'Teach search that different words mean the same thing. A shopper searching any listed term finds the same products. Enter equivalents separated by commas. Matching ignores case, spacing, and Arabic letter variants.',
          'علّم البحث أن كلمات مختلفة تعني الشيء نفسه. من يبحث بأيٍّ من الكلمات المدرجة يجد المنتجات نفسها. أدخل المرادفات مفصولة بفواصل. تتجاهل المطابقة حالة الأحرف والمسافات وصور الحروف العربية.',
        )}
      </p>

      {flag === 'saved' && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Synonym saved.', 'تم حفظ المرادف.')}</div>}
      {flag === 'deleted' && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Synonym deleted.', 'تم حذف المرادف.')}</div>}
      {flag === 'forbidden' && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb("You don't have permission.", 'ليس لديك صلاحية.')}</div>}
      {(flag === 'invalid' || flag === '1') && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Enter a term and at least one equivalent.', 'أدخل كلمة ومرادفًا واحدًا على الأقل.')}</div>}

      <div className={`${card} mb-5`}>
        <h2 className="mb-3 font-heading text-sm font-semibold text-foreground">{tb('Add or update a synonym group', 'إضافة أو تحديث مجموعة مرادفات')}</h2>
        <form action={saveSynonymAction} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <input type="hidden" name="locale" value={locale} />
          <div>
            <label className={label}>{tb('Term', 'الكلمة')}</label>
            <input name="term" required defaultValue={prefill} className={inputCls} placeholder={tb('e.g. vitamin c', 'مثال: فيتامين سي')} />
          </div>
          <div>
            <label className={label}>{tb('Equivalents (comma-separated)', 'المرادفات (مفصولة بفواصل)')}</label>
            <input name="synonyms" required className={inputCls} placeholder={tb('vit c, ascorbic acid, ester c', 'فيتامين ج، حمض الأسكوربيك')} />
          </div>
          <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">{tb('Save', 'حفظ')}</button>
        </form>
      </div>

      <div className={card}>
        <h2 className="mb-3 font-heading text-sm font-semibold text-foreground">{tb('Synonym groups', 'مجموعات المرادفات')} <span className="text-xs text-muted-foreground">({rows.length})</span></h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tb('No synonyms yet. Add one above — zero-result searches are good candidates.', 'لا مرادفات بعد. أضف واحدًا بالأعلى — عمليات البحث بلا نتائج مرشّحة جيدة.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead><tr className="border-b border-border"><th className={th}>{tb('Term', 'الكلمة')}</th><th className={th}>{tb('Equivalents', 'المرادفات')}</th><th className={`${th} text-end`}></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className={`${td} font-medium`}>{r.normalized}</td>
                    <td className={`${td} text-muted-foreground`}>{r.synonyms.join('، ')}</td>
                    <td className={`${td} text-end`}>
                      <form action={deleteSynonymAction}>
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
