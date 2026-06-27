'use client';

import { useActionState, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { createManualOrderAction } from '@/server/order-actions';
import type { AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { GOVERNORATES } from '@/lib/governorates';
import { pick } from '@/lib/admin-i18n';

type Opt = { value: string; label: string };

export function ManualOrderForm({
  locale,
  products,
  shippingTypes,
  paymentMethods,
  channels,
}: {
  locale: string;
  products: Opt[];
  shippingTypes: Opt[];
  paymentMethods: Opt[];
  channels: Opt[];
}) {
  const tb = pick(useLocale());
  const [state, action] = useActionState<AdminFormState, FormData>(createManualOrderAction, {});
  const [rows, setRows] = useState<number[]>([0]);
  const [seq, setSeq] = useState(1);

  return (
    <form action={action} className="max-w-3xl space-y-6">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Customer', 'العميل')}</h2>
        <Field label={tb('Customer email', 'بريد العميل الإلكتروني')} hint={tb('Link to an existing account, or leave blank / enter a new email for a guest order.', 'اربطه بحساب موجود، أو اتركه فارغًا / أدخل بريدًا جديدًا لطلب زائر.')}>
          <input name="customerEmail" type="email" className={inputCls} />
        </Field>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Delivery', 'التوصيل')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tb('Full name', 'الاسم بالكامل')}><input name="name" required className={inputCls} /></Field>
          <Field label={tb('Phone', 'الهاتف')}><input name="phone" required className={inputCls} /></Field>
          <Field label={tb('Governorate', 'المحافظة')}>
            <select name="governorate" required defaultValue="" className={inputCls}>
              <option value="" disabled>—</option>
              {GOVERNORATES.map((g) => <option key={g.en} value={g.en}>{locale === 'ar' ? g.ar : g.en}</option>)}
            </select>
          </Field>
          <Field label={tb('City', 'المدينة')}><input name="city" required className={inputCls} /></Field>
          <Field label={tb('Street address', 'عنوان الشارع')}><input name="street" required className={inputCls} /></Field>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Items', 'العناصر')}</h2>
        <div className="space-y-3">
          {rows.map((id) => (
            <div key={id} className="flex items-end gap-3">
              <label className="block flex-1 text-sm font-medium">{tb('Product', 'المنتج')}
                <select name="productId" className={inputCls} defaultValue="">
                  <option value="" disabled>{tb('Choose a product…', 'اختر منتجًا…')}</option>
                  {products.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              <label className="block w-24 text-sm font-medium">{tb('Qty', 'الكمية')}
                <input name="qty" type="number" min={1} defaultValue={1} className={inputCls} />
              </label>
              <button
                type="button"
                onClick={() => setRows((r) => (r.length > 1 ? r.filter((x) => x !== id) : r))}
                className="mb-1 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-destructive"
                aria-label={tb('Remove row', 'إزالة السطر')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setRows((r) => [...r, seq]); setSeq((s) => s + 1); }}
          className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
        >
          + {tb('Add row', 'إضافة سطر')}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">{tb('Lots closest to expiry are selected first (FEFO); stock is deducted on creation.', 'يتم اختيار الدفعات الأقرب انتهاءً أولًا (FEFO)؛ ويُخصم المخزون عند الإنشاء.')}</p>
      </section>

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
