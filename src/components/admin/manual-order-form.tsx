'use client';

import { useActionState, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { createManualOrderAction } from '@/server/order-actions';
import type { AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';

type Opt = { value: string; label: string };

export function ManualOrderForm({
  locale,
  products,
  shippingTypes,
  paymentMethods,
}: {
  locale: string;
  products: Opt[];
  shippingTypes: Opt[];
  paymentMethods: Opt[];
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(createManualOrderAction, {});
  const [rows, setRows] = useState<number[]>([0]);
  const [seq, setSeq] = useState(1);

  return (
    <form action={action} className="max-w-3xl space-y-6">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">Customer</h2>
        <Field label="Customer email" hint="Match an existing account, or leave blank / enter a new email for a guest order.">
          <input name="customerEmail" type="email" className={inputCls} />
        </Field>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">Delivery</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><input name="name" required className={inputCls} /></Field>
          <Field label="Phone"><input name="phone" required className={inputCls} /></Field>
          <Field label="Governorate"><input name="governorate" required className={inputCls} /></Field>
          <Field label="City"><input name="city" required className={inputCls} /></Field>
          <Field label="Area / district"><input name="area" required className={inputCls} /></Field>
          <Field label="Street address"><input name="street" required className={inputCls} /></Field>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">Items</h2>
        <div className="space-y-3">
          {rows.map((id) => (
            <div key={id} className="flex items-end gap-3">
              <label className="block flex-1 text-sm font-medium">Product
                <select name="productId" className={inputCls} defaultValue="">
                  <option value="" disabled>Select a product…</option>
                  {products.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              <label className="block w-24 text-sm font-medium">Qty
                <input name="qty" type="number" min={1} defaultValue={1} className={inputCls} />
              </label>
              <button
                type="button"
                onClick={() => setRows((r) => (r.length > 1 ? r.filter((x) => x !== id) : r))}
                className="mb-1 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-destructive"
                aria-label="Remove line"
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
          + Add line
        </button>
        <p className="mt-2 text-xs text-muted-foreground">Lots are picked nearest-expiry first (FEFO); stock is deducted on creation.</p>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">Shipping & payment</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shipping">
            <select name="shippingType" className={inputCls} defaultValue={shippingTypes[0]?.value}>
              {shippingTypes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Payment method">
            <select name="paymentMethod" className={inputCls} defaultValue={paymentMethods[0]?.value}>
              {paymentMethods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="discreetPackaging" className="size-4" /> Discreet, unbranded packaging
        </label>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton>Create order</SubmitButton>
        <Link href="/admin/orders" className="text-sm text-muted-foreground hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
