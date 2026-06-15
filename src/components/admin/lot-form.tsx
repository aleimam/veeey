'use client';

import { useActionState } from 'react';
import { Link } from '@/i18n/navigation';
import { saveLotAction, type AdminFormState } from '@/server/inventory-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';

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
  const [state, action] = useActionState<AdminFormState, FormData>(saveLotAction, {});
  const d = defaults;

  return (
    <form action={action} className="max-w-xl space-y-5">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {d.id ? <input type="hidden" name="id" value={String(d.id)} /> : null}

      <Field label="Product">
        <select name="productId" defaultValue={(d.productId as string) ?? ''} required className={inputCls}>
          <option value="">— select —</option>
          {products.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>
      <Field label="Location">
        <select name="locationId" defaultValue={(d.locationId as string) ?? ''} required className={inputCls}>
          {locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Expiry date" hint="Leave blank and tick NA for non-perishable items.">
          <input type="date" name="expiryDate" defaultValue={(d.expiryDate as string) ?? ''} className={inputCls} />
          <label className="mt-1 flex items-center gap-2 text-xs font-normal">
            <input type="checkbox" name="noExpiry" defaultChecked={!!d.noExpiry} className="size-3.5" /> NA — no expiry (non-perishable)
          </label>
        </Field>
        <Field label="Quantity on hand">
          <input type="number" name="qtyOnHand" min="0" defaultValue={(d.qtyOnHand as number) ?? 0} className={inputCls} />
        </Field>
        <Field label="Cost (EGP)" hint="From YeldnIN later.">
          <input type="number" step="0.01" min="0" name="costEgp" defaultValue={(d.costEgp as number) ?? ''} className={inputCls} />
        </Field>
        <Field label="Price-per-expiry (EGP)" hint="Override base price for this lot.">
          <input type="number" step="0.01" min="0" name="priceOverrideEgp" defaultValue={(d.priceOverrideEgp as number) ?? ''} className={inputCls} />
        </Field>
      </div>

      {suggestion && (
        <p className="rounded-md bg-gold/15 px-3 py-2 text-sm text-slate">💡 {suggestion}</p>
      )}

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="saleFlag" defaultChecked={!!d.saleFlag} className="size-4" /> Short-expiry sale
      </label>
      <Field label="Status">
        <select name="status" defaultValue={(d.status as string) ?? 'LIVE'} className={inputCls}>
          {['LIVE', 'QUARANTINE', 'EXPIRED', 'WRITTEN_OFF'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton>Save lot</SubmitButton>
        <Link href="/admin/inventory/lots" className="text-sm text-muted-foreground hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
