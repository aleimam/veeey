'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { placeOrderAction, type CheckoutState } from '@/server/cart-actions';
import { formatEGP } from '@/lib/format';

type ShipOpt = { type: string; label: string; feePiastres: number };
type PayOpt = { key: string; label: string };

const field = 'mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

export function CheckoutForm({
  locale,
  isLoggedIn,
  defaultName,
  subtotalPiastres,
  shippingOptions,
  paymentMethods,
  pointsBalance = 0,
}: {
  locale: string;
  isLoggedIn: boolean;
  defaultName?: string;
  subtotalPiastres: number;
  shippingOptions: ShipOpt[];
  paymentMethods: PayOpt[];
  pointsBalance?: number;
}) {
  const t = useTranslations('storefront.checkout');
  const tPay = useTranslations('storefront.payments');
  const [state, action] = useActionState<CheckoutState, FormData>(placeOrderAction, {});
  const [shipping, setShipping] = useState(shippingOptions[0]?.type ?? 'FAST_FREE');
  const fee = shippingOptions.find((s) => s.type === shipping)?.feePiastres ?? 0;
  const total = subtotalPiastres + fee;

  const errorMsg =
    state.error === 'empty' ? t('errEmpty') : state.error ? t('errGeneric') : null;

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <input type="hidden" name="locale" value={locale} />

      <div className="space-y-6">
        {errorMsg && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMsg}</p>}

        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold">{t('deliveryDetails')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {!isLoggedIn && (
              <label className="block text-sm font-medium sm:col-span-2">{t('email')}
                <input name="guestEmail" type="email" required className={field} />
              </label>
            )}
            <label className="block text-sm font-medium">{t('fullName')}
              <input name="name" required defaultValue={defaultName ?? ''} className={field} />
            </label>
            <label className="block text-sm font-medium">{t('phone')}
              <input name="phone" required className={field} />
            </label>
            <label className="block text-sm font-medium">{t('governorate')}
              <input name="governorate" required className={field} />
            </label>
            <label className="block text-sm font-medium">{t('city')}
              <input name="city" required className={field} />
            </label>
            <label className="block text-sm font-medium">{t('area')}
              <input name="area" required className={field} />
            </label>
            <label className="block text-sm font-medium sm:col-span-2">{t('street')}
              <input name="street" required className={field} />
            </label>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold">{t('shipping')}</h2>
          <div className="space-y-2">
            {shippingOptions.map((s) => (
              <label key={s.type} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <span className="flex items-center gap-2">
                  <input type="radio" name="shippingType" value={s.type} checked={shipping === s.type} onChange={() => setShipping(s.type)} />
                  {s.label}
                </span>
                <span className="font-medium">{s.feePiastres === 0 ? t('free') : formatEGP(s.feePiastres)}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold">{t('discounts')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">{t('couponCode')}
              <input name="couponCode" placeholder={t('couponPlaceholder')} className={field} />
            </label>
            {isLoggedIn && pointsBalance > 0 && (
              <label className="block text-sm font-medium">{t('redeemPoints')} <span className="text-muted-foreground">{t('redeemPointsHint', { balance: pointsBalance })}</span>
                <input name="redeemPoints" type="number" min="0" max={pointsBalance} step="200" defaultValue="0" className={field} />
              </label>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t('discountsNote')}</p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold">{t('payment')}</h2>
          <select name="paymentMethod" className={field}>
            {paymentMethods.map((m) => <option key={m.key} value={m.key}>{tPay.has(m.key) ? tPay(m.key) : m.label}</option>)}
          </select>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="discreetPackaging" className="size-4" /> {t('discreet')}
          </label>
        </section>
      </div>

      <aside className="h-fit space-y-3 rounded-xl border border-border p-5">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('subtotal')}</span><span>{formatEGP(subtotalPiastres)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('shipping')}</span><span>{fee === 0 ? t('free') : formatEGP(fee)}</span></div>
        <div className="flex justify-between border-t border-border pt-3 font-semibold"><span>{t('total')}</span><span>{formatEGP(total)}</span></div>
        <button type="submit" className="mt-2 w-full rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:opacity-90">{t('placeOrder')}</button>
        <p className="text-center text-xs text-muted-foreground">{t('noVat')}</p>
      </aside>
    </form>
  );
}
