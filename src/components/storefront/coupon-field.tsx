'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { formatEGP } from '@/lib/format';
import { checkCouponAction, type CouponPreview } from '@/server/coupon-actions';

/**
 * Coupon code + Apply (owner 2026-07-23).
 *
 * The field used to say only "discounts are applied on the next step" — so a
 * mistyped or expired code produced no discount and no message, and the shopper
 * had nothing to go on but a total that looked wrong. Apply answers immediately,
 * and specifically: "expired" and "spend EGP 300 to use this" are different
 * problems with different fixes, and a single "invalid code" hides both.
 *
 * The input keeps its `name`, so the code still travels with the form whether or
 * not Apply was pressed — placement re-checks it either way.
 */
export function CouponField({ locale, className }: { locale: string; className: string }) {
  const t = useTranslations('storefront.checkout');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<CouponPreview | null>(null);
  const [pending, start] = useTransition();

  const apply = () => {
    start(async () => setResult(await checkCouponAction({ code, locale })));
  };

  const message = (r: CouponPreview): string => {
    if (r.ok) return t('couponApplied', { amount: formatEGP(r.discountPiastres) });
    if (r.reason === 'min_spend' && r.minSpendPiastres != null) {
      return t('couponMinSpend', { amount: formatEGP(r.minSpendPiastres) });
    }
    // Every named failure gets its own line; `couponInvalid` is the fallback for
    // a reason the engine adds later, so a new case degrades to vague rather
    // than to a blank message.
    const key = `coupon_${r.reason}`;
    return t.has(key) ? t(key) : t('coupon_invalid');
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-ink" htmlFor="couponCode">{t('couponCode')}</label>
      <div className="mt-1 flex items-stretch gap-2">
        <input
          id="couponCode"
          name="couponCode"
          value={code}
          onChange={(e) => { setCode(e.target.value); setResult(null); }}
          onKeyDown={(e) => {
            // Enter inside a checkout form would otherwise SUBMIT THE ORDER.
            if (e.key === 'Enter') { e.preventDefault(); apply(); }
          }}
          placeholder={t('couponPlaceholder')}
          aria-invalid={result ? !result.ok : undefined}
          aria-describedby={result ? 'coupon-msg' : undefined}
          className={`${className} flex-1`}
        />
        <button
          type="button"
          onClick={apply}
          disabled={pending || !code.trim()}
          className="v-btn v-btn--secondary shrink-0 px-5 disabled:opacity-50"
        >
          {pending ? t('couponChecking') : t('couponApply')}
        </button>
      </div>
      {result && (
        <p
          id="coupon-msg"
          role="status"
          className={`mt-1.5 text-xs font-semibold ${result.ok ? 'text-success' : 'text-error'}`}
        >
          {message(result)}
        </p>
      )}
    </div>
  );
}
