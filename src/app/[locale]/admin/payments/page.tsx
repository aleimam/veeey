import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { listPaymentMethods, getPaymentMap } from '@/lib/payment-method-service';
import { savePaymentMethodAction, togglePaymentMethodAction, deletePaymentMethodAction, savePaymentMapAction, remapOrderPaymentsAction } from '@/server/payment-actions';
import { SubmitButton, inputCls } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PaymentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'settings.manage')) redirect({ href: '/admin', locale });

  const [methods, map] = await Promise.all([listPaymentMethods(), getPaymentMap()]);
  const methodOpts = methods.map((m) => ({ value: m.code, label: `${m.labelEn} (${m.code})` }));
  const mapRows = [...Object.entries(map), ['', ''], ['', '']]; // existing + 2 blanks

  const card = 'rounded-xl border border-border bg-card p-5';
  const banner = one(sp.saved) ? tb('Saved.', 'تم الحفظ.') : one(sp.remapped) != null ? tb(`Re-mapped ${one(sp.remapped)} orders.`, `تم إعادة ربط ${one(sp.remapped)} طلب.`) : null;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold text-foreground">{tb('Payment methods', 'طرق الدفع')}</h1>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">{tb('The methods customers can choose at checkout. Methods used by an order can be deactivated or edited but not deleted. New methods are offline/manual; the online card method (Kashier) is built in.', 'الطرق المتاحة للعملاء عند الدفع. الطرق المستخدمة في طلب يمكن تعطيلها أو تعديلها لا حذفها. الطرق الجديدة يدوية/عند الاستلام؛ بطاقة الدفع الإلكترونية (Kashier) مدمجة.')}</p>

      {banner && <div className="mb-5 max-w-3xl rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{banner}</div>}
      {one(sp.error) === 'in_use' && <div className="mb-5 max-w-3xl rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('That method is used by orders — deactivate it instead of deleting.', 'هذه الطريقة مستخدمة في طلبات — عطّلها بدلًا من حذفها.')}</div>}
      {one(sp.error) === '1' && <div className="mb-5 max-w-3xl rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Action failed.', 'فشل الإجراء.')}</div>}

      <div className="grid max-w-3xl gap-5">
        {/* Existing methods */}
        <section className={card}>
          <h2 className="mb-3 text-base font-semibold text-foreground">{tb('Methods', 'الطرق')}</h2>
          <div className="space-y-3">
            {methods.map((m) => (
              <div key={m.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{m.code}</span>
                  <span className="text-xs text-muted-foreground">{m.kind === 'CARD_GATEWAY' ? tb('Online card', 'بطاقة إلكترونية') : tb('Offline', 'يدوي')}</span>
                  {!m.active && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs text-slate">{tb('Inactive', 'غير مفعّل')}</span>}
                </div>
                <form action={savePaymentMethodAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={m.id} />
                  <label className="text-xs text-muted-foreground">{tb('Label (EN)', 'الاسم (إنجليزي)')}<input name="labelEn" defaultValue={m.labelEn} className={`${inputCls} w-48`} /></label>
                  <label className="text-xs text-muted-foreground">{tb('Label (AR)', 'الاسم (عربي)')}<input name="labelAr" defaultValue={m.labelAr ?? ''} dir="rtl" className={`${inputCls} w-48`} /></label>
                  <label className="text-xs text-muted-foreground">{tb('Order', 'الترتيب')}<input name="sortOrder" type="number" defaultValue={m.sortOrder} className={`${inputCls} w-20`} /></label>
                  <label className="flex items-center gap-1.5 text-xs text-foreground"><input type="checkbox" name="active" defaultChecked={m.active} className="size-4" /> {tb('Active', 'مفعّل')}</label>
                  <SubmitButton>{tb('Save', 'حفظ')}</SubmitButton>
                </form>
                <div className="mt-2 flex gap-3">
                  <form action={togglePaymentMethodAction}>
                    <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={m.id} /><input type="hidden" name="active" value={m.active ? '0' : '1'} />
                    <button className="text-xs text-primary hover:underline">{m.active ? tb('Deactivate', 'تعطيل') : tb('Activate', 'تفعيل')}</button>
                  </form>
                  <form action={deletePaymentMethodAction}>
                    <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={m.id} />
                    <button className="text-xs text-destructive hover:underline">{tb('Delete', 'حذف')}</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* New method */}
        <section className={card}>
          <h2 className="mb-1 text-base font-semibold text-foreground">{tb('Add a method', 'إضافة طريقة')}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{tb('New methods are offline (settle on delivery or by manual confirmation).', 'الطرق الجديدة يدوية (تسوية عند الاستلام أو تأكيد يدوي).')}</p>
          <form action={savePaymentMethodAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <label className="text-xs text-muted-foreground">{tb('Code', 'الرمز')}<input name="code" required placeholder="E.G. INSTAPAY" className={`${inputCls} w-40 font-mono`} /></label>
            <label className="text-xs text-muted-foreground">{tb('Label (EN)', 'الاسم (إنجليزي)')}<input name="labelEn" required className={`${inputCls} w-48`} /></label>
            <label className="text-xs text-muted-foreground">{tb('Label (AR)', 'الاسم (عربي)')}<input name="labelAr" dir="rtl" className={`${inputCls} w-48`} /></label>
            <label className="text-xs text-muted-foreground">{tb('Order', 'الترتيب')}<input name="sortOrder" type="number" defaultValue={10} className={`${inputCls} w-20`} /></label>
            <input type="hidden" name="active" value="on" />
            <SubmitButton>{tb('Add', 'إضافة')}</SubmitButton>
          </form>
        </section>

        {/* Old → new mapping (WooCommerce) */}
        <section className={card}>
          <h2 className="mb-1 text-base font-semibold text-foreground">{tb('Map old payment names (Egypt Vitamins)', 'ربط أسماء الدفع القديمة (إيجيبت فيتامينز)')}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{tb('Map each WooCommerce payment_method to a Veeey method. Applied on every sync; use “Re-map imported orders” to apply to orders already imported.', 'اربط كل طريقة دفع من ووكومرس بطريقة في Veeey. تُطبَّق في كل مزامنة؛ استخدم «إعادة ربط الطلبات» لتطبيقها على الطلبات المستوردة.')}</p>
          <form action={savePaymentMapAction} className="space-y-2">
            <input type="hidden" name="locale" value={locale} />
            {mapRows.map(([wc, code], i) => (
              <div key={i} className="flex items-center gap-2">
                <input name="wc" defaultValue={wc} placeholder={tb('woo code (e.g. cod, paymob)', 'رمز ووكومرس')} className={`${inputCls} w-56 font-mono text-xs`} />
                <span className="text-muted-foreground">→</span>
                <select name="method" defaultValue={code} className={`${inputCls} w-56`}>
                  <option value="">{tb('— ignore —', '— تجاهل —')}</option>
                  {methodOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
            <SubmitButton>{tb('Save mapping', 'حفظ الربط')}</SubmitButton>
          </form>
          <form action={remapOrderPaymentsAction} className="mt-3 border-t border-border pt-3">
            <input type="hidden" name="locale" value={locale} />
            <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">{tb('Re-map imported orders now', 'إعادة ربط الطلبات المستوردة الآن')}</button>
            <span className="ms-2 text-xs text-muted-foreground">{tb('(orders keep their original source value for re-mapping)', '(تحتفظ الطلبات بقيمتها الأصلية لإعادة الربط)')}</span>
          </form>
        </section>
      </div>
    </div>
  );
}
