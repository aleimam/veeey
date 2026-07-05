'use client';

import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatEGP, formatPoints } from '@/lib/format';
import { addToCartAction } from '@/server/cart-actions';
import { Chip } from '@/components/storefront/ui/chip';

export type BuyLot = {
  id: string;
  expiry: string | null; // "05/2028", or null for non-perishable (NA)
  pricePiastres: number;
  sale: boolean;
  qty: number;
  condition: string; // 'NEW' or an explicit variant (OPEN_BOX / DAMAGED / BROKEN)
};

const priceFont = { fontFamily: 'var(--font-display)' } as const;

/**
 * PDP purchase panel — price-per-expiry selector (FR-INV-04). Picking a
 * different expiry lot changes the price; nearest-expiry (FEFO) is selected by
 * default. Falls back to a pre-order state (25% deposit) when nothing is in stock.
 */
export function BuyBox({
  basePricePiastres,
  lots,
  productId,
  locale = 'en',
}: {
  basePricePiastres: number;
  lots: BuyLot[];
  productId: string;
  locale?: string;
}) {
  const t = useTranslations('storefront.buyBox');
  const [selected, setSelected] = useState(0);

  if (lots.length === 0) {
    return (
      <div className="rounded-[12px] border border-[color:var(--green-dark-05)] bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-[28px] font-bold text-green-dark" style={priceFont}>{formatEGP(basePricePiastres)}</p>
        <div className="mt-2">
          <Chip variant="sale">{t('preorderBadge')}</Chip>
        </div>
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">{t('preorderNote')}</p>
        <button type="button" className="v-btn v-btn--primary v-btn--block mt-4">
          {t('preorder')}
        </button>
      </div>
    );
  }

  const lot = lots[selected];
  const points = Math.round(lot.pricePiastres / 100);

  return (
    <div className="rounded-[12px] border border-[color:var(--green-dark-05)] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline gap-2">
        <span className="text-[28px] font-bold text-green-dark" style={priceFont}>{formatEGP(lot.pricePiastres)}</span>
        {lot.sale && <span className="text-sm text-[color:var(--text-subtle)] line-through">{formatEGP(basePricePiastres)}</span>}
      </div>
      <p className="mt-1 text-xs font-semibold text-gold-deep">{t('earnPoints', { points: formatPoints(points) })}</p>

      {lots.length > 1 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-ink">{t('chooseExpiry')}</p>
          <div className="flex flex-wrap gap-2">
            {lots.map((l, i) => (
              <button key={l.id} type="button" className="v-lot" aria-pressed={i === selected} onClick={() => setSelected(i)}>
                <span className="v-lot__exp">
                  {l.expiry ? t('exp', { date: l.expiry }) : t('noExpiry')}
                  {l.sale ? ` · ${t('sale')}` : ''}
                </span>
                <span className="v-lot__price">{formatEGP(l.pricePiastres)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <Chip variant="soft" dot>
          {t('inStock')}
        </Chip>
      </div>

      <form action={addToCartAction} className="mt-4">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="qty" value="1" />
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="v-btn v-btn--primary v-btn--block">
          <span className="v-btn__icon" aria-hidden="true">
            <ShoppingCart className="size-full" />
          </span>
          {t('addToCart')}
        </button>
      </form>
    </div>
  );
}
