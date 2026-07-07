'use client';

import { useState } from 'react';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { conditionLabel, isConditionVariant } from '@/lib/lot-condition';
import { addToCartAction, addPreorderToCartAction } from '@/server/cart-actions';
import { useTrack } from '@/components/analytics/analytics-provider';
import { Icon } from '@/components/storefront/ui/icon';
import { Rating } from '@/components/storefront/ui/rating';
import { TierBadge } from '@/components/storefront/ui/tier-badge';
import type { BuyLot } from '@/components/storefront/buy-box';

/**
 * Chewy-pattern PDP buy box: rating + genuine badge, price-per-expiry lot
 * selector, subscribe-&-save (visual Refill = 15% off, no recurring billing),
 * Select-member hint, qty stepper, add-to-cart. Bilingual via pick().
 */
export function ChewyBuyBox({
  brand,
  name,
  rating,
  reviews,
  basePricePiastres,
  lots,
  productId,
  points,
  locale = 'en',
  refillEnabled = false,
  preorderEnabled = false,
  depositPercent = 25,
}: {
  brand?: string;
  name: string;
  rating: number;
  reviews: number;
  basePricePiastres: number;
  lots: BuyLot[];
  productId: string;
  points: number;
  locale?: string;
  refillEnabled?: boolean;
  preorderEnabled?: boolean;
  depositPercent?: number;
}) {
  const t = pick(locale);
  const track = useTrack();
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<'once' | 'refill'>('once');
  const [qty, setQty] = useState(1);
  const lot = lots.length ? lots[selected] : null;
  const variant = isConditionVariant(lot?.condition); // Open-box / Damaged / Broken unit
  // No live lots → pre-order (if enabled) or plain out-of-stock.
  const soldOut = lots.length === 0;
  const preorderMode = soldOut && preorderEnabled;
  const outOfStock = soldOut && !preorderEnabled;
  const unit = lot ? lot.pricePiastres : basePricePiastres;
  const refillUnit = Math.round(unit * 0.85);
  const display = mode === 'refill' ? refillUnit : unit;
  const showWas = lot ? lot.sale || unit < basePricePiastres : false;
  const depositNow = Math.round((unit * qty * depositPercent) / 100);
  const balanceLater = unit * qty - depositNow;

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        {brand && <div className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--text-subtle)]">{brand}</div>}
        <h1 className="mb-3 mt-2 text-[clamp(26px,3vw,34px)] font-bold leading-tight text-ink">{name}</h1>
        <div className="flex flex-wrap items-center gap-3.5">
          <Rating value={rating} count={reviews} emptyLabel={t('Be the first to review', 'كن أول من يقيّم')} />
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-success">
            <Icon name="badge-check" size={16} color="var(--success)" /> {t('Genuine guaranteed', 'أصلي مضمون')}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-4xl font-bold text-green-dark">{formatEGP(display)}</span>
        {showWas && <span className="text-[17px] text-[color:var(--text-subtle)] line-through">{formatEGP(basePricePiastres)}</span>}
        {points > 0 && !soldOut && <span className="text-[13px] font-semibold text-gold-deep">★ {t(`Earn ${points} pts`, `اكسب ${points} نقطة`)}</span>}
      </div>

      {preorderMode && (
        <div className="rounded-[12px] border border-[color:var(--gold)] bg-gold-wash p-4">
          <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
            <Icon name="calendar-clock" size={17} color="var(--gold-deep)" /> {t('Available to pre-order', 'متاح للطلب المسبق')}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--text-muted)]">
            {t(
              `Out of stock right now. Reserve yours with a ${depositPercent}% deposit — we charge ${formatEGP(depositNow)} now and the ${formatEGP(balanceLater)} balance on delivery when it arrives.`,
              `غير متوفر حاليًا. احجز نسختك بعربون ${depositPercent}٪ — نحصّل ${formatEGP(depositNow)} الآن و${formatEGP(balanceLater)} المتبقية عند التوصيل حين توفّره.`,
            )}
          </p>
        </div>
      )}

      {outOfStock && (
        <div className="flex items-center gap-2.5 rounded-[12px] bg-surface px-3.5 py-3">
          <Icon name="package" size={18} color="var(--slate-45)" />
          <span className="text-[13px] font-medium text-[color:var(--text-muted)]">
            {t('Out of stock right now. Check back soon.', 'غير متوفر حاليًا. تحقّق قريبًا.')}
          </span>
        </div>
      )}

      {lots.length > 1 && (
        <div>
          <div className="mb-2.5 flex items-center gap-1.5 text-[13px] font-bold text-slate">
            <Icon name="calendar-clock" size={15} color="var(--gold-deep)" /> {t('Choose your expiry & price', 'اختر الصلاحية والسعر')}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {lots.map((l, i) => {
              const on = selected === i;
              const pct = l.pricePiastres < basePricePiastres ? Math.round((1 - l.pricePiastres / basePricePiastres) * 100) : 0;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => { setSelected(i); if (isConditionVariant(l.condition)) setQty((q) => Math.min(q, Math.max(1, l.qty))); }}
                  className={`min-w-[100px] rounded-[12px] px-3.5 py-2.5 text-start ${on ? 'border-[1.5px] border-green-dark bg-green-wash' : 'border border-[color:var(--slate-border)] bg-white'}`}
                >
                  {isConditionVariant(l.condition) && (
                    <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-gold-deep">{conditionLabel(l.condition, locale)}</div>
                  )}
                  <div className="text-xs text-[color:var(--text-muted)]">{l.expiry ? t(`Exp ${l.expiry}`, `الصلاحية ${l.expiry}`) : t('No expiry', 'بدون صلاحية')}</div>
                  <div className={`text-[17px] font-bold ${on ? 'text-green-dark' : 'text-ink'}`}>{formatEGP(l.pricePiastres)}</div>
                  {pct > 0 && <div className="text-[11px] font-bold text-gold-deep">−{pct}%</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {variant && lot && (
        <div className="flex items-center gap-2.5 rounded-[12px] bg-gold-wash px-3.5 py-3">
          <Icon name="package-open" size={18} color="var(--gold-deep)" />
          <span className="text-[13px] font-medium text-ink">
            {t(
              `${conditionLabel(lot.condition, 'en')} unit — genuine product, discounted for its packaging condition. Only ${lot.qty} left.`,
              `وحدة ${conditionLabel(lot.condition, 'ar')} — منتج أصلي بسعر مخفَّض بسبب حالة العبوة. متبقٍ ${lot.qty} فقط.`,
            )}
          </span>
        </div>
      )}

      {refillEnabled && !soldOut && (
      <div className="flex flex-col gap-2.5">
        {(
          [
            { k: 'once', tEn: 'Buy once', tAr: 'شراء لمرة', sEn: 'Single delivery', sAr: 'توصيلة واحدة', price: unit, badge: false },
            { k: 'refill', tEn: 'Subscribe with Refill', tAr: 'اشترك مع ريفيل', sEn: 'Save 15% · every 30 days · cancel anytime', sAr: 'وفّر ١٥٪ · كل ٣٠ يومًا · ألغِ متى شئت', price: refillUnit, badge: true },
          ] as const
        ).map((o) => {
          const on = mode === o.k;
          return (
            <button
              key={o.k}
              type="button"
              onClick={() => setMode(o.k)}
              className={`flex items-center gap-3.5 rounded-[14px] px-4 py-3.5 text-start ${on ? 'border-[1.5px] border-green-dark bg-green-wash' : 'border border-[color:var(--slate-border)] bg-white'}`}
            >
              <span className={`flex size-[22px] shrink-0 items-center justify-center rounded-full ${on ? 'bg-green-dark' : 'border-2 border-[color:var(--slate-border)]'}`}>
                {on && <Icon name="check" size={13} color="#fff" strokeWidth={3} />}
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[14.5px] font-bold text-ink">{t(o.tEn, o.tAr)}</span>
                  {o.badge && <span className="rounded-full bg-lime px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-green-dark">{t('Best value', 'أفضل قيمة')}</span>}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-[color:var(--text-muted)]">{t(o.sEn, o.sAr)}</span>
              </span>
              <span className="text-[19px] font-bold text-green-dark">{formatEGP(o.price)}</span>
            </button>
          );
        })}
      </div>
      )}

      {!soldOut && (
        <div className="flex items-center gap-2.5 rounded-[12px] bg-green-wash px-3.5 py-3">
          <TierBadge tier="select" />
          <span className="text-[13px] font-medium text-green-dark">
            {t(`Select members pay ${formatEGP(Math.round(display * 0.92))} — sign in to unlock.`, `أعضاء سيلكت يدفعون ${formatEGP(Math.round(display * 0.92))} — سجّل الدخول.`)}
          </span>
        </div>
      )}

      {outOfStock ? (
        <button type="button" disabled className="v-btn v-btn--lg v-btn--block cursor-not-allowed opacity-60">
          {t('Out of stock', 'غير متوفر')}
        </button>
      ) : (
        <form action={preorderMode ? addPreorderToCartAction : addToCartAction} className="flex items-stretch gap-3">
          <input type="hidden" name="productId" value={productId} />
          {/* A condition variant is a specific physical unit — pin its exact lot. */}
          {variant && lot && <input type="hidden" name="lotId" value={lot.id} />}
          <input type="hidden" name="qty" value={qty} />
          <input type="hidden" name="locale" value={locale} />
          <div className="flex flex-none items-center rounded-full border border-[color:var(--slate-border)] px-1.5">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label={t('Decrease', 'إنقاص')} className="flex size-9 items-center justify-center text-slate">
              <Icon name="minus" size={16} color="var(--slate)" />
            </button>
            <span className="w-7 text-center text-[15px] font-bold text-ink">{qty}</span>
            <button
              type="button"
              onClick={() => setQty(variant && lot ? Math.min(lot.qty, qty + 1) : qty + 1)}
              aria-label={t('Increase', 'زيادة')}
              className="flex size-9 items-center justify-center text-slate"
            >
              <Icon name="plus" size={16} color="var(--slate)" />
            </button>
          </div>
          <button
            type="submit"
            onClick={() => { if (!preorderMode) track('add_to_cart', { productId, qty }); }}
            className="v-btn v-btn--primary v-btn--lg v-btn--block"
          >
            <span className="v-btn__icon" aria-hidden="true">
              <Icon name={preorderMode ? 'calendar-clock' : 'shopping-cart'} size={18} />
            </span>
            {preorderMode
              ? t('Pre-order now', 'اطلب مسبقًا الآن')
              : mode === 'refill'
                ? t('Add Refill to Cart', 'أضف ريفيل للسلة')
                : t('Add to Cart', 'أضف للسلة')}
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-[color:var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5"><Icon name="truck" size={16} color="var(--green-mid)" /> {t('Delivery in 2–4 days', 'التوصيل خلال ٢–٤ أيام')}</span>
        <span className="inline-flex items-center gap-1.5"><Icon name="repeat" size={16} color="var(--green-mid)" /> {t('Easy returns', 'إرجاع سهل')}</span>
        <span className="inline-flex items-center gap-1.5"><Icon name="message-circle" size={16} color="var(--green-mid)" /> {t('Ask a pharmacist', 'اسأل صيدليًا')}</span>
      </div>
    </div>
  );
}
