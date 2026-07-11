'use client';

import { useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { recordCountsAction } from '@/server/inventory-actions';
import type { SheetRow } from '@/lib/stocktake-service';
import { conditionLabel, isConditionVariant } from '@/lib/lot-condition';
import { inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';

/**
 * Stocktake count sheet (V4 D15–D17 + D21). Counts live in local state:
 * variance computes AS YOU TYPE (color-coded), search/filters/pagination are
 * client-side (the sheet is a few hundred rows), a progress bar tracks
 * counted/total, barcode scans (SKU + Enter) jump to & increment the matching
 * row, and "Save all" batches every dirty row to the server — which only
 * RECORDS them; nothing hits live stock until the reconcile step is approved.
 * Blind sessions hide Expected + variance during counting.
 */

type Entry = { qty: string; reason: string; dirty: boolean };
const PER_PAGE = 50;

export function StocktakeSheet({ sessionId, rows, blind, readOnly }: { sessionId: string; rows: SheetRow[]; blind: boolean; readOnly: boolean }) {
  const tb = pick(useLocale());
  const locale = useLocale();
  const router = useRouter();
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(rows.map((r) => [r.lotId, { qty: r.counted != null ? String(r.counted) : '', reason: r.reason ?? '', dirty: false }])),
  );
  const [q, setQ] = useState('');
  const [state, setState] = useState<'all' | 'uncounted' | 'counted' | 'variance'>('all');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null); // lotId highlighted by a scan
  const [scanMiss, setScanMiss] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const brands = useMemo(() => [...new Set(rows.map((r) => r.brand).filter((b): b is string => !!b))].sort(), [rows]);
  const categories = useMemo(() => [...new Set(rows.flatMap((r) => r.categories))].sort(), [rows]);

  const countedOf = (r: SheetRow): number | null => {
    const v = entries[r.lotId]?.qty ?? '';
    return v === '' ? null : Math.max(0, Math.floor(Number(v)));
  };
  const varianceOf = (r: SheetRow): number | null => {
    const c = countedOf(r);
    return c == null ? null : c - r.expected;
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !r.name.toLowerCase().includes(term) && !(r.nameAr ?? '').includes(q.trim()) && !r.sku.toLowerCase().includes(term)) return false;
      if (brand && r.brand !== brand) return false;
      if (category && !r.categories.includes(category)) return false;
      const c = countedOf(r);
      if (state === 'uncounted' && c != null) return false;
      if (state === 'counted' && c == null) return false;
      if (state === 'variance' && (c == null || c === r.expected)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, state, brand, category, entries]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const countedTotal = rows.filter((r) => countedOf(r) != null).length;
  const dirtyCount = Object.values(entries).filter((e) => e.dirty).length;

  const setEntry = (lotId: string, patch: Partial<Entry>) =>
    setEntries((prev) => ({ ...prev, [lotId]: { ...prev[lotId], ...patch, dirty: true } }));

  function onScan(value: string) {
    const sku = value.trim().toLowerCase();
    if (!sku) return;
    const row = rows.find((r) => r.sku.toLowerCase() === sku) ?? rows.find((r) => r.sku.toLowerCase().includes(sku));
    if (!row) {
      setScanMiss(value.trim());
      return;
    }
    setScanMiss(null);
    const cur = countedOf(row) ?? 0;
    setEntry(row.lotId, { qty: String(cur + 1) });
    // Surface the row: clear filters that would hide it, flash it.
    setQ('');
    setState('all');
    setBrand('');
    setCategory('');
    const idx = rows.indexOf(row);
    setPage(Math.floor(idx / PER_PAGE) + 1);
    setFlash(row.lotId);
    setTimeout(() => setFlash(null), 1200);
    if (scanRef.current) scanRef.current.value = '';
    scanRef.current?.focus();
  }

  async function saveAll() {
    const dirty = rows
      .filter((r) => entries[r.lotId]?.dirty && countedOf(r) != null)
      .map((r) => ({ lotId: r.lotId, countedQty: countedOf(r)!, reason: entries[r.lotId].reason || null }));
    if (dirty.length === 0) return;
    setSaving(true);
    const res = await recordCountsAction(sessionId, dirty);
    setSaving(false);
    if (res.ok) {
      setEntries((prev) => {
        const next = { ...prev };
        for (const d of dirty) next[d.lotId] = { ...next[d.lotId], dirty: false };
        return next;
      });
      router.refresh();
    }
  }

  const varCls = (v: number | null) =>
    v == null ? 'text-muted-foreground' : v === 0 ? 'text-primary' : Math.abs(v) >= 5 ? 'font-bold text-destructive' : 'font-semibold text-amber-600';

  return (
    <div className="space-y-3">
      {/* Progress (D17) */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-2 w-56 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${rows.length ? Math.round((countedTotal / rows.length) * 100) : 0}%` }} />
        </div>
        <span className="text-sm font-medium text-foreground">{countedTotal} / {rows.length} {tb('counted', 'معدود')}</span>
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={saveAll}
              disabled={saving || dirtyCount === 0}
              className="ms-auto rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? tb('Saving…', 'جارٍ الحفظ…') : tb(`Save all (${dirtyCount})`, `حفظ الكل (${dirtyCount})`)}
            </button>
            {dirtyCount > 0 && <span className="text-xs text-amber-600">{tb('Unsaved changes', 'تغييرات غير محفوظة')}</span>}
          </>
        )}
      </div>

      {/* Barcode / scanner entry (D21) */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={scanRef}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onScan((e.target as HTMLInputElement).value);
              }
            }}
            placeholder={tb('Scan / type SKU + Enter → +1 to that lot', 'امسح / اكتب SKU ثم Enter ← +1 لتلك التشغيلة')}
            className={`${inputCls} w-80`}
            inputMode="text"
            autoComplete="off"
          />
          {scanMiss && <span className="text-xs text-destructive">{tb(`No lot matches "${scanMiss}".`, `لا تشغيلة تطابق "${scanMiss}".`)}</span>}
        </div>
      )}

      {/* Search + filters (D16) */}
      <div className="flex flex-wrap items-end gap-2">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={tb('Search name / SKU…', 'ابحث بالاسم / SKU…')} className={`${inputCls} w-56`} />
        <select value={state} onChange={(e) => { setState(e.target.value as typeof state); setPage(1); }} className={inputCls}>
          <option value="all">{tb('All rows', 'كل الصفوف')}</option>
          <option value="uncounted">{tb('Uncounted', 'غير معدود')}</option>
          <option value="counted">{tb('Counted', 'معدود')}</option>
          <option value="variance">{tb('Has variance', 'به فرق')}</option>
        </select>
        <select value={brand} onChange={(e) => { setBrand(e.target.value); setPage(1); }} className={inputCls}>
          <option value="">{tb('All brands', 'كل العلامات')}</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className={inputCls}>
          <option value="">{tb('All categories', 'كل الفئات')}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} {tb('rows', 'صف')}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{tb('Product', 'المنتج')}</th>
              <th className="p-3 text-start">{tb('Expiry', 'الصلاحية')}</th>
              {!blind && <th className="p-3 text-center">{tb('Expected', 'المتوقع')}</th>}
              <th className="p-3 text-center">{tb('Counted', 'المعدود')}</th>
              {!blind && <th className="p-3 text-center">{tb('Variance', 'الفرق')}</th>}
              <th className="p-3 text-start">{tb('Reason', 'السبب')}</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const v = varianceOf(r);
              const e = entries[r.lotId];
              return (
                <tr key={r.lotId} className={`border-t border-border ${flash === r.lotId ? 'bg-gold/15' : ''}`}>
                  <td className="p-3">
                    <span className="font-medium">{locale === 'ar' ? r.nameAr || r.name : r.name}</span>{' '}
                    <span className="font-mono text-xs text-muted-foreground">{r.sku}</span>
                    {isConditionVariant(r.condition) && <span className="ms-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">{conditionLabel(r.condition, locale)}</span>}
                  </td>
                  <td className="p-3 text-muted-foreground">{r.expiry ?? tb('No expiry', 'بدون صلاحية')}</td>
                  {!blind && <td className="p-3 text-center tabular-nums">{r.expected}</td>}
                  <td className="p-3 text-center">
                    {readOnly ? (
                      <span className="tabular-nums">{countedOf(r) ?? '—'}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        value={e?.qty ?? ''}
                        onChange={(ev) => setEntry(r.lotId, { qty: ev.target.value })}
                        className={`${inputCls} w-20 text-center ${e?.dirty ? 'border-amber-400' : ''}`}
                        aria-label={r.sku}
                      />
                    )}
                  </td>
                  {!blind && (
                    <td className={`p-3 text-center tabular-nums ${varCls(v)}`}>
                      {v == null ? '—' : `${v > 0 ? '+' : ''}${v}`}
                    </td>
                  )}
                  <td className="p-3">
                    {readOnly ? (
                      <span className="text-xs text-muted-foreground">{e?.reason || '—'}</span>
                    ) : (
                      <input
                        value={e?.reason ?? ''}
                        onChange={(ev) => setEntry(r.lotId, { reason: ev.target.value })}
                        placeholder={tb('Reason (for variances)', 'السبب (عند وجود فرق)')}
                        className={`${inputCls} w-44`}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {slice.length === 0 && (
              <tr><td colSpan={blind ? 4 : 6} className="p-6 text-center text-muted-foreground">{tb('No rows match your filters.', 'لا توجد صفوف مطابقة لعوامل التصفية.')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="rounded-md border border-border px-2.5 py-1 disabled:opacity-40">←</button>
          <span className="text-muted-foreground">{safePage} / {pages}</span>
          <button type="button" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} className="rounded-md border border-border px-2.5 py-1 disabled:opacity-40">→</button>
        </div>
      )}
    </div>
  );
}
