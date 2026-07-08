import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/prisma';
import { getCustomerAdmin } from '@/lib/customer-admin-service';
import { saveCustomerDetailsAction, saveCustomerAddressAction, deleteCustomerAddressAction } from '@/server/customer-admin-actions';
import { formatEGP } from '@/lib/format';
import { GOVERNORATES } from '@/lib/governorates';
import { StatusBadge, Field, inputCls } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const cell = 'p-2 align-top';

export default async function CustomerProfilePage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<SP> }) {
  // Page-level RBAC (matches the sidebar's permission key) — the sidebar only
  // HIDES the link; without this any staffer with one permission could read it.
  await requirePermission('customers.read');
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const [c, tiers] = await Promise.all([getCustomerAdmin(id), prisma.tier.findMany({ orderBy: { rank: 'asc' } })]);
  if (!c) notFound();
  const error = one(sp.error);

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
      {error === 'email_taken' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('That email is already used by another account.', 'هذا البريد مستخدم بحساب آخر.')}</p>}
      {error === 'address_in_use' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('This address is used by past orders — it cannot be deleted.', 'هذا العنوان مستخدم في طلبات سابقة — لا يمكن حذفه.')}</p>}
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
          <Field label={tb('Tier', 'الفئة')}>
            <select name="tierId" defaultValue={c.tierId ?? ''} className={inputCls}>
              <option value="">{tb('— None —', '— بدون —')}</option>
              {tiers.map((t) => <option key={t.id} value={t.id}>{t.nameEn}</option>)}
            </select>
          </Field>
          <div className="flex items-end">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Save details', 'حفظ البيانات')}</button>
          </div>
        </form>
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
    </div>
  );
}
