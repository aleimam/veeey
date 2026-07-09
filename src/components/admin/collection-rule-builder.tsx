'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { previewCollectionRuleAction } from '@/server/collection-actions';
import type { RuleConfig, RuleCondition } from '@/lib/collection-rules';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from './ui';

type Opt = { value: string; label: string };
export type RuleOptions = {
  categories: Opt[];
  tags: Opt[];
  brands: Opt[];
  attributes: { id: string; name: string; values: Opt[] }[];
};

/**
 * Automatic-collection condition builder (V3-COL-4). Edits a RuleConfig
 * (match mode + conditions over Category / Tag / Brand / Attribute value /
 * Price / Stock), emits it as a hidden `ruleJson` input, and shows a live
 * "matches N products" preview.
 */
export function CollectionRuleBuilder({ initial, options, onDirty }: { initial: RuleConfig; options: RuleOptions; onDirty?: () => void }) {
  const tb = pick(useLocale());
  const [match, setMatch] = useState<RuleConfig['match']>(initial.match);
  const [conds, setConds] = useState<RuleCondition[]>(initial.conditions);
  const [sort, setSort] = useState<NonNullable<RuleConfig['sort']>>(initial.sort ?? 'featured');
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);
  const seq = useRef(0);
  const rule: RuleConfig = { match, conditions: conds, sort };

  const touch = () => onDirty?.();
  const update = (next: RuleCondition[]) => { setConds(next); touch(); };
  const setMatchMode = (m: RuleConfig['match']) => { setMatch(m); touch(); };
  const addCond = () => update([...conds, { field: 'category', op: 'is', value: '' }]);
  const removeCond = (i: number) => update(conds.filter((_, idx) => idx !== i));
  const setCond = (i: number, c: RuleCondition) => update(conds.map((x, idx) => (idx === i ? c : x)));

  // Live preview (debounced) whenever the rule changes.
  useEffect(() => {
    const my = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await previewCollectionRuleAction(JSON.stringify(rule));
        if (my === seq.current) setPreview(r);
      } catch { /* preview is best-effort */ }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rule)]);

  const attrValueOptions: Opt[] = options.attributes.flatMap((a) => a.values.map((v) => ({ value: v.value, label: `${a.name}: ${v.label}` })));

  return (
    <div className="space-y-3">
      <input type="hidden" name="ruleJson" value={JSON.stringify(rule)} />

      <label className="flex items-center gap-2 text-sm">
        {tb('Match', 'المطابقة')}
        <select value={match} onChange={(e) => setMatchMode(e.target.value as RuleConfig['match'])} className={`${inputCls} w-28`}>
          <option value="ALL">{tb('ALL', 'الكل')}</option>
          <option value="ANY">{tb('ANY', 'أي')}</option>
        </select>
        {tb('of the conditions below', 'من الشروط أدناه')}
      </label>

      <div className="space-y-2">
        {conds.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
            <select
              value={c.field}
              onChange={(e) => {
                const f = e.target.value as RuleCondition['field'];
                // Reset op/value sensibly for the new field.
                if (f === 'price') setCond(i, { field: 'price', op: 'gt', value: 0 });
                else if (f === 'stock') setCond(i, { field: 'stock', op: 'in_stock' });
                else if (f === 'name') setCond(i, { field: 'name', op: 'contains', value: '' });
                else setCond(i, { field: f, op: 'is', value: '' });
              }}
              className={`${inputCls} w-36`}
            >
              <option value="category">{tb('Category', 'الفئة')}</option>
              <option value="tag">{tb('Tag', 'الوسم')}</option>
              <option value="brand">{tb('Brand', 'العلامة')}</option>
              <option value="attribute">{tb('Attribute', 'الخاصية')}</option>
              <option value="name">{tb('Name / SKU', 'الاسم / SKU')}</option>
              <option value="price">{tb('Price (EGP)', 'السعر (ج.م)')}</option>
              <option value="stock">{tb('Stock', 'المخزون')}</option>
            </select>

            {(c.field === 'category' || c.field === 'tag' || c.field === 'brand' || c.field === 'attribute') && (
              <>
                <select value={c.op} onChange={(e) => setCond(i, { ...c, op: e.target.value as 'is' | 'is_not' })} className={`${inputCls} w-24`}>
                  <option value="is">{tb('is', 'هو')}</option>
                  <option value="is_not">{tb('is not', 'ليس')}</option>
                </select>
                <select value={c.value} onChange={(e) => setCond(i, { ...c, value: e.target.value })} className={`${inputCls} min-w-48 flex-1`}>
                  <option value="">{tb('— select —', '— اختر —')}</option>
                  {(c.field === 'category' ? options.categories : c.field === 'tag' ? options.tags : c.field === 'brand' ? options.brands : attrValueOptions).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </>
            )}

            {c.field === 'name' && (
              <>
                <select value={c.op} onChange={(e) => setCond(i, { ...c, op: e.target.value as 'contains' | 'not_contains' })} className={`${inputCls} w-40`}>
                  <option value="contains">{tb('contains', 'يحتوي')}</option>
                  <option value="not_contains">{tb('does not contain', 'لا يحتوي')}</option>
                </select>
                <input type="text" value={c.value} onChange={(e) => setCond(i, { ...c, value: e.target.value })} placeholder={tb('text…', 'نص…')} className={`${inputCls} min-w-48 flex-1`} />
              </>
            )}

            {c.field === 'price' && (
              <>
                <select value={c.op} onChange={(e) => setCond(i, { ...c, op: e.target.value as 'gt' | 'lt' | 'between' })} className={`${inputCls} w-28`}>
                  <option value="gt">{tb('greater than', 'أكبر من')}</option>
                  <option value="lt">{tb('less than', 'أقل من')}</option>
                  <option value="between">{tb('between', 'بين')}</option>
                </select>
                <input type="number" value={c.value} onChange={(e) => setCond(i, { ...c, value: Number(e.target.value) })} className={`${inputCls} w-24`} />
                {c.op === 'between' && (
                  <>
                    <span className="text-sm text-muted-foreground">{tb('and', 'و')}</span>
                    <input type="number" value={c.value2 ?? 0} onChange={(e) => setCond(i, { ...c, value2: Number(e.target.value) })} className={`${inputCls} w-24`} />
                  </>
                )}
              </>
            )}

            {c.field === 'stock' && (
              <select value={c.op} onChange={(e) => setCond(i, { ...c, op: e.target.value as 'in_stock' | 'out_of_stock' })} className={`${inputCls} w-36`}>
                <option value="in_stock">{tb('in stock', 'متوفر')}</option>
                <option value="out_of_stock">{tb('out of stock', 'غير متوفر')}</option>
              </select>
            )}

            <button type="button" onClick={() => removeCond(i)} className="ms-auto text-muted-foreground hover:text-destructive" aria-label={tb('Remove condition', 'إزالة الشرط')}>✕</button>
          </div>
        ))}
        <button type="button" onClick={addCond} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">+ {tb('Add condition', 'إضافة شرط')}</button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        {tb('Sort products by', 'ترتيب المنتجات حسب')}
        <select value={sort} onChange={(e) => { setSort(e.target.value as NonNullable<RuleConfig['sort']>); touch(); }} className={`${inputCls} w-48`}>
          <option value="featured">{tb('Featured (top-rated)', 'مميّز (الأعلى تقييمًا)')}</option>
          <option value="bestselling">{tb('Best selling', 'الأكثر مبيعًا')}</option>
          <option value="newest">{tb('Newest', 'الأحدث')}</option>
          <option value="price_asc">{tb('Price: low to high', 'السعر: من الأقل')}</option>
          <option value="price_desc">{tb('Price: high to low', 'السعر: من الأعلى')}</option>
        </select>
      </label>

      <div className="rounded-md bg-surface px-3 py-2 text-sm">
        {preview
          ? <><span className="font-semibold text-primary">{tb(`${preview.count} products match`, `${preview.count} منتجًا مطابقًا`)}</span>
              {preview.sample.length > 0 && <span className="text-muted-foreground"> — {preview.sample.slice(0, 5).join(' · ')}{preview.count > 5 ? '…' : ''}</span>}</>
          : <span className="text-muted-foreground">{tb('Calculating…', 'جارٍ الحساب…')}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{tb('Products are matched automatically and stay up to date as the catalog changes.', 'تُطابق المنتجات تلقائيًا وتبقى محدّثة مع تغيّر الكتالوج.')}</p>
    </div>
  );
}
