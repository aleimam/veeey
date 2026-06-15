'use client';

import { useActionState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { saveLotAction, type AdminFormState } from '@/server/inventory-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';

type Opt = { value: string; label: string };

export function LotForm({
  locale,
  defaults = {},
  products,
  locations,
  suggestion,
}: {
  locale: string;
  defaults?: Record<string, unknown>;
  products: Opt[];
  locations: Opt[];
  suggestion?: string;
}) {
  const tb = pick(useLocale());
  const [state, action] = useActionState<AdminFormState, FormData>(saveLotAction, {});
  const d = defaults;

  return (
    <form action={action} className="max-w-xl space-y-5">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {d.id ? <input type="hidden" name="id" value={String(d.id)} /> : null}

      <Field label={tb('Product', 'المنتج')}>
        <select name="productId" defaultValue={(d.productId as string) ?? ''} required className={inputCls}>
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
        <Field label={tb('Price by expiry (EGP)', 'السعر حسب الصلاحية (ج.م)')} hint={tb('Override the base price for this lot.', 'تجاوز السعر الأساسي لهذه الدفعة.')}>
          <input type="number" step="0.01" min="0" name="priceOverrideEgp" defaultValue={(d.priceOverrideEgp as number) ?? ''} className={inputCls} />
        </Field>
      </div>

      {suggestion && (
        <p className="rounded-md bg-gold/15 px-3 py-2 text-sm text-slate">💡 {suggestion}</p>
      )}

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="saleFlag" defaultChecked={!!d.saleFlag} className="size-4" /> {tb('Near-expiry discount', 'تخفيض قرب انتهاء الصلاحية')}
      </label>
      <Field label={tb('Status', 'الحالة')}>
        <select name="status" defaultValue={(d.status as string) ?? 'LIVE'} className={inputCls}>
          {['LIVE', 'QUARANTINE', 'EXPIRED', 'WRITTEN_OFF'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton>{tb('Save lot', 'حفظ الدفعة')}</SubmitButton>
        <Link href="/admin/inventory/lots" className="text-sm text-muted-foreground hover:underline">{tb('Cancel', 'إلغاء')}</Link>
      </div>
    </form>
  );
}
