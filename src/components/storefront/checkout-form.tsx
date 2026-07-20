'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { placeOrderAction, type CheckoutState } from '@/server/cart-actions';
import { CheckoutVerify } from '@/components/storefront/checkout-verify';
import { formatEGP } from '@/lib/format';
import { GOVERNORATES } from '@/lib/governorates';

type ShipOpt = { type: string; label: string; feePiastres: number };
type PayOpt = { key: string; label: string };
type SavedAddr = { id: string; governorate: string; city: string; area?: string | null; street?: string | null; phone?: string | null };
const blankAddr = { name: '', phone: '', governorate: '', city: '', street: '' };

const field =
  'mt-1.5 w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-slate-45 focus:border-lime focus:bg-white';

export function CheckoutForm({
  locale,
  isLoggedIn,
  defaultName,
  subtotalPiastres,
  shippingOptions,
  paymentMethods,
  posGovernorates = [],
  ultraFastGovernorates = [],
  pointsBalance = 0,
  pointsPerEgp = 200,
  savedAddresses = [],
  requireVerification = false,
  alreadyVerified = false,
  accountEmail,
  smsAvailable = false,
  emailAvailable = false,
}: {
  locale: string;
  isLoggedIn: boolean;
  defaultName?: string;
  subtotalPiastres: number;
  shippingOptions: ShipOpt[];
  paymentMethods: PayOpt[];
  posGovernorates?: string[];
  ultraFastGovernorates?: string[];
  pointsBalance?: number;
  pointsPerEgp?: number;
  savedAddresses?: SavedAddr[];
  requireVerification?: boolean;
  alreadyVerified?: boolean;
  accountEmail?: string;
  smsAvailable?: boolean;
  emailAvailable?: boolean;
}) {
  const t = useTranslations('storefront.checkout');
  const tPay = useTranslations('storefront.payments');
  const [state, action] = useActionState<CheckoutState, FormData>(placeOrderAction, {});
  const [shipping, setShipping] = useState(shippingOptions[0]?.type ?? 'FAST_FREE');
  const [addr, setAddr] = useState({ ...blankAddr, name: defaultName ?? '' });
  const [guestEmail, setGuestEmail] = useState('');
  const [verified, setVerified] = useState(alreadyVerified);
  const showVerify = requireVerification && !verified;
  const set = (k: keyof typeof blankAddr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddr((a) => ({ ...a, [k]: e.target.value }));
  const pickSaved = (id: string) => {
    const a = savedAddresses.find((x) => x.id === id);
    setAddr(a ? { name: defaultName ?? '', phone: a.phone ?? '', governorate: a.governorate, city: a.city, street: a.street ?? '' } : { ...blankAddr, name: defaultName ?? '' });
  };
  // UltraFast (3–6h same-day) is only selectable in eligible governorates
  // (Greater Cairo + Giza by seed, V4 E24). If the shopper picks another
  // governorate after selecting it, the choice falls back to the first option.
  const visibleShipping = shippingOptions.filter((s) => s.type !== 'ULTRAFAST' || ultraFastGovernorates.includes(addr.governorate));
  const effectiveShipping = visibleShipping.some((s) => s.type === shipping) ? shipping : (visibleShipping[0]?.type ?? 'FAST_FREE');
  const fee = visibleShipping.find((s) => s.type === effectiveShipping)?.feePiastres ?? 0;
  const total = subtotalPiastres + fee;

  const errorMsg =
    state.error === 'empty' ? t('errEmpty')
    : state.error === 'verify' ? t('errVerify')
    : state.error === 'blocked' ? t('errBlocked')
    : state.error === 'stale' ? t('errStale')
    : state.error ? t('errGeneric') : null;
  const heading = 'mb-3 text-lg font-bold text-green-dark';

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <input type="hidden" name="locale" value={locale} />

      <div className="space-y-6">
        {errorMsg && <p role="alert" className="rounded-[8px] bg-error-wash px-3 py-2 text-sm text-error">{errorMsg}</p>}

        <section>
          <h2 className={heading}>{t('deliveryDetails')}</h2>
          {savedAddresses.length > 0 && (
            <label className="mb-4 block text-sm font-semibold text-ink">{t('savedAddress')}
              <select onChange={(e) => pickSaved(e.target.value)} className={field}>
                <option value="">{t('newAddress')}</option>
                {savedAddresses.map((a) => <option key={a.id} value={a.id}>{a.governorate} · {a.city} · {a.area}</option>)}
              </select>
            </label>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {!isLoggedIn && (
              <label className="block text-sm font-semibold text-ink sm:col-span-2">{t('email')}
                <input name="guestEmail" type="email" required value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className={field} />
              </label>
            )}
            <label className="block text-sm font-semibold text-ink">{t('fullName')}
              <input name="name" required value={addr.name} onChange={set('name')} className={field} />
            </label>
            <label className="block text-sm font-semibold text-ink">{t('phone')}
              <input name="phone" required value={addr.phone} onChange={set('phone')} className={field} />
            </label>
            <label className="block text-sm font-semibold text-ink">{t('governorate')}
              <select name="governorate" required value={addr.governorate} onChange={set('governorate')} className={field}>
                <option value="" disabled>{t('selectGovernorate')}</option>
                {GOVERNORATES.map((g) => <option key={g.en} value={g.en}>{locale === 'ar' ? g.ar : g.en}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-ink">{t('city')}
              <input name="city" required value={addr.city} onChange={set('city')} className={field} />
            </label>
            <label className="block text-sm font-semibold text-ink sm:col-span-2">{t('street')}
              <input name="street" required value={addr.street} onChange={set('street')} className={field} />
            </label>
          </div>
        </section>

        {showVerify && (
          <section>
            <h2 className={heading}>{t('verifyHeading')}</h2>
            <CheckoutVerify
              locale={locale}
              phone={addr.phone}
              email={isLoggedIn ? accountEmail : guestEmail}
              smsAvailable={smsAvailable}
              emailAvailable={emailAvailable}
              onVerified={() => setVerified(true)}
            />
          </section>
        )}

        <section>
          <h2 className={heading}>{t('shipping')}</h2>
          <div className="space-y-2">
            {visibleShipping.map((s) => (
              <label
                key={s.type}
                className={`flex cursor-pointer items-center justify-between rounded-[10px] border p-3.5 text-sm transition-colors ${
                  effectiveShipping === s.type ? 'border-[1.5px] border-green-dark bg-green-wash' : 'border-[color:var(--slate-border)]'
                }`}
              >
                <span className="flex items-center gap-2.5 text-ink">
                  <input type="radio" name="shippingType" value={s.type} checked={effectiveShipping === s.type} onChange={() => setShipping(s.type)} className="accent-[color:var(--green-dark)]" />
                  {s.label}
                </span>
                <span className="font-semibold text-green-dark">{s.feePiastres === 0 ? t('free') : formatEGP(s.feePiastres)}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className={heading}>{t('discounts')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-ink">{t('couponCode')}
              <input name="couponCode" placeholder={t('couponPlaceholder')} className={field} />
            </label>
            {isLoggedIn && pointsBalance > 0 && (
              <label className="block text-sm font-semibold text-ink">{t('redeemPoints')} <span className="font-normal text-[color:var(--text-muted)]">{t('redeemPointsHint', { balance: pointsBalance, rate: pointsPerEgp })}</span>
                <input name="redeemPoints" type="number" min="0" max={pointsBalance} step={pointsPerEgp} defaultValue="0" className={field} />
              </label>
            )}
          </div>
          <p className="mt-1 text-xs text-[color:var(--text-muted)]">{t('discountsNote')}</p>
        </section>

        <section>
          <h2 className={heading}>{t('payment')}</h2>
          <select name="paymentMethod" className={field}>
            {paymentMethods.filter((m) => m.key !== 'POS_ON_DELIVERY' || posGovernorates.includes(addr.governorate)).map((m) => <option key={m.key} value={m.key}>{tPay.has(m.key) ? tPay(m.key) : m.label}</option>)}
          </select>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="discreetPackaging" className="size-4 accent-[color:var(--green-dark)]" /> {t('discreet')}
          </label>
        </section>
      </div>

      <aside className="h-fit space-y-3 rounded-[12px] border border-[color:var(--green-dark-05)] bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="flex justify-between text-sm"><span className="text-[color:var(--text-muted)]">{t('subtotal')}</span><span className="text-ink">{formatEGP(subtotalPiastres)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-[color:var(--text-muted)]">{t('shipping')}</span><span className="text-ink">{fee === 0 ? t('free') : formatEGP(fee)}</span></div>
        <div className="flex justify-between border-t border-[color:var(--slate-border)] pt-3 font-bold text-green-dark"><span>{t('total')}</span><span>{formatEGP(total)}</span></div>
        <button type="submit" className="v-btn v-btn--primary v-btn--block mt-2">{t('placeOrder')}</button>
        {showVerify && <p className="text-center text-xs text-[color:var(--gold-ink,#8a6d00)]">{t('verifyNote')}</p>}
        <p className="text-center text-xs text-[color:var(--text-muted)]">{t('noVat')}</p>
      </aside>
    </form>
  );
}
