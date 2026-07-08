'use client';

import { useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { searchOrderProductsAction } from '@/server/order-actions';
import type { OrderProductHit } from '@/lib/order-service';
import { formatEGP } from '@/lib/format';
import { conditionLabel, isConditionVariant } from '@/lib/lot-condition';
import { inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';

/**
 * Staff order line picker (backend orders, Phase B): search a product by name /
 * SKU / id (incl. legacy EV keys), then pick an exact expiry (lot) — each shown
 * with its available stock + per-expiry price — or leave "Any (FEFO)".
 * Emits hidden `productId` + `lotId` and a visible `qty` input so it works
 * inside any form; ALWAYS renders all three so parallel-array rows stay aligned.
 * Quantities above stock show the pre-order warning (owner decision: available
 * units are deducted, the shortfall flags the order as Special Order).
 */
export function ProductLinePicker({ depositPercent = 25, onRemove }: { depositPercent?: number; onRemove?: () => void }) {
  const tb = pick(useLocale());
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<OrderProductHit[]>([]);
  const [product, setProduct] = useState<OrderProductHit | null>(null);
  const [lotId, setLotId] = useState('');
  const [qty, setQty] = useState(1);
  const searchSeq = useRef(0);

  async function runSearch(term: string) {
    setQ(term);
    const my = ++searchSeq.current;
    if (term.trim().length < 2) { setHits([]); return; }
    const res = await searchOrderProductsAction(term);
    if (my === searchSeq.current) setHits(res);
  }

  const totalAvailable = product ? product.lots.reduce((s, l) => s + l.available, 0) : 0;
  const lot = product?.lots.find((l) => l.id === lotId) ?? null;
  const available = product ? (lot ? lot.available : totalAvailable) : 0;
  const shortfall = product ? Math.max(0, qty - available) : 0;
  const unitPrice = lot ? lot.pricePiastres : product?.basePricePiastres ?? 0;
  const suggestedDeposit = Math.round((unitPrice * shortfall * depositPercent) / 100);

  const lotLabel = (l: OrderProductHit['lots'][number]) =>
    `${l.expiry ? `${tb('Exp', 'صلاحية')} ${l.expiry}` : tb('No expiry', 'بدون صلاحية')}${isConditionVariant(l.condition) ? ` · ${conditionLabel(l.condition, 'en')}` : ''} · ${l.available} ${tb('avail', 'متاح')} · ${formatEGP(l.pricePiastres)}`;

  return (
    <div className="rounded-lg border border-border p-3">
      {/* Always-rendered fields keep productId/lotId/qty arrays index-aligned. */}
      <input type="hidden" name="productId" value={product?.id ?? ''} />
      <input type="hidden" name="lotId" value={lotId} />

      {product ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <div className="text-sm font-medium text-foreground">{product.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{product.sku} · {totalAvailable > 0 ? `${totalAvailable} ${tb('in stock', 'في المخزون')}` : tb('out of stock', 'غير متوفر')}</div>
          </div>
          <label className="block text-sm font-medium">{tb('Expiry / lot', 'الصلاحية / الدفعة')}
            <select value={lotId} onChange={(e) => setLotId(e.target.value)} className={`${inputCls} min-w-56`}>
              <option value="">{tb('Any (FEFO — nearest expiry first)', 'أي (الأقرب انتهاءً أولًا)')}</option>
              {product.lots.map((l) => <option key={l.id} value={l.id}>{lotLabel(l)}</option>)}
            </select>
          </label>
          <label className="block w-24 text-sm font-medium">{tb('Qty', 'الكمية')}
            <input name="qty" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
          </label>
          <button type="button" onClick={() => { setProduct(null); setLotId(''); setQty(1); }} className="mb-1 text-sm text-muted-foreground hover:text-foreground">{tb('Change', 'تغيير')}</button>
          {onRemove && (
            <button type="button" onClick={onRemove} className="mb-1 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-destructive" aria-label={tb('Remove row', 'إزالة السطر')}>✕</button>
          )}
        </div>
      ) : (
        <div className="flex items-end gap-3">
          <div className="relative flex-1">
            <label className="block text-sm font-medium">{tb('Product', 'المنتج')}
              <input value={q} onChange={(e) => runSearch(e.target.value)} placeholder={tb('Search name, SKU or ID…', 'ابحث بالاسم أو SKU أو المعرّف…')} className={inputCls} />
            </label>
            {hits.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-card shadow-md">
                {hits.map((h) => {
                  const avail = h.lots.reduce((s, l) => s + l.available, 0);
                  return (
                    <button key={h.id} type="button" onClick={() => { setProduct(h); setHits([]); setQ(''); setLotId(''); }} className="block w-full px-3 py-2 text-start text-sm hover:bg-surface">
                      <span className="font-medium">{h.name}</span>
                      <span className="ms-2 font-mono text-xs text-muted-foreground">{h.sku}</span>
                      <span className={`ms-2 text-xs ${avail > 0 ? 'text-primary' : 'text-destructive'}`}>{avail > 0 ? `${avail} ${tb('in stock', 'متوفر')}` : tb('out of stock — pre-order', 'غير متوفر — طلب مسبق')}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Placeholder qty keeps array alignment before a product is picked. */}
          <input type="hidden" name="qty" value={product ? qty : 0} />
          {onRemove && (
            <button type="button" onClick={onRemove} className="mb-1 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-destructive" aria-label={tb('Remove row', 'إزالة السطر')}>✕</button>
          )}
        </div>
      )}

      {product && shortfall > 0 && (
        <div className="mt-2 rounded-md border border-[color:var(--gold,#e9a800)] bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          ⚠ {available > 0
            ? tb(`Only ${available} in stock — the extra ${shortfall} unit(s) will be added as PRE-ORDER and the order flagged as a Special Order.`,
                 `متاح ${available} فقط — سيُضاف ${shortfall} كطلب مسبق وسيُعلَّم الطلب كطلب خاص.`)
            : tb(`Out of stock — all ${qty} unit(s) will be a PRE-ORDER (Special Order).`,
                 `غير متوفر — سيكون كامل الكمية (${qty}) طلبًا مسبقًا (طلب خاص).`)}
          {' '}{tb(`Suggested deposit ${depositPercent}% ≈ ${formatEGP(suggestedDeposit)} (informational — record what the customer actually pays).`,
                   `العربون المقترح ${depositPercent}٪ ≈ ${formatEGP(suggestedDeposit)} (استرشادي — سجّل ما يدفعه العميل فعليًا).`)}
        </div>
      )}
    </div>
  );
}
