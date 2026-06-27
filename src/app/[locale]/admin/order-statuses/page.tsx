import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { CUSTOMER_STATUSES, ORDER_STATUSES } from '@/lib/order-status';
import { listStatusConfigs } from '@/lib/order-status-service';
import { saveStatusConfigAction, remapOrderStatusesAction } from '@/server/order-status-actions';
import { SubmitButton, inputCls } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const STOCK = ['none', 'restock'];
const PAYMENT = ['none', 'paid', 'refunded'];
const REVENUE = ['none', 'realize', 'reverse'];
const LOYALTY = ['none', 'credit', 'reverse'];
const AUDIENCE = ['none', 'customer', 'staff', 'both'];

export default async function OrderStatusesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'settings.manage')) redirect({ href: '/admin', locale });

  const statuses = await listStatusConfigs();
  const lbl = 'text-xs text-muted-foreground';
  const card = 'rounded-xl border border-border bg-card p-5';
  const banner = one(sp.saved) ? tb('Saved.', 'تم الحفظ.') : one(sp.remapped) != null ? tb(`Re-mapped ${one(sp.remapped)} orders.`, `تم إعادة ربط ${one(sp.remapped)} طلب.`) : null;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold text-foreground">{tb('Order statuses', 'حالات الطلب')}</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{tb('The 8 internal statuses are fixed; their behavior is editable — what the customer sees, the icon, the effects (stock / payment / revenue / loyalty / notify), the allowed next steps, and the import aliases. EDIT keeps the customer on the previous status.', 'الحالات الداخلية الثماني ثابتة؛ سلوكها قابل للتعديل — ما يراه العميل، الأيقونة، التأثيرات (المخزون / الدفع / الإيراد / النقاط / الإشعار)، الخطوات التالية المسموح بها، وأسماء الاستيراد البديلة. حالة «تعديل» تُبقي العميل على الحالة السابقة.')}</p>

      {banner && <div className="mb-5 max-w-5xl rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{banner}</div>}
      {one(sp.error) === '1' && <div className="mb-5 max-w-5xl rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Action failed.', 'فشل الإجراء.')}</div>}

      <div className="grid max-w-5xl gap-4">
        {statuses.map((s) => (
          <section key={s.code} className={card}>
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{s.code}</span>
              {s.isDefault && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{tb('Default', 'افتراضي')}</span>}
              {!s.active && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs text-slate">{tb('Inactive', 'غير مفعّل')}</span>}
            </div>
            <form action={saveStatusConfigAction} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="code" value={s.code} />
              <label className={lbl}>{tb('Label (EN)', 'الاسم (إنجليزي)')}<input name="labelEn" defaultValue={s.labelEn} className={`${inputCls} w-full`} /></label>
              <label className={lbl}>{tb('Label (AR)', 'الاسم (عربي)')}<input name="labelAr" defaultValue={s.labelAr ?? ''} dir="rtl" className={`${inputCls} w-full`} /></label>
              <label className={lbl}>{tb('Customer sees', 'يراه العميل')}
                <select name="customerCode" defaultValue={s.customerCode ?? ''} className={`${inputCls} w-full`}>
                  <option value="">{tb('— none (keep previous) —', '— لا شيء (إبقاء السابقة) —')}</option>
                  {CUSTOMER_STATUSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className={lbl}>{tb('Icon (Lucide)', 'الأيقونة')}<input name="icon" defaultValue={s.icon} className={`${inputCls} w-full font-mono`} /></label>
              <label className={lbl}>{tb('Stock', 'المخزون')}
                <select name="stockEffect" defaultValue={s.stockEffect} className={`${inputCls} w-full`}>{STOCK.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              </label>
              <label className={lbl}>{tb('Payment', 'الدفع')}
                <select name="paymentEffect" defaultValue={s.paymentEffect} className={`${inputCls} w-full`}>{PAYMENT.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              </label>
              <label className={lbl}>{tb('Revenue', 'الإيراد')}
                <select name="revenueEffect" defaultValue={s.revenueEffect} className={`${inputCls} w-full`}>{REVENUE.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              </label>
              <label className={lbl}>{tb('Loyalty', 'النقاط')}
                <select name="loyaltyEffect" defaultValue={s.loyaltyEffect} className={`${inputCls} w-full`}>{LOYALTY.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              </label>
              <label className={lbl}>{tb('Notify', 'الإشعار')}
                <select name="notifyAudience" defaultValue={s.notifyAudience} className={`${inputCls} w-full`}>{AUDIENCE.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              </label>
              <label className={lbl}>{tb('Notify template key', 'مفتاح قالب الإشعار')}<input name="notifyTemplateKey" defaultValue={s.notifyTemplateKey ?? ''} className={`${inputCls} w-full font-mono`} /></label>
              <label className={lbl}>{tb('Sort', 'الترتيب')}<input name="sortOrder" type="number" defaultValue={s.sortOrder} className={`${inputCls} w-full`} /></label>
              <label className="flex items-end gap-1.5 pb-2 text-xs text-foreground"><input type="checkbox" name="active" defaultChecked={s.active} className="size-4" /> {tb('Active', 'مفعّل')}</label>
              <div className={`${lbl} sm:col-span-2 lg:col-span-2`}>{tb('Allowed next', 'الخطوات التالية المسموح بها')}
                <div className="mt-1 flex flex-wrap gap-2">
                  {ORDER_STATUSES.filter((c) => c !== s.code).map((c) => (
                    <label key={c} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground">
                      <input type="checkbox" name="allowedNext" value={c} defaultChecked={s.allowedNext.includes(c)} className="size-3.5" /> {c}
                    </label>
                  ))}
                </div>
              </div>
              <label className={`${lbl} sm:col-span-2 lg:col-span-2`}>{tb('Import aliases (comma / newline)', 'أسماء الاستيراد البديلة (فاصلة / سطر)')}
                <textarea name="sourceAliases" defaultValue={s.sourceAliases.join(', ')} rows={2} className={`${inputCls} w-full font-mono text-xs`} />
              </label>
              <div className="sm:col-span-2 lg:col-span-4"><SubmitButton>{tb('Save', 'حفظ')}</SubmitButton></div>
            </form>
          </section>
        ))}

        <section className={card}>
          <h2 className="mb-1 text-base font-semibold text-foreground">{tb('Re-map imported orders', 'إعادة ربط الطلبات المستوردة')}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{tb('Re-classify every imported order by the current aliases above. Orders keep their original source status for re-mapping.', 'إعادة تصنيف كل طلب مستورد حسب الأسماء البديلة أعلاه. تحتفظ الطلبات بحالتها الأصلية لإعادة الربط.')}</p>
          <form action={remapOrderStatusesAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">{tb('Re-map imported orders now', 'إعادة ربط الطلبات المستوردة الآن')}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
