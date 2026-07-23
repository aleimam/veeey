import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { CUSTOMER_METHODS, listSystemMethods, paymentDescriptions, paymentLogos } from '@/lib/payment-method-service';
import { Link } from '@/i18n/navigation';
import { saveSystemMethodAction, toggleSystemMethodAction, deleteSystemMethodAction, remapOrderPaymentsAction, savePaymentLogosAction } from '@/server/payment-actions';
import { SingleImageUploader } from '@/components/admin/image-uploader';
import { SubmitButton, inputCls } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const COURIERS = ['OWN', 'SMSA', 'ARAMEX'] as const;

export default async function PaymentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'settings.manage')) redirect({ href: '/admin', locale });

  const system = await listSystemMethods();
  // Show staff exactly what the shopper reads under each method — otherwise the
  // copy lives only in Settings and nobody checks it against the real list.
  const notes = await paymentDescriptions(locale);
  const logos = await paymentLogos();
  const customerOpts = CUSTOMER_METHODS.map((m) => ({ value: m.code, label: locale === 'ar' ? m.labelAr : m.labelEn }));

  const card = 'rounded-xl border border-border bg-card p-5';
  const banner = one(sp.saved)
    ? tb('Saved.', 'تم الحفظ.')
    : one(sp.logos) != null
      ? tb('Payment logos saved.', 'تم حفظ شعارات الدفع.')
      : one(sp.remapped) != null
        ? tb(`Re-mapped ${one(sp.remapped)} orders.`, `تم إعادة ربط ${one(sp.remapped)} طلب.`)
        : null;
  const courierLabel = (c: string | null) =>
    c === 'OWN' ? tb('Our Staff', 'مندوبنا') : c === 'SMSA' ? tb('SMSA', 'سمسا') : c === 'ARAMEX' ? tb('Aramex', 'أرامكس') : tb('— any —', '— أي —');

  const lbl = 'text-xs text-muted-foreground';

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold text-foreground">{tb('Payment methods', 'طرق الدفع')}</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{tb('Two levels: a fixed list the customer chooses from at checkout, and an editable system list (shown on invoices) that maps to it. Imported Egypt Vitamins methods are classified into the system list by their aliases.', 'مستويان: قائمة ثابتة يختار منها العميل عند الدفع، وقائمة نظام قابلة للتعديل (تظهر في الفاتورة) ترتبط بها. تُصنَّف طرق إيجيبت فيتامينز المستوردة في قائمة النظام حسب الأسماء البديلة.')}</p>

      {banner && <div className="mb-5 max-w-4xl rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{banner}</div>}
      {one(sp.error) === 'in_use' && <div className="mb-5 max-w-4xl rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('That method is used by orders — deactivate it instead of deleting.', 'هذه الطريقة مستخدمة في طلبات — عطّلها بدلًا من حذفها.')}</div>}
      {one(sp.error) === '1' && <div className="mb-5 max-w-4xl rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Action failed.', 'فشل الإجراء.')}</div>}

      <div className="grid max-w-4xl gap-5">
        {/* 1) Customer-facing (fixed) */}
        <section className={card}>
          <h2 className="mb-1 text-base font-semibold text-foreground">{tb('Customer-facing methods (fixed)', 'الطرق المعروضة للعميل (ثابتة)')}</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {tb('What the shopper selects at checkout. This list is fixed; POS on Delivery shows only in areas you enable for it (Shipping → zones → Allows POS).', 'ما يختاره العميل عند الدفع. هذه القائمة ثابتة؛ «الدفع بالبطاقة عند الاستلام» يظهر فقط في المناطق التي تفعّلها له (الشحن ← المناطق ← يسمح بالدفع بالبطاقة).')}{' '}
            <Link href="/admin/settings#Payments" className="font-medium text-primary hover:underline">
              {tb('Edit the descriptions →', 'تعديل الأوصاف ←')}
            </Link>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CUSTOMER_METHODS.map((m) => (
              <div key={m.code} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="font-medium text-foreground">{locale === 'ar' ? m.labelAr : m.labelEn}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{m.code}</span>
                  {m.online && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">{tb('Online', 'إلكتروني')} · {m.gateway}</span>}
                  {m.requiresPosArea && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-slate">{tb('Area-gated', 'حسب المنطقة')}</span>}
                </div>
                {notes[m.code] ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{notes[m.code]}</p>
                ) : (
                  <p className="mt-1.5 text-xs italic text-muted-foreground">{tb('No description — nothing shows under this method.', 'بدون وصف — لا يظهر شيء تحت هذه الطريقة.')}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 1b) Checkout logos — one uploadable image per customer method. */}
        <section className={card}>
          <h2 className="mb-1 text-base font-semibold text-foreground">{tb('Checkout logos', 'شعارات الدفع')}</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {tb(
              'The logo shown beside each method at checkout. Upload the official artwork (PNG/SVG, transparent background works best). For Mobile Wallet, upload a strip of the wallet logos you accept (Vodafone Cash, Orange Cash, Etisalat Flous, WE Pay). Leave one empty to show a plain type-icon instead.',
              'الشعار الذي يظهر بجانب كل طريقة عند الدفع. ارفع الشعار الرسمي (PNG/SVG، ويفضّل خلفية شفافة). لطريقة المحفظة، ارفع شريطًا يجمع شعارات المحافظ المقبولة (فودافون كاش، أورنچ كاش، اتصالات فلوس، WE Pay). اترك أي خانة فارغة لعرض أيقونة عامة بدلًا من الشعار.',
            )}
          </p>
          <form action={savePaymentLogosAction}>
            <input type="hidden" name="locale" value={locale} />
            <div className="grid gap-4 sm:grid-cols-2">
              {CUSTOMER_METHODS.map((m) => (
                <div key={m.code} className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-sm font-medium text-foreground">{locale === 'ar' ? m.labelAr : m.labelEn}</div>
                  {/* name = method code so the action maps each uploaded URL to its setting key. */}
                  <SingleImageUploader name={m.code} initial={logos[m.code] ?? ''} />
                </div>
              ))}
            </div>
            <div className="mt-4">
              <SubmitButton>{tb('Save logos', 'حفظ الشعارات')}</SubmitButton>
            </div>
          </form>
        </section>

        {/* 2) System methods (editable) */}
        <section className={card}>
          <h2 className="mb-1 text-base font-semibold text-foreground">{tb('System methods (invoice / mapping)', 'طرق النظام (الفاتورة / الربط)')}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{tb('The granular methods shown on invoices. Each maps to a customer-facing method. COD variants pick a courier; aliases (comma/newline-separated) classify imported orders.', 'الطرق التفصيلية التي تظهر في الفاتورة. كل واحدة ترتبط بطريقة معروضة للعميل. أنواع الدفع عند الاستلام تختار شركة شحن؛ الأسماء البديلة (مفصولة بفاصلة/سطر) تصنّف الطلبات المستوردة.')}</p>
          <div className="space-y-3">
            {system.map((m) => (
              <div key={m.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{m.code}</span>
                  <span className="text-xs text-muted-foreground">→ {customerOpts.find((c) => c.value === m.customerCode)?.label ?? m.customerCode}</span>
                  {m.courier && <span className="text-xs text-muted-foreground">· {courierLabel(m.courier)}</span>}
                  {!m.active && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs text-slate">{tb('Inactive', 'غير مفعّل')}</span>}
                </div>
                <form action={saveSystemMethodAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={m.id} />
                  <label className={lbl}>{tb('Label (EN)', 'الاسم (إنجليزي)')}<input name="labelEn" defaultValue={m.labelEn} className={`${inputCls} w-44`} /></label>
                  <label className={lbl}>{tb('Label (AR)', 'الاسم (عربي)')}<input name="labelAr" defaultValue={m.labelAr ?? ''} dir="rtl" className={`${inputCls} w-44`} /></label>
                  <label className={lbl}>{tb('Maps to', 'يرتبط بـ')}
                    <select name="customerCode" defaultValue={m.customerCode} className={`${inputCls} w-44`}>
                      {customerOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className={lbl}>{tb('Courier', 'شركة الشحن')}
                    <select name="courier" defaultValue={m.courier ?? ''} className={`${inputCls} w-32`}>
                      <option value="">{tb('— any —', '— أي —')}</option>
                      {COURIERS.map((c) => <option key={c} value={c}>{courierLabel(c)}</option>)}
                    </select>
                  </label>
                  <label className={lbl}>{tb('Order', 'الترتيب')}<input name="sortOrder" type="number" defaultValue={m.sortOrder} className={`${inputCls} w-16`} /></label>
                  <label className={`${lbl} w-full`}>{tb('Import aliases (comma / newline)', 'الأسماء البديلة للاستيراد (فاصلة / سطر)')}<textarea name="sourceAliases" defaultValue={m.sourceAliases.join(', ')} rows={2} className={`${inputCls} w-full font-mono text-xs`} /></label>
                  <label className="flex items-center gap-1.5 text-xs text-foreground"><input type="checkbox" name="active" defaultChecked={m.active} className="size-4" /> {tb('Active', 'مفعّل')}</label>
                  <SubmitButton>{tb('Save', 'حفظ')}</SubmitButton>
                </form>
                <div className="mt-2 flex gap-3">
                  <form action={toggleSystemMethodAction}>
                    <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={m.id} /><input type="hidden" name="active" value={m.active ? '0' : '1'} />
                    <button className="text-xs text-primary hover:underline">{m.active ? tb('Deactivate', 'تعطيل') : tb('Activate', 'تفعيل')}</button>
                  </form>
                  <form action={deleteSystemMethodAction}>
                    <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={m.id} />
                    <button className="text-xs text-destructive hover:underline">{tb('Delete', 'حذف')}</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Add a system method */}
        <section className={card}>
          <h2 className="mb-3 text-base font-semibold text-foreground">{tb('Add a system method', 'إضافة طريقة نظام')}</h2>
          <form action={saveSystemMethodAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <label className={lbl}>{tb('Code', 'الرمز')}<input name="code" required placeholder="E.G. BANK_QNB" className={`${inputCls} w-40 font-mono`} /></label>
            <label className={lbl}>{tb('Label (EN)', 'الاسم (إنجليزي)')}<input name="labelEn" required className={`${inputCls} w-44`} /></label>
            <label className={lbl}>{tb('Label (AR)', 'الاسم (عربي)')}<input name="labelAr" dir="rtl" className={`${inputCls} w-44`} /></label>
            <label className={lbl}>{tb('Maps to', 'يرتبط بـ')}
              <select name="customerCode" required defaultValue="" className={`${inputCls} w-44`}>
                <option value="" disabled>{tb('— choose —', '— اختر —')}</option>
                {customerOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className={lbl}>{tb('Courier', 'شركة الشحن')}
              <select name="courier" defaultValue="" className={`${inputCls} w-32`}>
                <option value="">{tb('— any —', '— أي —')}</option>
                {COURIERS.map((c) => <option key={c} value={c}>{courierLabel(c)}</option>)}
              </select>
            </label>
            <label className={lbl}>{tb('Order', 'الترتيب')}<input name="sortOrder" type="number" defaultValue={20} className={`${inputCls} w-16`} /></label>
            <label className={`${lbl} w-full`}>{tb('Import aliases (comma / newline)', 'الأسماء البديلة للاستيراد (فاصلة / سطر)')}<textarea name="sourceAliases" rows={2} placeholder="qnb, bank_qnb" className={`${inputCls} w-full font-mono text-xs`} /></label>
            <input type="hidden" name="active" value="on" />
            <SubmitButton>{tb('Add', 'إضافة')}</SubmitButton>
          </form>
        </section>

        {/* Re-map imported orders */}
        <section className={card}>
          <h2 className="mb-1 text-base font-semibold text-foreground">{tb('Re-map imported orders', 'إعادة ربط الطلبات المستوردة')}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{tb('Re-classify every imported Egypt Vitamins order by the current aliases above. Orders keep their original source value, so you can re-map any time after editing aliases.', 'إعادة تصنيف كل طلب مستورد من إيجيبت فيتامينز حسب الأسماء البديلة أعلاه. تحتفظ الطلبات بقيمتها الأصلية فيمكنك إعادة الربط في أي وقت بعد تعديل الأسماء.')}</p>
          <form action={remapOrderPaymentsAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">{tb('Re-map imported orders now', 'إعادة ربط الطلبات المستوردة الآن')}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
