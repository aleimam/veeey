import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listReturnReasons } from '@/lib/return-reason-service';
import { saveReturnReasonAction, toggleReturnReasonAction } from '@/server/return-reason-actions';
import { inputCls } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';

export const dynamic = 'force-dynamic';

/** Manage the bilingual return-reason list (V1 Admin Panel §4, Task 5). */
export default async function ReturnReasonsPage({ params }: { params: Promise<{ locale: string }> }) {
  // Page-level RBAC (matches the sidebar's permission key) — the sidebar only
  // HIDES the link; without this any staffer with one permission could read it.
  await requirePermission('returns.manage');
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const reasons = await listReturnReasons(false);

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold">{tb('Return reasons', 'أسباب الإرجاع')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{tb('The reasons a customer picks when requesting a return. “Needs detail” reveals a free-text field.', 'الأسباب التي يختارها العميل عند طلب الإرجاع. «يتطلب تفاصيل» يُظهر حقلاً نصياً.')}</p>
        </div>
        <Link href="/admin/returns" className="text-sm text-primary hover:underline">← {tb('Back to returns', 'العودة للمرتجعات')}</Link>
      </header>

      <form action={saveReturnReasonAction} className="mb-6 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-4">
        <input type="hidden" name="locale" value={locale} />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">{tb('Label (EN)', 'التسمية (EN)')}
          <input name="labelEn" required className={inputCls} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">{tb('Label (AR)', 'التسمية (AR)')}
          <input name="labelAr" required dir="rtl" className={inputCls} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">{tb('Order', 'الترتيب')}
          <input name="sortOrder" type="number" defaultValue={String(reasons.length + 1)} className={`${inputCls} w-20`} /></label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" name="requiresDetail" className="size-4" /> {tb('Needs detail', 'يتطلب تفاصيل')}</label>
        <button className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">{tb('Add reason', 'إضافة سبب')}</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{tb('Label (EN)', 'التسمية (EN)')}</th>
              <th className="p-3 text-start">{tb('Label (AR)', 'التسمية (AR)')}</th>
              <th className="p-3">{tb('Order', 'الترتيب')}</th>
              <th className="p-3">{tb('Needs detail', 'يتطلب تفاصيل')}</th>
              <th className="p-3">{tb('Active', 'مُفعّل')}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {reasons.map((r) => (
              <tr key={r.id} className={`border-t border-border ${r.active ? '' : 'opacity-60'}`}>
                <td className="p-3">
                  <form id={`rr-${r.id}`} action={saveReturnReasonAction} className="hidden" />
                  <input form={`rr-${r.id}`} type="hidden" name="locale" value={locale} />
                  <input form={`rr-${r.id}`} type="hidden" name="id" value={r.id} />
                  <input form={`rr-${r.id}`} name="labelEn" defaultValue={r.labelEn} className={inputCls} />
                </td>
                <td className="p-3"><input form={`rr-${r.id}`} name="labelAr" defaultValue={r.labelAr} dir="rtl" className={inputCls} /></td>
                <td className="p-3 text-center"><input form={`rr-${r.id}`} name="sortOrder" type="number" defaultValue={r.sortOrder} className={`${inputCls} w-16`} /></td>
                <td className="p-3 text-center"><input form={`rr-${r.id}`} type="checkbox" name="requiresDetail" defaultChecked={r.requiresDetail} className="size-4" /></td>
                <td className="p-3 text-center">{r.active ? tb('Yes', 'نعم') : tb('No', 'لا')}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-3">
                    <button form={`rr-${r.id}`} className="text-primary hover:underline">{tb('Save', 'حفظ')}</button>
                    <form action={toggleReturnReasonAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="active" value={r.active ? 'false' : 'true'} />
                      <button className="text-muted-foreground hover:text-foreground">{r.active ? tb('Deactivate', 'إلغاء التفعيل') : tb('Activate', 'تفعيل')}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {reasons.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{tb('No reasons yet.', 'لا توجد أسباب بعد.')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
