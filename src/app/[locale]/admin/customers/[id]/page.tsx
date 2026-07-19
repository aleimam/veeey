import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/prisma';
import { getCustomerAdmin } from '@/lib/customer-admin-service';
import { uncreditedOrderCount, listLoyaltyTransactions } from '@/lib/loyalty-service';
import { saveCustomerDetailsAction, saveCustomerStandingAction, saveCustomerAddressAction, deleteCustomerAddressAction, eraseCustomerAnalyticsAction } from '@/server/customer-admin-actions';
import { adjustPointsAction, backfillCustomerPointsAction } from '@/server/loyalty-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { formatEGP } from '@/lib/format';
import { GOVERNORATES } from '@/lib/governorates';
import { StatusBadge, Field, inputCls } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const cell = 'p-2 align-top';

export default async function CustomerProfilePage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<SP> }) {
  // Page-level RBAC (matches the sidebar's permission key) — the sidebar only
  // HIDES the link; without this any staffer with one permission could read it.
  const user = await requirePermission('customers.read');
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const [c, tiers] = await Promise.all([getCustomerAdmin(id), prisma.tier.findMany({ orderBy: { rank: 'asc' } })]);
  if (!c) notFound();
  const [uncredited, loyaltyTxns] = await Promise.all([uncreditedOrderCount(id), listLoyaltyTransactions(id)]);
  const error = one(sp.error);
  const canManagePoints = hasPermission(user.permissions, 'pricing.manage');

  const govSelect = (name: string, form: string | undefined, defaultValue: string) => (
    <select name={name} form={form} defaultValue={defaultValue} required className={`${inputCls} min-w-36`}>
      <option value="" disabled>—</option>
      {GOVERNORATES.map((g) => <option key={g.en} value={g.en}>{locale === 'ar' ? g.ar : g.en}</option>)}
    </select>
  );

  return (
    <div className="p-6">
      <Link href="/admin/customers" className="text-sm text-primary hover:underline">← {tb('Customers', 'العملاء')}</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">
          {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.user.name || c.user.email || tb('Customer', 'عميل')}
        </h1>
        <div className="text-sm text-muted-foreground">
          {c.tier ? `${c.tier.nameEn} · ` : ''}{c.pointsBalance.toLocaleString('en-US')} {tb('pts', 'نقطة')} · {formatEGP(Number(c.lifetimeSpendPiastres))} {tb('lifetime', 'إجمالي')}
        </div>
      </div>

      {one(sp.saved) === '1' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Saved.', 'تم الحفظ.')}</p>}
      {one(sp.analytics_erased) === '1' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Analytics data erased for this customer.', 'تم مسح بيانات التحليلات لهذا العميل.')}</p>}
      {error === 'email_taken' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('That email is already used by another account.', 'هذا البريد مستخدم بحساب آخر.')}</p>}
      {error === 'address_in_use' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('This address is used by past orders — it cannot be deleted.', 'هذا العنوان مستخدم في طلبات سابقة — لا يمكن حذفه.')}</p>}
      {error === 'pts_insufficient' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Not enough points to deduct that amount.', 'النقاط غير كافية لخصم هذا المقدار.')}</p>}
      {error === 'pts_bad' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Enter a valid points amount.', 'أدخل مقدار نقاط صالحًا.')}</p>}
      {one(sp.backfilled) != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Credited ${one(sp.pts)} points across ${one(sp.backfilled)} past order(s).`, `تم منح ${one(sp.pts)} نقطة عبر ${one(sp.backfilled)} طلب سابق.`)}</p>}
      {error === '1' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not save.', 'تعذّر الحفظ.')}</p>}

      {/* Details */}
      <section className="mb-8 max-w-3xl">
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Details', 'البيانات')}</h2>
        <form action={saveCustomerDetailsAction} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={c.id} />
          <Field label={tb('First name', 'الاسم الأول')}><input name="firstName" defaultValue={c.firstName ?? ''} className={inputCls} /></Field>
          <Field label={tb('Last name', 'اسم العائلة')}><input name="lastName" defaultValue={c.lastName ?? ''} className={inputCls} /></Field>
          <Field label={tb('Email', 'البريد الإلكتروني')} hint={tb('Used for login — must stay unique.', 'يُستخدم للدخول — يجب أن يبقى فريدًا.')}><input name="email" type="email" defaultValue={c.user.email ?? ''} className={inputCls} /></Field>
          <Field label={tb('Primary phone', 'الهاتف الأساسي')} hint={tb('Extra numbers live on the addresses below.', 'الأرقام الإضافية على العناوين أدناه.')}><input name="phone" defaultValue={c.user.phone ?? ''} className={inputCls} /></Field>
          <Field label={tb('Tier', 'الفئة')} hint={tb('Without the lock below, spend-based auto-tiering overrides this pick.', 'دون القفل أدناه، الترقية التلقائية حسب الإنفاق تتجاوز هذا الاختيار.')}>
            <select name="tierId" defaultValue={c.tierId ?? ''} className={inputCls}>
              <option value="">{tb('— None —', '— بدون —')}</option>
              {tiers.map((t) => <option key={t.id} value={t.id}>{t.nameEn}</option>)}
            </select>
          </Field>
          {/* Manual/paid tier lock: freezes the tier against auto-recompute + the
              hourly customer sync. Paid membership = lock + until ≈ 1 year out. */}
          <Field
            label={tb('Lock tier (manual / paid membership)', 'قفل الفئة (يدوي / عضوية مدفوعة)')}
            hint={tb('Until empty = indefinite. For a paid SELECT year, set Until to +1 year.', 'ترك "حتى" فارغًا = دائم. لعضوية SELECT المدفوعة، حدّد "حتى" بعد سنة.')}
          >
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="tierManual" defaultChecked={c.tierManual} className="size-4 accent-primary" />
                {tb('Locked', 'مقفلة')}
              </label>
              <input
                type="date"
                name="tierManualUntil"
                defaultValue={c.tierManualUntil ? c.tierManualUntil.toISOString().slice(0, 10) : ''}
                aria-label={tb('Locked until', 'مقفلة حتى')}
                className={inputCls}
              />
            </div>
          </Field>
          <div className="flex items-end">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Save details', 'حفظ البيانات')}</button>
          </div>
        </form>
      </section>

      {/* Standing, marketing & notes (V5 F31/F35) */}
      <section className="mb-8 max-w-3xl">
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Standing & marketing', 'الحالة والتسويق')}</h2>
        <form action={saveCustomerStandingAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={c.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tb('Account status', 'حالة الحساب')} hint={tb('Blocked customers cannot place orders.', 'العملاء المحظورون لا يمكنهم إتمام الطلبات.')}>
              <select name="status" defaultValue={c.status} className={inputCls}>
                <option value="ACTIVE">{tb('Active', 'نشط')}</option>
                <option value="FLAGGED">{tb('Flagged (suspicious)', 'مُعلَّم (مشتبه به)')}</option>
                <option value="BLOCKED">{tb('Blocked', 'محظور')}</option>
              </select>
            </Field>
            <div className="text-sm">
              <div className="mb-1 font-medium">{tb('Verification', 'التحقق')}</div>
              <p className="text-muted-foreground">
                {tb('Email:', 'البريد:')} {c.user.emailVerified ? `✓ ${new Date(c.user.emailVerified).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB')}` : tb('not verified', 'غير مؤكد')}
                <br />
                {tb('Phone:', 'الهاتف:')} {c.user.phoneVerified ? `✓ ${new Date(c.user.phoneVerified).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB')}` : tb('not verified', 'غير مؤكد')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="marketingConsent" defaultChecked={c.marketingConsent} className="size-4" /> {tb('Email marketing consent', 'موافقة التسويق بالبريد')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="marketingSmsConsent" defaultChecked={c.marketingSmsConsent} className="size-4" /> {tb('SMS marketing consent', 'موافقة التسويق بالرسائل')}</label>
          </div>
          <Field label={tb('Internal notes', 'ملاحظات داخلية')} hint={tb('Visible to staff only — never shown to the customer.', 'مرئية للموظفين فقط — لا تظهر للعميل أبدًا.')}>
            <textarea name="adminNotes" defaultValue={c.adminNotes ?? ''} rows={3} className={`${inputCls} min-h-20`} />
          </Field>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Save standing', 'حفظ الحالة')}</button>
        </form>
      </section>

      {/* Loyalty points (V5 follow-up) */}
      <section className="mb-8 max-w-3xl">
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Loyalty points', 'نقاط الولاء')}</h2>
        <div className="rounded-lg border border-border p-4">
          <p className="mb-4 text-sm">
            <span className="text-2xl font-semibold text-foreground">{c.pointsBalance.toLocaleString('en-US')}</span> <span className="text-muted-foreground">{tb('points', 'نقطة')}</span>
          </p>

          {canManagePoints ? (
            <>
              <form action={adjustPointsAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="customerId" value={c.id} />
                <Field label={tb('Amount', 'المقدار')}><input name="amount" type="number" min={1} required className={`${inputCls} w-28`} /></Field>
                <Field label={tb('Note (optional)', 'ملاحظة (اختياري)')}><input name="note" placeholder={tb('reason…', 'السبب…')} className={`${inputCls} w-56`} /></Field>
                <button name="op" value="add" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Add points', 'إضافة نقاط')}</button>
                <button name="op" value="deduct" className="rounded-md border border-border px-4 py-2 text-sm text-destructive hover:bg-surface">{tb('Deduct', 'خصم')}</button>
              </form>

              {uncredited > 0 && (
                <form action={backfillCustomerPointsAction} className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="customerId" value={c.id} />
                  <span className="text-sm text-muted-foreground">{tb(`${uncredited} past delivered order(s) never earned points.`, `${uncredited} طلب مُسلَّم سابق لم يكسب نقاطًا.`)}</span>
                  <ConfirmButton warn={tb(`Credit points for ${uncredited} past order(s)? This cannot be undone.`, `منح نقاط عن ${uncredited} طلب سابق؟ لا يمكن التراجع.`)} className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10">
                    {tb('Credit points for past orders', 'منح نقاط عن الطلبات السابقة')}
                  </ConfirmButton>
                </form>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{tb('You do not have permission to change points.', 'ليست لديك صلاحية تعديل النقاط.')}</p>
          )}

          {loyaltyTxns.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{tb('Recent activity', 'أحدث النشاط')}</p>
              <ul className="space-y-1 text-sm">
                {loyaltyTxns.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      <span className={t.points >= 0 ? 'font-medium text-primary' : 'font-medium text-destructive'}>{t.points >= 0 ? '+' : ''}{t.points}</span>
                      {' '}· {t.type}{t.order ? ` · #${t.order.number}` : ''}{t.note ? ` · ${t.note}` : ''}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Addresses */}
      <section className="mb-8">
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Addresses', 'العناوين')} ({c.addresses.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground">
              <tr>
                <th className={`${cell} text-start`}>{tb('Governorate', 'المحافظة')}</th>
                <th className={`${cell} text-start`}>{tb('City', 'المدينة')}</th>
                <th className={`${cell} text-start`}>{tb('Area', 'المنطقة')}</th>
                <th className={`${cell} text-start`}>{tb('Street', 'الشارع')}</th>
                <th className={`${cell} text-start`}>{tb('Building', 'المبنى')}</th>
                <th className={`${cell} text-start`}>{tb('Phone', 'الهاتف')}</th>
                <th className={`${cell} text-center`}>{tb('Default', 'افتراضي')}</th>
                <th className={cell} />
              </tr>
            </thead>
            <tbody>
              {c.addresses.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className={cell}>{govSelect('governorate', `addr-${a.id}`, a.governorate)}</td>
                  <td className={cell}><input form={`addr-${a.id}`} name="city" defaultValue={a.city} required className={`${inputCls} w-28`} /></td>
                  <td className={cell}><input form={`addr-${a.id}`} name="area" defaultValue={a.area} className={`${inputCls} w-28`} /></td>
                  <td className={cell}><input form={`addr-${a.id}`} name="street" defaultValue={a.street ?? ''} className={`${inputCls} w-40`} /></td>
                  <td className={cell}><input form={`addr-${a.id}`} name="building" defaultValue={a.building ?? ''} className={`${inputCls} w-24`} /></td>
                  <td className={cell}><input form={`addr-${a.id}`} name="phone" defaultValue={a.phone ?? ''} className={`${inputCls} w-32`} /></td>
                  <td className={`${cell} text-center`}><input form={`addr-${a.id}`} type="checkbox" name="isDefaultShipping" defaultChecked={a.isDefaultShipping} className="size-4" /></td>
                  <td className={cell}>
                    <div className="flex items-center gap-2">
                      <form id={`addr-${a.id}`} action={saveCustomerAddressAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="customerId" value={c.id} />
                        <input type="hidden" name="addressId" value={a.id} />
                        <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">{tb('Save', 'حفظ')}</button>
                      </form>
                      <form action={deleteCustomerAddressAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="customerId" value={c.id} />
                        <input type="hidden" name="addressId" value={a.id} />
                        <button className="text-xs text-destructive hover:underline">{tb('Delete', 'حذف')}</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {c.addresses.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">{tb('No saved addresses yet.', 'لا توجد عناوين محفوظة بعد.')}</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface/50">
                <td className={cell}>{govSelect('governorate', 'addr-new', '')}</td>
                <td className={cell}><input form="addr-new" name="city" placeholder={tb('City', 'المدينة')} required className={`${inputCls} w-28`} /></td>
                <td className={cell}><input form="addr-new" name="area" placeholder={tb('Area', 'المنطقة')} className={`${inputCls} w-28`} /></td>
                <td className={cell}><input form="addr-new" name="street" placeholder={tb('Street', 'الشارع')} className={`${inputCls} w-40`} /></td>
                <td className={cell}><input form="addr-new" name="building" placeholder={tb('Building', 'المبنى')} className={`${inputCls} w-24`} /></td>
                <td className={cell}><input form="addr-new" name="phone" placeholder={tb('Phone', 'الهاتف')} className={`${inputCls} w-32`} /></td>
                <td className={`${cell} text-center`}><input form="addr-new" type="checkbox" name="isDefaultShipping" className="size-4" /></td>
                <td className={cell}>
                  <form id="addr-new" action={saveCustomerAddressAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="customerId" value={c.id} />
                    <button className="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10">{tb('Add address', 'إضافة عنوان')}</button>
                  </form>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Recent orders */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Recent orders', 'أحدث الطلبات')}</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-start">{tb('Number', 'الرقم')}</th>
                <th className="p-3 text-start">{tb('Date', 'التاريخ')}</th>
                <th className="p-3 text-start">{tb('Status', 'الحالة')}</th>
                <th className="p-3 text-start">{tb('Total', 'الإجمالي')}</th>
              </tr>
            </thead>
            <tbody>
              {c.orders.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="font-medium text-primary hover:underline">{o.number}</Link></td>
                  <td className="p-3 text-muted-foreground">{new Date(o.placedAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB')}</td>
                  <td className="p-3"><StatusBadge status={o.status} /></td>
                  <td className="p-3">{formatEGP(Number(o.totalPiastres))}</td>
                </tr>
              ))}
              {c.orders.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{tb('No orders yet.', 'لا توجد طلبات بعد.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Privacy / data (DSAR) */}
      <section className="mt-8 max-w-3xl">
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Privacy & data', 'الخصوصية والبيانات')}</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="text-sm">
            <div className="font-medium text-foreground">{tb('Erase analytics data', 'مسح بيانات التحليلات')}</div>
            <div className="text-muted-foreground">{tb('Delete this customer’s first-party browsing sessions + events (for a data-deletion request). Orders are not affected.', 'حذف جلسات وأحداث التصفّح الخاصة بهذا العميل (لطلب حذف البيانات). لا يؤثّر على الطلبات.')}</div>
          </div>
          <form action={eraseCustomerAnalyticsAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="customerId" value={c.id} />
            <ConfirmButton
              warn={tb('Erase all analytics data for this customer? This cannot be undone.', 'مسح كل بيانات التحليلات لهذا العميل؟ لا يمكن التراجع.')}
              className="rounded-md border border-destructive px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              {tb('Erase analytics data', 'مسح بيانات التحليلات')}
            </ConfirmButton>
          </form>
        </div>
      </section>
    </div>
  );
}
