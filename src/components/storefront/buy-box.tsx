'use client';

import { useState } from 'react';
import { formatEGP, formatPoints } from '@/lib/format';
import { addToCartAction } from '@/server/cart-actions';

export type BuyLot = {
  id: string;
  expiry: string; // e.g. "05/2028"
  pricePiastres: number;
  sale: boolean;
  qty: number;
};

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
  const [selected, setSelected] = useState(0);

  if (lots.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-2xl font-semibold text-foreground">{formatEGP(basePricePiastres)}</p>
        <span className="mt-2 inline-flex rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-slate">
          Pre-order · ~25% deposit
        </span>
        <p className="mt-3 text-sm text-muted-foreground">
          Not in stock right now — reserve it with a 25% deposit and we’ll special-order it for you.
        </p>
        <button className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:opacity-90">
          Pre-order
        </button>
      </div>
    );
  }

  const lot = lots[selected];
  const points = Math.round(lot.pricePiastres / 100);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-foreground">{formatEGP(lot.pricePiastres)}</span>
        {lot.sale && (
          <span className="text-sm text-muted-foreground line-through">{formatEGP(basePricePiastres)}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Earn {formatPoints(points)} points</p>

      {lots.length > 1 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-foreground">Choose expiry</p>
          <div className="flex flex-wrap gap-2">
            {lots.map((l, i) => (
              <button
                key={l.id}
                onClick={() => setSelected(i)}
                className={
                  i === selected
                    ? 'rounded-lg border-2 border-primary px-3 py-2 text-sm'
                    : 'rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/50'
                }
              >
                <span className="block font-medium">{formatEGP(l.pricePiastres)}</span>
                <span className="block text-xs text-muted-foreground">
                  Exp {l.expiry}{l.sale ? ' · sale' : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        <span className="size-1.5 rounded-full bg-primary" /> In stock
      </span>

      <form action={addToCartAction} className="mt-4">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="qty" value="1" />
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="w-full rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:opacity-90">
          Add to cart
        </button>
      </form>
    </div>
  );
}
