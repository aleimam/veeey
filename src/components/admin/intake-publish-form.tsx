'use client';

import { useActionState } from 'react';
import { publishIntakeAction, type AdminFormState } from '@/server/inventory-actions';
import { FormError, SubmitButton, inputCls } from './ui';

/** Inline publisher for one received (QUARANTINE) lot → live catalog. */
export function IntakePublishForm({ locale, lotId }: { locale: string; lotId: string }) {
  const [state, action] = useActionState<AdminFormState, FormData>(publishIntakeAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="lotId" value={lotId} />
      <label className="text-xs">
        Expiry
        <input type="date" name="expiryDate" required className={`${inputCls} w-40`} />
      </label>
      <label className="text-xs">
        Sale price (EGP)
        <input type="number" step="0.01" min="0" name="priceOverrideEgp" className={`${inputCls} w-32`} />
      </label>
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" name="saleFlag" className="size-4" /> sale
      </label>
      <SubmitButton>Publish</SubmitButton>
    </form>
  );
}
