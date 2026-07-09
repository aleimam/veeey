'use client';

import { useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { searchCollectionProductsAction, type PickerProduct } from '@/server/collection-actions';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from './ui';

/**
 * Searchable manual product picker for collections (V3-COL-2). Replaces the
 * unusable native multi-select: search by name/SKU/brand, add/remove without
 * losing the whole selection, drag (or ↑/↓) to reorder. Emits one hidden
 * `productIds` input per selected product IN ORDER, so the server reads the
 * display order straight from `fd.getAll('productIds')`.
 */
export function CollectionProductPicker({ initial, onDirty }: { initial: PickerProduct[]; onDirty?: () => void }) {
  const tb = pick(useLocale());
  const [items, setItems] = useState<PickerProduct[]>(initial);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PickerProduct[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const seq = useRef(0);

  const touch = (next: PickerProduct[]) => { setItems(next); onDirty?.(); };
  const has = (id: string) => items.some((p) => p.id === id);

  async function runSearch(term: string) {
    setQ(term);
    const my = ++seq.current;
    if (term.trim().length < 2) { setHits([]); return; }
    const res = await searchCollectionProductsAction(term);
    if (my === seq.current) setHits(res);
  }
  const add = (p: PickerProduct) => { if (!has(p.id)) touch([...items, p]); setQ(''); setHits([]); };
  const remove = (id: string) => touch(items.filter((p) => p.id !== id));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    touch(next);
  };

  const thumbBox = 'size-9 shrink-0 rounded border border-border bg-surface object-cover';
  return (
    <div className="space-y-3">
      {/* Ordered hidden inputs — the server reads getAll('productIds') in order. */}
      {items.map((p) => <input key={p.id} type="hidden" name="productIds" value={p.id} />)}

      <div className="relative">
        <input
          value={q}
          onChange={(e) => runSearch(e.target.value)}
          placeholder={tb('Search products by name, SKU or brand…', 'ابحث عن المنتجات بالاسم أو SKU أو العلامة…')}
          className={inputCls}
        />
        {hits.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-card shadow-md">
            {hits.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => add(h)}
                disabled={has(h.id)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-start text-sm hover:bg-surface disabled:opacity-40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail, arbitrary hosts */}
                {h.thumb ? <img src={h.thumb} alt="" className={thumbBox} /> : <span className={`${thumbBox} grid place-items-center text-muted-foreground`}>▦</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{h.name}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">{h.sku}{h.brand ? ` · ${h.brand}` : ''}</span>
                </span>
                {has(h.id) && <span className="text-xs text-primary">✓ {tb('added', 'مضاف')}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
          <span>{tb(`${items.length} product(s) selected`, `${items.length} منتج محدد`)}</span>
          <span>{tb('Drag or use ↑/↓ to order', 'اسحب أو استخدم ↑/↓ للترتيب')}</span>
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{tb('No products yet — search above to add.', 'لا منتجات بعد — ابحث بالأعلى للإضافة.')}</p>
        ) : (
          <ul>
            {items.map((p, i) => (
              <li
                key={p.id}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); }}
                className={`flex items-center gap-2 border-t border-border px-2 py-1.5 first:border-t-0 ${dragIdx === i ? 'opacity-50' : ''}`}
              >
                <span className="cursor-grab select-none text-muted-foreground" aria-hidden>⠿</span>
                <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail, arbitrary hosts */}
                {p.thumb ? <img src={p.thumb} alt="" className={thumbBox} /> : <span className={`${thumbBox} grid place-items-center text-muted-foreground`}>▦</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">{p.sku}{p.brand ? ` · ${p.brand}` : ''}</span>
                </span>
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={tb('Move up', 'أعلى')}>↑</button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={tb('Move down', 'أسفل')}>↓</button>
                <button type="button" onClick={() => remove(p.id)} className="px-1.5 text-muted-foreground hover:text-destructive" aria-label={tb('Remove', 'إزالة')}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
