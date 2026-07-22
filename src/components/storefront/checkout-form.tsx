'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { placeOrderAction, type CheckoutState } from '@/server/cart-actions';
import { CheckoutVerify } from '@/components/storefront/checkout-verify';
import { CouponField } from '@/components/storefront/coupon-field';
import { PhoneInput } from '@/components/ui/phone-input';
import { formatEGP } from '@/lib/format';
import { checkPhoneValue } from '@/lib/phone';
import { GOVERNORATES } from '@/lib/governorates';
import { CitySelect } from '@/components/storefront/city-select';
import type { CitiesByGovernorate } from '@/lib/city-service';

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
  cities = {},
  paymentNotes = {},
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
  /** Delivery districts grouped by governorate — the whole list, filtered client-side. */
  cities?: CitiesByGovernorate;
  /** Per-method explanation, keyed by method code — shown under the selected one. */
  paymentNotes?: Record<string, string>;
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
  // Pre-select the FIRST-listed method — the top card (owner 2026-07-23,
  // deliberately, to push card payment). Order is CHECKOUT_METHOD_ORDER, so this
  // follows whatever leads that list.
  const [payment, setPayment] = useState(paymentMethods[0]?.key ?? '');
  // P1-5: a returning customer starts with their default (or latest) saved
  // address pre-filled — the details they typed last order are not re-typed.
  const firstSaved = savedAddresses[0];
  const fromSaved = (a: SavedAddr) => ({ name: defaultName ?? '', phone: a.phone ?? '', governorate: a.governorate, city: a.city, street: a.street ?? '' });
  const [addr, setAddr] = useState(firstSaved ? fromSaved(firstSaved) : { ...blankAddr, name: defaultName ?? '' });
  const [guestEmail, setGuestEmail] = useState('');
  const [verified, setVerified] = useState(alreadyVerified);
  // P2-7: the coupon/points area hides behind a chevron — a visible empty coupon
  // box invites hunting for a code (and abandoning the cart to go find one).
  const [discountsOpen, setDiscountsOpen] = useState(false);
  // P1-3: inline field validation — a missing/invalid field shows a red message
  // under the field itself (aria-wired), instead of a silent native tooltip.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const showVerify = requireVerification && !verified;
  const set = (k: keyof typeof blankAddr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAddr((a) => ({ ...a, [k]: e.target.value }));
    setFieldErrors((f) => (f[k] ? { ...f, [k]: '' } : f));
  };
  const pickSaved = (id: string) => {
    const a = savedAddresses.find((x) => x.id === id);
    setAddr(a ? fromSaved(a) : { ...blankAddr, name: defaultName ?? '' });
    setFieldErrors({});
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!isLoggedIn) {
      if (!guestEmail.trim()) errs.guestEmail = t('errFieldRequired');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) errs.guestEmail = t('errFieldEmail');
    }
    if (!addr.name.trim()) errs.name = t('errFieldRequired');
    // The country-code picker normalizes as you type; this re-checks the joined
    // value against the selected country's national-number length.
    const phoneIssue = checkPhoneValue(addr.phone);
    if (phoneIssue === 'required') errs.phone = t('errFieldRequired');
    else if (phoneIssue) errs.phone = t('errFieldPhone');
    if (!addr.governorate) errs.governorate = t('errFieldRequired');
    if (!addr.city.trim()) errs.city = t('errFieldRequired');
    if (!addr.street.trim()) errs.street = t('errFieldRequired');
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!validate()) {
      e.preventDefault();
      // Take the reader to the first offending field.
      const first = e.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.focus();
    }
  };
  /** Error-aware input styling + aria wiring for one field. */
  const fieldProps = (k: string) => {
    const err = fieldErrors[k];
    return {
      className: `${field} ${err ? 'border-[1.5px] border-[color:var(--error)]' : ''}`,
      'aria-invalid': err ? true : undefined,
      'aria-describedby': err ? `err-${k}` : undefined,
    };
  };
  const fieldError = (k: string) =>
    fieldErrors[k] ? <span id={`err-${k}`} role="alert" className="mt-1 block text-xs font-normal text-error">{fieldErrors[k]}</span> : null;
  // UltraFast (3–6h same-day) is only selectable in eligible governorates
  // (Greater Cairo + Giza by seed, V4 E24). If the shopper picks another
  // governorate after selecting it, the choice falls back to the first option.
  const visibleShipping = shippingOptions.filter((s) => s.type !== 'ULTRAFAST' || ultraFastGovernorates.includes(addr.governorate));
  const effectiveShipping = visibleShipping.some((s) => s.type === shipping) ? shipping : (visibleShipping[0]?.type ?? 'FAST_FREE');
  // Same shape as shipping: POS-on-delivery only exists in some governorates, so
  // a chosen method can vanish when the address changes — fall back to the first
  // visible one rather than submitting a method the customer can no longer see.
  const visiblePayment = paymentMethods.filter((m) => m.key !== 'POS_ON_DELIVERY' || posGovernorates.includes(addr.governorate));
  const effectivePayment = visiblePayment.some((m) => m.key === payment) ? payment : (visiblePayment[0]?.key ?? '');
  const fee = visibleShipping.find((s) => s.type === effectiveShipping)?.feePiastres ?? 0;
  const total = subtotalPiastres + fee;

  const errorMsg =
    state.error === 'empty' ? t('errEmpty')
    : state.error === 'phone' ? t('errFieldPhone')
    : state.error === 'verify' ? t('errVerify')
    : state.error === 'blocked' ? t('errBlocked')
    : state.error === 'stale' ? t('errStale')
    : state.error === 'stock' ? t('errStock')
    // Placement re-checks the coupon, so it can fail even after Apply said yes
    // (a last-redemption promo used up in between). Reuse the field's own
    // wording rather than a second vocabulary for the same rules.
    : state.error === 'coupon' ? (t.has(`coupon_${state.couponReason}`) ? t(`coupon_${state.couponReason}`) : t('coupon_invalid'))
    : state.error ? t('errGeneric') : null;
  const heading = 'mb-3 text-lg font-bold text-green-dark';

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <input type="hidden" name="locale" value={locale} />

      <div className="space-y-6">
        {errorMsg && <p role="alert" className="rounded-[8px] bg-error-wash px-3 py-2 text-sm text-error">{errorMsg}</p>}

        <section>
          <h2 className={heading}>{t('deliveryDetails')}</h2>
          {savedAddresses.length > 0 && (
            <label className="mb-4 block text-sm font-semibold text-ink">{t('savedAddress')}
              <select defaultValue={firstSaved?.id ?? ''} onChange={(e) => pickSaved(e.target.value)} className={field}>
                <option value="">{t('newAddress')}</option>
                {savedAddresses.map((a) => <option key={a.id} value={a.id}>{a.governorate} · {a.city} · {a.area}</option>)}
              </select>
            </label>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {!isLoggedIn && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-ink">{t('email')}
                  <input name="guestEmail" type="email" value={guestEmail} onChange={(e) => { setGuestEmail(e.target.value); setFieldErrors((f) => (f.guestEmail ? { ...f, guestEmail: '' } : f)); }} {...fieldProps('guestEmail')} />
                  {fieldError('guestEmail')}
                </label>
                {/* P2-6: opt-in account creation — details saved, set-password link emailed. */}
                <label className="mt-2 flex items-start gap-2 text-sm text-ink">
                  <input type="checkbox" name="createAccount" className="mt-0.5 size-4 accent-[color:var(--green-dark)]" />
                  <span>
                    {t('createAccount')}
                    <span className="block text-xs font-normal text-[color:var(--text-muted)]">{t('createAccountHint')}</span>
                  </span>
                </label>
              </div>
            )}
            <label className="block text-sm font-semibold text-ink">{t('fullName')}
              <input name="name" value={addr.name} onChange={set('name')} {...fieldProps('name')} />
              {fieldError('name')}
            </label>
            <label className="block text-sm font-semibold text-ink">{t('phone')}
              <PhoneInput
                name="phone"
                value={addr.phone}
                onChange={(v) => { setAddr((a) => ({ ...a, phone: v })); setFieldErrors((f) => (f.phone ? { ...f, phone: '' } : f)); }}
                required
                error={fieldErrors.phone || undefined}
              />
            </label>
            <label className="block text-sm font-semibold text-ink">{t('governorate')}
              <select
                name="governorate"
                value={addr.governorate}
                // Changing governorate invalidates the district: keeping a Cairo
                // district selected under Giza would post an address that cannot
                // be delivered, and looks correct on screen.
                onChange={(e) => {
                  const gov = e.target.value;
                  const stillValid = (cities[gov] ?? []).some((c) => (locale === 'ar' ? c.nameAr : c.nameEn) === addr.city);
                  setAddr((a) => ({ ...a, governorate: gov, city: stillValid ? a.city : '' }));
                  setFieldErrors((f) => (f.governorate || f.city ? { ...f, governorate: '', city: '' } : f));
                }}
                {...fieldProps('governorate')}
              >
                <option value="" disabled>{t('selectGovernorate')}</option>
                {GOVERNORATES.map((g) => <option key={g.en} value={g.en}>{locale === 'ar' ? g.ar : g.en}</option>)}
              </select>
              {fieldError('governorate')}
            </label>
            <CitySelect
              value={addr.city}
              governorate={addr.governorate}
              cities={cities}
              locale={locale}
              onChange={(v) => { setAddr((a) => ({ ...a, city: v })); setFieldErrors((f) => (f.city ? { ...f, city: '' } : f)); }}
              label={t('city')}
              chooseLabel={t('selectCity')}
              otherLabel={t('cityOther')}
              pickGovernorateFirstLabel={t('selectGovernorateFirst')}
              className={field}
              error={fieldError('city')}
            />
            <label className="block text-sm font-semibold text-ink sm:col-span-2">{t('street')}
              <input name="street" value={addr.street} onChange={set('street')} {...fieldProps('street')} />
              {fieldError('street')}
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
          {/* P2-7: collapsed by default behind a chevron. The panel stays mounted
              (hidden) so a typed code survives collapsing and still submits. */}
          <button
            type="button"
            onClick={() => setDiscountsOpen((o) => !o)}
            aria-expanded={discountsOpen}
            aria-controls="discounts-panel"
            className="flex w-full items-center justify-between text-start text-lg font-bold text-green-dark"
          >
            <span>{t('haveDiscount')}</span>
            <span aria-hidden className={`text-sm transition-transform ${discountsOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>
          <div id="discounts-panel" hidden={!discountsOpen} className="mt-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <CouponField locale={locale} className={field} />
              {isLoggedIn && pointsBalance > 0 && (
                <label className="block text-sm font-semibold text-ink">{t('redeemPoints')} <span className="font-normal text-[color:var(--text-muted)]">{t('redeemPointsHint', { balance: pointsBalance, rate: pointsPerEgp })}</span>
                  <input name="redeemPoints" type="number" min="0" max={pointsBalance} step={pointsPerEgp} defaultValue="0" className={field} />
                </label>
              )}
            </div>
            <p className="mt-1 text-xs text-[color:var(--text-muted)]">{t('discountsNote')}</p>
          </div>
        </section>

        <section>
          <h2 className={heading}>{t('payment')}</h2>
          {/* Radio cards, matching the delivery list above (owner 2026-07-22) —
              a dropdown hid the choices behind a click; these are all visible. */}
          <div className="space-y-2">
            {visiblePayment.map((m) => {
              const selected = effectivePayment === m.key;
              const note = paymentNotes[m.key];
              return (
                <label
                  key={m.key}
                  className={`block cursor-pointer rounded-[10px] border p-3.5 text-sm transition-colors ${
                    selected ? 'border-[1.5px] border-green-dark bg-green-wash' : 'border-[color:var(--slate-border)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={m.key}
                      checked={selected}
                      onChange={() => setPayment(m.key)}
                      className="accent-[color:var(--green-dark)]"
                    />
                    <span className="text-ink">{tPay.has(m.key) ? tPay(m.key) : m.label}</span>
                  </span>
                  {/* Only under the SELECTED method (owner 2026-07-23): showing all
                      seven at once turns the list into a wall of text and buries
                      the choice itself. */}
                  {selected && note && (
                    <span className="mt-2 block ps-[26px] text-xs leading-relaxed text-[color:var(--text-muted)]">{note}</span>
                  )}
                </label>
              );
            })}
          </div>
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
