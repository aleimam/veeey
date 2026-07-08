'use client';

import { useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { createManualOrderAction } from '@/server/order-actions';
import { searchCustomersAction, quickCreateCustomerAction } from '@/server/customer-admin-actions';
import type { CustomerHit } from '@/lib/customer-admin-service';
import type { AdminFormState } from '@/server/admin-actions';
import { useActionState } from 'react';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { ProductLinePicker } from './order-item-picker';
import { GOVERNORATES } from '@/lib/governorates';
import { pick } from '@/lib/admin-i18n';

type Opt = { value: string; label: string };
type GiftOpt = { value: string; label: string; stock: number };

const addrLabel = (a: CustomerHit['addresses'][number]) =>
  [a.governorate, a.city, a.area, a.street].filter(Boolean).join(' · ');

export function ManualOrderForm({
  locale,
  shippingTypes,
  paymentMethods,
  channels,
  gifts = [],
  depositPercent = 25,
}: {
  locale: string;
  shippingTypes: Opt[];
  paymentMethods: Opt[];
  channels: Opt[];
  gifts?: GiftOpt[];
  depositPercent?: number;
}) {
  const tb = pick(useLocale());
  const [state, action] = useActionState<AdminFormState, FormData>(createManualOrderAction, {});
  const [rows, setRows] = useState<number[]>([0]);
  const [seq, setSeq] = useState(1);
  const [giftRows, setGiftRows] = useState<number[]>([]);

  // ---- Customer picker ------------------------------------------------------
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [selected, setSelected] = useState<CustomerHit | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [nc, setNc] = useState({ name: '', phone: '', email: '' });
  const [createErr, setCreateErr] = useState('');
  const [busy, setBusy] = useState(false);
  const searchSeq = useRef(0);

  // Delivery fields are controlled so a picked customer/address can fill them.
  const [addressId, setAddressId] = useState('');
  const [deliv, setDeliv] = useState({ name: '', phone: '', governorate: '', city: '', area: '', street: '' });
  const setD = (k: keyof typeof deliv, v: string, clearsAddress = false) => {
    setDeliv((d) => ({ ...d, [k]: v }));
    if (clearsAddress) setAddressId(''); // edited location → treat as a new address
  };

  async function runSearch(term: string) {
    setQ(term);
    const my = ++searchSeq.current;
    if (term.trim().length < 2) { setHits([]); return; }
    const res = await searchCustomersAction(term);
    if (my === searchSeq.current) setHits(res);
  }

  function applyAddress(c: CustomerHit, aid: string) {
    setAddressId(aid);
    const a = c.addresses.find((x) => x.id === aid);
    if (a) setDeliv((d) => ({ ...d, governorate: a.governorate, city: a.city, area: a.area, street: a.street ?? '', phone: a.phone || d.phone }));
  }

  function selectCustomer(c: CustomerHit) {
    setSelected(c);
    setHits([]);
    setQ('');
    setDeliv((d) => ({ ...d, name: c.name || d.name, phone: c.phone || d.phone }));
    const def = c.addresses.find((a) => a.isDefaultShipping) ?? c.addresses[0];
    if (def) applyAddress(c, def.id);
  }

  async function createCustomer() {
    setCreateErr('');
    if (!nc.name.trim() || nc.phone.trim().length < 6) { setCreateErr(tb('Name and a valid phone are required.', 'الاسم ورقم هاتف صحيح مطلوبان.')); return; }
    setBusy(true);
    try {
      const res = await quickCreateCustomerAction({ name: nc.name, phone: nc.phone, email: nc.email || undefined });
      if ('error' in res) {
        setCreateErr(res.error === 'email_taken' ? tb('That email is already used.', 'هذا البريد مستخدم بالفعل.') : tb('Could not create the customer.', 'تعذّر إنشاء العميل.'));
      } else {
        selectCustomer(res);
        setShowCreate(false);
        setNc({ name: '', phone: '', email: '' });
      }
    } finally { setBusy(false); }
  }

  return (
    <form action={action} className="max-w-3xl space-y-6">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="customerId" value={selected?.id ?? ''} />
      <input type="hidden" name="addressId" value={addressId} />

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Customer', 'العميل')}</h2>

        {selected ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
            <div className="flex-1">
              <span className="font-semibold">{selected.name || tb('Customer', 'عميل')}</span>
              <span className="ms-2 text-muted-foreground">{[selected.email, selected.phone].filter(Boolean).join(' · ')}</span>
            </div>
            <Link href={`/admin/customers/${selected.id}`} target="_blank" className="text-primary hover:underline">{tb('Open profile ↗', 'فتح الملف ↗')}</Link>
            <button type="button" onClick={() => { setSelected(null); setAddressId(''); }} className="text-muted-foreground hover:text-destructive">{tb('Change', 'تغيير')}</button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <input
                value={q}
                onChange={(e) => runSearch(e.target.value)}
                placeholder={tb('Search by name, email or phone…', 'ابحث بالاسم أو البريد أو الهاتف…')}
                className={inputCls}
              />
              {hits.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-md">
                  {hits.map((c) => (
                    <button key={c.id} type="button" onClick={() => selectCustomer(c)} className="block w-full px-3 py-2 text-start text-sm hover:bg-surface">
                      <span className="font-medium">{c.name || tb('(no name)', '(بدون اسم)')}</span>
                      <span className="ms-2 text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(' · ')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <button type="button" onClick={() => setShowCreate((v) => !v)} className="text-primary hover:underline">+ {tb('New customer', 'عميل جديد')}</button>
              <span className="text-xs text-muted-foreground">{tb('…or leave unselected for a guest order (optional email below).', '…أو اتركه بدون اختيار لطلب زائر (بريد اختياري بالأسفل).')}</span>
            </div>
            {showCreate && (
              <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
                <input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder={tb('Full name *', 'الاسم بالكامل *')} className={inputCls} />
                <input value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} placeholder={tb('Phone *', 'الهاتف *')} className={inputCls} />
                <input value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} placeholder={tb('Email (optional)', 'البريد (اختياري)')} type="email" className={inputCls} />
                <div className="sm:col-span-3 flex items-center gap-3">
                  <button type="button" onClick={createCustomer} disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                    {busy ? tb('Creating…', 'جارٍ الإنشاء…') : tb('Create & select', 'إنشاء واختيار')}
                  </button>
                  {createErr && <span className="text-xs text-destructive">{createErr}</span>}
                </div>
              </div>
            )}
            <Field label={tb('Guest email (optional)', 'بريد الزائر (اختياري)')} hint={tb('Links the order to an account if the email matches one.', 'يربط الطلب بحساب إذا طابق البريد حسابًا.')}>
              <input name="customerEmail" type="email" className={inputCls} />
            </Field>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Delivery', 'التوصيل')}</h2>
        {selected && selected.addresses.length > 0 && (
          <Field label={tb('Saved address', 'عنوان محفوظ')} hint={tb('Pick one to fill the fields — edits below become a new address.', 'اختر عنوانًا لملء الحقول — التعديلات أدناه تُنشئ عنوانًا جديدًا.')}>
            <select value={addressId} onChange={(e) => (e.target.value ? applyAddress(selected, e.target.value) : setAddressId(''))} className={inputCls}>
              <option value="">{tb('— New address —', '— عنوان جديد —')}</option>
              {selected.addresses.map((a) => (
                <option key={a.id} value={a.id}>{addrLabel(a)}{a.isDefaultShipping ? ` · ${tb('default', 'افتراضي')}` : ''}</option>
              ))}
            </select>
          </Field>
        )}
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label={tb('Full name', 'الاسم بالكامل')}><input name="name" required value={deliv.name} onChange={(e) => setD('name', e.target.value)} className={inputCls} /></Field>
          <Field label={tb('Phone', 'الهاتف')}><input name="phone" required value={deliv.phone} onChange={(e) => setD('phone', e.target.value)} className={inputCls} /></Field>
          <Field label={tb('Governorate', 'المحافظة')}>
            <select name="governorate" required value={deliv.governorate} onChange={(e) => setD('governorate', e.target.value, true)} className={inputCls}>
              <option value="" disabled>—</option>
              {GOVERNORATES.map((g) => <option key={g.en} value={g.en}>{locale === 'ar' ? g.ar : g.en}</option>)}
            </select>
          </Field>
          <Field label={tb('City', 'المدينة')}><input name="city" required value={deliv.city} onChange={(e) => setD('city', e.target.value, true)} className={inputCls} /></Field>
          <Field label={tb('Area', 'المنطقة')}><input name="area" value={deliv.area} onChange={(e) => setD('area', e.target.value, true)} className={inputCls} /></Field>
          <Field label={tb('Street address', 'عنوان الشارع')}><input name="street" required value={deliv.street} onChange={(e) => setD('street', e.target.value, true)} className={inputCls} /></Field>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Items', 'العناصر')}</h2>
        <div className="space-y-3">
          {rows.map((id) => (
            <ProductLinePicker
              key={id}
              depositPercent={depositPercent}
              onRemove={rows.length > 1 ? () => setRows((r) => r.filter((x) => x !== id)) : undefined}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setRows((r) => [...r, seq]); setSeq((s) => s + 1); }}
          className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
        >
          + {tb('Add row', 'إضافة سطر')}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">{tb('Pick an exact expiry per line or leave "Any" for FEFO; stock is deducted on creation and any shortfall becomes a pre-order (Special Order).', 'اختر صلاحية محددة لكل سطر أو اترك «أي» لنظام FEFO؛ يُخصم المخزون عند الإنشاء وأي عجز يصبح طلبًا مسبقًا (طلب خاص).')}</p>
      </section>

      {gifts.length > 0 && (
        <section>
          <h2 className="mb-1 font-heading text-lg font-semibold">🎁 {tb('Gifts (internal)', 'الهدايا (داخلية)')}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{tb('Hidden from the customer invoice; visible to staff for dispatch. Deducted from gift stock on creation.', 'مخفية عن فاتورة العميل؛ ظاهرة للموظفين للتجهيز. تُخصم من مخزون الهدايا عند الإنشاء.')}</p>
          <div className="space-y-3">
            {giftRows.map((id) => (
              <div key={id} className="flex items-end gap-3">
                <label className="block flex-1 text-sm font-medium">{tb('Gift', 'الهدية')}
                  <select name="giftId" className={inputCls} defaultValue="">
                    <option value="" disabled>{tb('Choose a gift…', 'اختر هدية…')}</option>
                    {gifts.map((g) => (
                      <option key={g.value} value={g.value} disabled={g.stock <= 0}>
                        {g.label} · {g.stock > 0 ? `${g.stock} ${tb('in stock', 'متوفر')}` : tb('out of stock', 'غير متوفر')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block w-24 text-sm font-medium">{tb('Qty', 'الكمية')}
                  <input name="giftQty" type="number" min={1} defaultValue={1} className={inputCls} />
                </label>
                <button
                  type="button"
                  onClick={() => setGiftRows((r) => r.filter((x) => x !== id))}
                  className="mb-1 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-destructive"
                  aria-label={tb('Remove gift', 'إزالة الهدية')}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setGiftRows((r) => [...r, seq]); setSeq((s) => s + 1); }}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
          >
            + {tb('Add gift', 'إضافة هدية')}
          </button>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Shipping & payment', 'الشحن والدفع')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tb('Shipping', 'الشحن')}>
            <select name="shippingType" className={inputCls} defaultValue={shippingTypes[0]?.value}>
              {shippingTypes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label={tb('Payment method', 'طريقة الدفع')}>
            <select name="paymentMethod" className={inputCls} defaultValue={paymentMethods[0]?.value}>
              {paymentMethods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label={tb('Channel', 'القناة')} hint={tb('How the customer reached you (staff orders cannot be Direct).', 'كيف وصل إليك العميل (طلبات الموظفين لا يمكن أن تكون «مباشر»).')}>
            <select name="channel" required defaultValue="" className={inputCls}>
              <option value="" disabled>{tb('— select channel —', '— اختر القناة —')}</option>
              {channels.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="discreetPackaging" className="size-4" /> {tb('Discreet unbranded packaging', 'تغليف محايد بدون علامة تجارية')}
        </label>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton>{tb('Create order', 'إنشاء طلب')}</SubmitButton>
        <Link href="/admin/orders" className="text-sm text-muted-foreground hover:underline">{tb('Cancel', 'إلغاء')}</Link>
      </div>
    </form>
  );
}
