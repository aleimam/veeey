'use client';

import { useActionState, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { saveLotAction, type AdminFormState } from '@/server/inventory-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';
import { LOT_CONDITIONS, conditionLabel } from '@/lib/lot-condition';

type Opt = { value: string; label: string };

export function LotForm({
  locale,
  defaults = {},
  products,
  productPrices = {},
  locations,
  suggestion,
}: {
  locale: string;
  defaults?: Record<string, unknown>;
  products: Opt[];
  productPrices?: Record<string, number>;
  locations: Opt[];
  suggestion?: string;
}) {
  const tb = pick(useLocale());
  const [state, action] = useActionState<AdminFormState, FormData>(saveLotAction, {});
  const d = defaults;

  // Price-per-expiry 3-way calc: base (from the product) is the reference; enter
  // sale price OR discount % and the other is derived. Only the sale price is
  // submitted (priceOverrideEgp); discount is display-only.
  const [productId, setProductId] = useState((d.productId as string) ?? '');
  const initialSale = d.priceOverrideEgp != null && d.priceOverrideEgp !== '' ? String(d.priceOverrideEgp) : '';
  const [sale, setSale] = useState(initialSale);
  const base = productPrices[productId];
  const discountFor = (s: string) =>
    base && base > 0 && s !== '' && !Number.isNaN(Number(s)) ? (((base - Number(s)) / base) * 100).toFixed(1) : '';
  const [discount, setDiscount] = useState(discountFor(initialSale));

  function onSale(v: string) {
    setSale(v);
    setDiscount(discountFor(v));
  }
  function onDiscount(v: string) {
    setDiscount(v);
    if (base && base > 0 && v !== '' && !Number.isNaN(Number(v))) setSale((base * (1 - Number(v) / 100)).toFixed(2));
  }
  function onProduct(v: string) {
    setProductId(v);
    const b = productPrices[v];
    setDiscount(b && b > 0 && sale !== '' && !Number.isNaN(Number(sale)) ? (((b - Number(sale)) / b) * 100).toFixed(1) : '');
  }

  return (
    <form action={action} className="max-w-xl space-y-5">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {d.id ? <input type="hidden" name="id" value={String(d.id)} /> : null}

      <Field label={tb('Product', 'المنتج')}>
        <select name="productId" value={productId} onChange={(e) => onProduct(e.target.value)} required className={inputCls}>
          <option value="">{tb('— Choose —', '— اختر —')}</option>
          {products.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>
      <Field label={tb('Location', 'الموقع')}>
        <select name="locationId" defaultValue={(d.locationId as string) ?? ''} required className={inputCls}>
          {locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={tb('Expiry date', 'تاريخ الصلاحية')} hint={tb('Leave empty and enable NA for non-perishable products.', 'اتركه فارغًا وفعِّل NA للمنتجات غير القابلة للتلف.')}>
          <input type="date" name="expiryDate" defaultValue={(d.expiryDate as string) ?? ''} className={inputCls} />
          <label className="mt-1 flex items-center gap-2 text-xs font-normal">
            <input type="checkbox" name="noExpiry" defaultChecked={!!d.noExpiry} className="size-3.5" /> {tb('No expiry (NA) — non-perishable', 'بدون صلاحية (NA) — غير قابل للتلف')}
          </label>
        </Field>
        <Field label={tb('Quantity on hand', 'الكمية المتاحة')}>
          <input type="number" name="qtyOnHand" min="0" defaultValue={(d.qtyOnHand as number) ?? 0} className={inputCls} />
        </Field>
        <Field label={tb('Cost (EGP)', 'التكلفة (ج.م)')} hint={tb('From YeldnIN later.', 'من YeldnIN لاحقًا.')}>
          <input type="number" step="0.01" min="0" name="costEgp" defaultValue={(d.costEgp as number) ?? ''} className={inputCls} />
        </Field>
        <Field label={tb('Base price (EGP)', 'السعر الأساسي (ج.م)')} hint={tb('From the product (far-expiry reference).', 'من المنتج (مرجع الصلاحية البعيدة).')}>
          <input type="number" value={base ?? ''} readOnly disabled className={`${inputCls} opacity-70`} />
        </Field>
        <Field label={tb('Sale price by expiry (EGP)', 'سعر البيع حسب الصلاحية (ج.م)')} hint={tb('Enter sale price or discount — the other is computed.', 'أدخل سعر البيع أو نسبة الخصم — يُحسب الآخر.')}>
          <input type="number" step="0.01" min="0" name="priceOverrideEgp" value={sale} onChange={(e) => onSale(e.target.value)} className={inputCls} />
        </Field>
        <Field label={tb('Discount (%)', 'نسبة الخصم (٪)')} hint={base ? undefined : tb('Pick a product to enable.', 'اختر منتجًا للتفعيل.')}>
          <input type="number" step="0.1" min="0" max="100" value={discount} onChange={(e) => onDiscount(e.target.value)} disabled={!base} className={inputCls} />
        </Field>
      </div>

      {suggestion && (
        <p className="rounded-md bg-gold/15 px-3 py-2 text-sm text-slate">💡 {suggestion}</p>
      )}

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="saleFlag" defaultChecked={!!d.saleFlag} className="size-4" /> {tb('Near-expiry discount', 'تخفيض قرب انتهاء الصلاحية')}
      </label>
      <div className="grid grid-cols-2 gap-4">
        <Field label={tb('Condition', 'حالة العبوة')} hint={tb('Non-new lots sell as an explicit buy-box variant at this lot’s price.', 'الدفعات غير الجديدة تُباع كخيار صريح في صندوق الشراء بسعر هذه الدفعة.')}>
          <select name="condition" defaultValue={(d.condition as string) ?? 'NEW'} className={inputCls}>
            {LOT_CONDITIONS.map((c) => <option key={c} value={c}>{conditionLabel(c, locale)}</option>)}
          </select>
        </Field>
        <Field label={tb('Status', 'الحالة')}>
          <select name="status" defaultValue={(d.status as string) ?? 'LIVE'} className={inputCls}>
            {['LIVE', 'QUARANTINE', 'EXPIRED', 'WRITTEN_OFF'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>{tb('Save lot', 'حفظ الدفعة')}</SubmitButton>
        <Link href="/admin/inventory/lots" className="text-sm text-muted-foreground hover:underline">{tb('Cancel', 'إلغاء')}</Link>
      </div>
    </form>
  );
}
