import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listQuestions } from '@/lib/qa-service';
import { answerQuestionAction, setQuestionStatusAction, deleteQuestionAction } from '@/server/admin-play-actions';
import { StatusBadge, inputCls } from '@/components/admin/ui';
import { FilterBar } from '@/components/admin/filter-bar';
import { ListPagination } from '@/components/admin/list-pagination';
import { parseListParams, clientPage, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminQuestionsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const status = one(sp.status);
  const q = one(sp.q);
  const lp = parseListParams(sp, { sortable: [], defaultSort: '' });
  const all = await listQuestions({ status, q });
  const { rows, total } = clientPage(all, lp, {});

  const basePath = `/${locale}/admin/questions`;

  return (
    <div className="p-6">
      <header className="mb-2 flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">{tb('Product questions', 'أسئلة المنتجات')} ({total})</h1>
      </header>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        {tb('Customer questions from product pages. Write an answer and publish — only published, answered questions appear on the storefront.', 'أسئلة العملاء من صفحات المنتجات. اكتب إجابة وانشرها — تظهر في المتجر الأسئلة المنشورة والمُجابة فقط.')}
      </p>

      <FilterBar
        locale={locale}
        path="questions"
        values={{ q, status }}
        fields={[
          { name: 'q', label: tb('Search', 'بحث'), type: 'text', placeholder: tb('Question / answer text', 'نص السؤال / الإجابة') },
          { name: 'status', label: tb('Status', 'الحالة'), type: 'select', options: ['PENDING', 'PUBLISHED', 'HIDDEN'].map((s) => ({ value: s, label: s })) },
        ]}
      />

      <ol className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-border p-4">
            <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
              <Link href={`/products/${row.product.slugEn}`} target="_blank" className="font-medium text-primary hover:underline">{row.product.nameEn}</Link>
              <StatusBadge status={row.status} />
              <span className="text-xs text-muted-foreground">
                {row.askerName || tb('Anonymous', 'مجهول')} · {new Date(row.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB')}
              </span>
              <div className="ms-auto flex items-center gap-3 text-xs">
                {row.status !== 'PUBLISHED' && row.answer && (
                  <form action={setQuestionStatusAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="status" value="PUBLISHED" />
                    <button className="text-primary hover:underline">{tb('Publish', 'نشر')}</button>
                  </form>
                )}
                {row.status !== 'HIDDEN' && (
                  <form action={setQuestionStatusAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="status" value="HIDDEN" />
                    <button className="text-muted-foreground hover:underline">{tb('Hide', 'إخفاء')}</button>
                  </form>
                )}
                <form action={deleteQuestionAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={row.id} />
                  <button className="text-destructive hover:underline">{tb('Delete', 'حذف')}</button>
                </form>
              </div>
            </div>

            <p className="mb-3 text-sm font-medium text-foreground">{tb('Q:', 'س:')} {row.question}</p>

            <form action={answerQuestionAction} className="flex flex-wrap items-start gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={row.id} />
              <textarea name="answer" rows={2} defaultValue={row.answer ?? ''} placeholder={tb('Write the answer…', 'اكتب الإجابة…')} className={`${inputCls} min-w-[260px] flex-1`} />
              <div className="flex flex-col gap-1.5">
                <button className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface">{tb('Save answer', 'حفظ الإجابة')}</button>
                <button name="publish" value="1" className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">{tb('Save & publish', 'حفظ ونشر')}</button>
              </div>
            </form>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{tb('No questions match.', 'لا توجد أسئلة مطابقة.')}</li>
        )}
      </ol>

      <ListPagination page={lp.page} perPage={lp.perPage} total={total} sp={sp} basePath={basePath} locale={locale} />
    </div>
  );
}
