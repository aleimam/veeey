'use client';

import { useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { searchInventoryProductsAction, type InventoryPickerProduct } from '@/server/inventory-actions';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from './ui';

/**
 * Single-select searchable product picker (V4 C8) — replaces native product
 * dropdowns that silently cap at 200 rows (which also broke pre-selection on
 * lot edit, V4 C7). Search by name / SKU / brand; the pick is emitted as one
 * hidden input (`name` prop; value = product id or SKU via `emit`).
 */
export function ProductSelect({
  name,
  emit = 'id',
  initial = null,
  required = false,
  onSelect,
}: {
  name: string;
  emit?: 'id' | 'sku';
  initial?: InventoryPickerProduct | null;
  required?: boolean;
  onSelect?: (p: InventoryPickerProduct | null) => void;
}) {
  const tb = pick(useLocale());
  const [selected, setSelected] = useState<InventoryPickerProduct | null>(initial);
  const [searching, setSearching] = useState(initial == null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<InventoryPickerProduct[]>([]);
  const seq = useRef(0);

  async function runSearch(term: string) {
    setQ(term);
    const my = ++seq.current;
    if (term.trim().length < 2) { setHits([]); return; }
    const res = await searchInventoryProductsAction(term);
    if (my === seq.current) setHits(res);
  }

  function choose(p: InventoryPickerProduct) {
    setSelected(p);
    setSearching(false);
    setQ('');
    setHits([]);
    onSelect?.(p);
  }

  const thumb = (p: InventoryPickerProduct) =>
    // eslint-disable-next-line @next/next/no-img-element
    p.thumb ? <img src={p.thumb} alt="" className="size-9 shrink-0 rounded border border-border bg-surface object-cover" /> : <div className="size-9 shrink-0 rounded border border-border bg-muted" />;

  return (
    <div className="space-y-1.5">
      <input type="hidden" name={name} value={selected ? (emit === 'sku' ? selected.sku : selected.id) : ''} required={required} />

      {selected && !searching ? (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-card p-2">
          {thumb(selected)}
          <div className="min-w-0 flex-1">
            <div className="line-clamp-1 text-sm font-medium">{selected.name}</div>
            <div className="text-xs text-muted-foreground">{selected.sku}{selected.brand ? ` · ${selected.brand}` : ''}</div>
          </div>
          <button type="button" onClick={() => setSearching(true)} className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface">
            {tb('Change', 'تغيير')}
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={q}
            onChange={(e) => runSearch(e.target.value)}
            placeholder={tb('Search by name, SKU or brand…', 'ابحث بالاسم أو SKU أو العلامة…')}
            className={inputCls}
            autoFocus={searching && selected != null}
          />
          {selected && (
            <button type="button" onClick={() => { setSearching(false); setQ(''); setHits([]); }} className="absolute inset-y-0 end-2 text-xs text-muted-foreground hover:underline">
              {tb('Cancel', 'إلغاء')}
            </button>
          )}
          {hits.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-card shadow-md">
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => choose(h)}
                  className="flex w-full items-center gap-2.5 px-2.5 py-2 text-start hover:bg-surface"
                >
                  {thumb(h)}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 block text-sm font-medium">{h.name}</span>
                    <span className="block text-xs text-muted-foreground">{h.sku}{h.brand ? ` · ${h.brand}` : ''}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
