'use client';

import { useActionState } from 'react';
import { useLocale } from 'next-intl';
import { publishIntakeAction, type AdminFormState } from '@/server/inventory-actions';
import { FormError, SubmitButton, inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';

/** Inline publisher for one received (QUARANTINE) lot → live catalog. Cost is
 *  confirmable here (V4 C10) — prefilled when the shipment carried one. */
export function IntakePublishForm({ locale, lotId, defaultCostEgp = null }: { locale: string; lotId: string; defaultCostEgp?: number | null }) {
  const tb = pick(useLocale());
  const [state, action] = useActionState<AdminFormState, FormData>(publishIntakeAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="lotId" value={lotId} />
      <label className="text-xs">
        {tb('Expiry', 'الصلاحية')}
        <input type="date" name="expiryDate" required className={`${inputCls} w-40`} />
      </label>
      <label className="text-xs">
        {tb('Cost (EGP)', 'التكلفة (ج.م)')}
        <input type="number" step="0.01" min="0" name="costEgp" defaultValue={defaultCostEgp ?? ''} className={`${inputCls} w-28`} />
      </label>
      <label className="text-xs">
        {tb('Sale price (EGP)', 'سعر التخفيض (ج.م)')}
        <input type="number" step="0.01" min="0" name="priceOverrideEgp" className={`${inputCls} w-32`} />
      </label>
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" name="saleFlag" className="size-4" /> {tb('Sale', 'تخفيض')}
      </label>
      <SubmitButton>{tb('Publish', 'نشر')}</SubmitButton>
    </form>
  );
}
