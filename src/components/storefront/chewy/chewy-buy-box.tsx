'use client';

import { useState } from 'react';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { conditionLabel, isConditionVariant } from '@/lib/lot-condition';
import { addToCartAction, addPreorderToCartAction } from '@/server/cart-actions';
import { startRefillPlanAction } from '@/server/refill-actions';
import { useTrack } from '@/components/analytics/analytics-provider';
import { Icon } from '@/components/storefront/ui/icon';
import { Rating } from '@/components/storefront/ui/rating';
import { TierBadge } from '@/components/storefront/ui/tier-badge';
import { useCartOptional } from '@/components/storefront/cart-store';
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
  servingsPerUnit = null,
  shortHtml = null,
  variantPicker = null,
  slug = '',
  refillFrequencies = [30, 45, 60, 90],
  refillPercent = 15,
  selectEnabled = true,
  selectFrac = 1,
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
  /** Servings/doses per pack — enables the "≈ EGP X / serving" line. */
  servingsPerUnit?: number | null;
  /** Sanitized short-description HTML, shown under the expiry & price selector. */
  shortHtml?: string | null;
  /** Server-rendered variant selector (size/flavor chips) — shown above the expiry picker. */
  variantPicker?: React.ReactNode;
  /** Product slug (EN or localized) — used by the Refill subscribe redirect. */
  slug?: string;
  /** Refill frequency presets (days) from the admin setting. */
  refillFrequencies?: number[];
  /** Refill discount percent (refill.discountPercent setting). */
  refillPercent?: number;
  /** Veeey Select feature flag — hides the members-pricing upsell when off. */
  selectEnabled?: boolean;
  /** Effective Select price as a fraction of base (from FR-PRC-03 tier rules).
   *  1 = no Select discount for this product. */
  selectFrac?: number;
}) {
  const t = pick(locale);
  const track = useTrack();
  const cart = useCartOptional();
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<'once' | 'refill'>('once');
  const [qty, setQty] = useState(1);
  const [freq, setFreq] = useState(refillFrequencies[0] ?? 30);
  const lot = lots.length ? lots[selected] : null;
  const variant = isConditionVariant(lot?.condition); // Open-box / Damaged / Broken unit
  // No live lots → pre-order (if enabled) or plain out-of-stock.
  const soldOut = lots.length === 0;
  const preorderMode = soldOut && preorderEnabled;
  const outOfStock = soldOut && !preorderEnabled;
  const unit = lot ? lot.pricePiastres : basePricePiastres;
  const refillUnit = Math.round(unit * (1 - Math.min(90, Math.max(0, refillPercent)) / 100));
  // A condition variant (Open-box/Damaged) is a one-off physical unit — a
  // recurring plan against it makes no sense, so Refill is forced off there.
  const refillAllowed = refillEnabled && !soldOut && !variant;
  const activeMode = refillAllowed ? mode : 'once';
  const display = activeMode === 'refill' ? refillUnit : unit;
  const showWas = lot ? lot.sale || unit < basePricePiastres : false;
  const depositNow = Math.round((unit * qty * depositPercent) / 100);
  const balanceLater = unit * qty - depositNow;
  // Tracks the SELECTED lot's condition: a NEW unit and an Open-box unit are
  // separate cart lines at separate prices, so switching chips must switch which
  // line this reads.
  const inCartQty = cart?.qtyOf(productId, { condition: lot?.condition ?? 'NEW' }) ?? 0;

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

      <div>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-4xl font-bold text-green-dark">{formatEGP(display)}</span>
          {showWas && <span className="text-[17px] text-[color:var(--text-subtle)] line-through">{formatEGP(basePricePiastres)}</span>}
          {points > 0 && !soldOut && <span className="text-[13px] font-semibold text-gold-deep">★ {t(`Earn ${points} pts`, `اكسب ${points} نقطة`)}</span>}
        </div>
        {servingsPerUnit != null && servingsPerUnit > 0 && (
          <div className="mt-1 text-[13px] text-[color:var(--text-muted)]">
            {t(`≈ ${formatEGP(Math.round(display / servingsPerUnit))} / serving · ${servingsPerUnit} servings per pack`,
               `≈ ${formatEGP(Math.round(display / servingsPerUnit))} / جرعة · ${servingsPerUnit} جرعة في العبوة`)}
          </div>
        )}
      </div>

      {variantPicker}

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

      {/* Key selling points right under the expiry & price selector (owner request). */}
      {shortHtml && (
        <div
          className="veeey-rich rounded-[12px] border border-[color:var(--green-dark-05)] bg-white p-4 text-[14.5px] font-medium leading-relaxed text-ink"
          dangerouslySetInnerHTML={{ __html: shortHtml }}
        />
      )}

      {refillAllowed && (
      <div className="flex flex-col gap-2.5">
        {(
          [
            { k: 'once', tEn: 'Buy once', tAr: 'شراء لمرة', sEn: 'Single delivery', sAr: 'توصيلة واحدة', price: unit, badge: false },
            { k: 'refill', tEn: 'Subscribe with Refill', tAr: 'اشترك مع ريفيل', sEn: `Save ${refillPercent}% · every ${freq} days · cash on delivery · cancel anytime`, sAr: `وفّر ${refillPercent}٪ · كل ${freq} يومًا · دفع عند الاستلام · ألغِ متى شئت`, price: refillUnit, badge: true },
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
        {mode === 'refill' && (
          <div>
            <div className="mb-2 text-[13px] font-bold text-slate">{t('Deliver every', 'التوصيل كل')}</div>
            <div className="flex flex-wrap gap-2">
              {refillFrequencies.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setFreq(d)}
                  className={`rounded-full px-3.5 py-2 text-[13px] font-bold ${freq === d ? 'border-[1.5px] border-green-dark bg-green-wash text-green-dark' : 'border border-[color:var(--slate-border)] bg-white text-ink'}`}
                >
                  {t(`${d} days`, `${d} يومًا`)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {!soldOut && selectEnabled && selectFrac < 1 && (
        <div className="flex items-center gap-2.5 rounded-[12px] bg-green-wash px-3.5 py-3">
          <TierBadge tier="select" />
          <span className="text-[13px] font-medium text-green-dark">
            {t(`Select members pay ${formatEGP(Math.round(display * selectFrac))} — sign in to unlock.`, `أعضاء سيلكت يدفعون ${formatEGP(Math.round(display * selectFrac))} — سجّل الدخول.`)}
          </span>
        </div>
      )}

      {outOfStock ? (
        <button type="button" disabled className="v-btn v-btn--lg v-btn--block cursor-not-allowed opacity-60">
          {t('Out of stock', 'غير متوفر')}
        </button>
      ) : (
        <form
          action={activeMode === 'refill' && !preorderMode ? startRefillPlanAction : preorderMode ? addPreorderToCartAction : addToCartAction}
          // Only the plain add stays on the page. Refill and pre-order are their
          // own flows with their own destinations — intercepting those would
          // strand the shopper mid-journey.
          onSubmit={(e) => {
            if (!cart || preorderMode || activeMode === 'refill') return;
            e.preventDefault();
            cart.add({ productId, qty, lotId: lot?.id, condition: lot?.condition ?? 'NEW' });
          }}
          className="flex items-stretch gap-3"
        >
          <input type="hidden" name="productId" value={productId} />
          {/* Pin the SELECTED lot — the expiry & price chip is a real choice, so the
              cart must reserve exactly that lot (audit: FEFO used to override it). */}
          {lot && <input type="hidden" name="lotId" value={lot.id} />}
          <input type="hidden" name="qty" value={qty} />
          <input type="hidden" name="locale" value={locale} />
          {activeMode === 'refill' && <input type="hidden" name="frequency" value={freq} />}
          {activeMode === 'refill' && <input type="hidden" name="slug" value={slug} />}
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
            disabled={cart?.busyId === productId}
            onClick={() => { if (!preorderMode) track(activeMode === 'refill' ? 'refill_subscribe' : 'add_to_cart', { productId, qty }); }}
            className="v-btn v-btn--primary v-btn--lg v-btn--block"
          >
            <span className="v-btn__icon" aria-hidden="true">
              <Icon name={preorderMode ? 'calendar-clock' : 'shopping-cart'} size={18} />
            </span>
            {preorderMode
              ? t('Pre-order now', 'اطلب مسبقًا الآن')
              : activeMode === 'refill'
                ? t('Start Refill plan', 'ابدأ خطة ريفيل')
                : t('Add to Cart', 'أضف للسلة')}
          </button>
        </form>
      )}

      {/* Adding no longer navigates, so the PDP has to say what happened — and
          let the quantity be changed here rather than on a page they left. */}
      {inCartQty > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-[12px] border-[1.5px] border-green-dark bg-green-wash px-3.5 py-2.5">
          <span className="inline-flex items-center gap-2 text-[13px] font-bold text-green-dark">
            <Icon name="check-circle" size={16} color="var(--green-dark)" />
            {t(`${inCartQty} in your cart`, `${inCartQty} في سلتك`)}
          </span>
          <span className="inline-flex items-center rounded-full bg-white px-1">
            <button
              type="button"
              onClick={() => cart?.setQty({ productId, qty: inCartQty - 1, condition: lot?.condition ?? 'NEW' })}
              disabled={cart?.busyId === productId}
              aria-label={inCartQty === 1 ? t('Remove from cart', 'إزالة من السلة') : t('Decrease quantity', 'إنقاص الكمية')}
              className="flex size-8 items-center justify-center text-slate disabled:opacity-40"
            >
              <Icon name={inCartQty === 1 ? 'x' : 'minus'} size={15} color="var(--slate)" />
            </button>
            <span className="min-w-6 text-center text-[15px] font-bold text-ink">{inCartQty}</span>
            <button
              type="button"
              onClick={() => cart?.setQty({ productId, qty: inCartQty + 1, condition: lot?.condition ?? 'NEW' })}
              disabled={cart?.busyId === productId}
              aria-label={t('Increase quantity', 'زيادة الكمية')}
              className="flex size-8 items-center justify-center text-slate disabled:opacity-40"
            >
              <Icon name="plus" size={15} color="var(--slate)" />
            </button>
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-[color:var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5"><Icon name="truck" size={16} color="var(--green-mid)" /> {t('Delivery in 2–4 days', 'التوصيل خلال ٢–٤ أيام')}</span>
        <span className="inline-flex items-center gap-1.5"><Icon name="repeat" size={16} color="var(--green-mid)" /> {t('Easy returns', 'إرجاع سهل')}</span>
        <span className="inline-flex items-center gap-1.5"><Icon name="message-circle" size={16} color="var(--green-mid)" /> {t('Ask a pharmacist', 'اسأل صيدليًا')}</span>
      </div>
    </div>
  );
}
