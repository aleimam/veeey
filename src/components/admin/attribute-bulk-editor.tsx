'use client';

import { useMemo, useState, useTransition } from 'react';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from '@/components/admin/ui';
import { fetchBulkProductsAction, assignValueAction, aiSuggestAction, applyPicksAction } from '@/server/attribute-bulk-actions';
import type { BulkAttribute, BulkProduct } from '@/lib/attribute-bulk-service';

type Opt = { id: string; name: string };

export function AttributeBulkEditor({
  attributes, categories, brands, aiEnabled, locale, initialItems, initialTotal,
}: {
  attributes: BulkAttribute[];
  categories: Opt[];
  brands: Opt[];
  aiEnabled: boolean;
  locale: string;
  initialItems: BulkProduct[];
  initialTotal: number;
}) {
  const t = pick(locale);
  const ar = locale === 'ar';
  const [attributeId, setAttributeId] = useState(attributes[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [q, setQ] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [items, setItems] = useState<BulkProduct[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignValueId, setAssignValueId] = useState('');
  const [picks, setPicks] = useState<Map<string, { attributeValueId: string; valueEn: string }>>(new Map());
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pending, start] = useTransition();

  const attr = useMemo(() => attributes.find((a) => a.id === attributeId), [attributes, attributeId]);
  const valueLabel = (id: string) => {
    const v = attr?.values.find((x) => x.id === id);
    return v ? (ar ? v.valueAr ?? v.valueEn : v.valueEn) : id;
  };
  const nameOf = (p: BulkProduct) => (ar ? p.nameAr ?? p.nameEn : p.nameEn);

  const reload = (over?: Partial<{ attributeId: string; categoryId: string; brandId: string; q: string; onlyMissing: boolean }>) => {
    const f = { attributeId, categoryId, brandId, q, onlyMissing, ...over };
    start(async () => {
      const r = await fetchBulkProductsAction({ attributeId: f.attributeId, categoryId: f.categoryId || undefined, brandId: f.brandId || undefined, q: f.q || undefined, onlyMissing: f.onlyMissing });
      setItems(r.items);
      setTotal(r.total);
      setSelected(new Set());
      setPicks(new Map());
    });
  };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShownSelected = items.length > 0 && items.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(items.map((p) => p.id)));

  const targetIds = () => (selected.size ? [...selected] : items.map((p) => p.id));

  const doAssign = () => {
    if (!assignValueId || selected.size === 0) return;
    start(async () => {
      const r = await assignValueAction({ attributeId, attributeValueId: assignValueId, productIds: [...selected] });
      if (r.error) setMsg({ kind: 'err', text: r.error === 'forbidden' ? t("You don't have permission.", 'ليس لديك صلاحية.') : t('Could not apply.', 'تعذّر التطبيق.') });
      else { setMsg({ kind: 'ok', text: t(`Assigned to ${r.applied} product(s).`, `طُبّق على ${r.applied} منتج.`) }); reload(); }
    });
  };

  const doSuggest = () => {
    const ids = targetIds();
    if (ids.length === 0) return;
    start(async () => {
      const r = await aiSuggestAction({ attributeId, productIds: ids });
      if (r.aiOff) { setMsg({ kind: 'err', text: t('AI is not configured — add an Anthropic key in Providers.', 'الذكاء الاصطناعي غير مُهيّأ — أضف مفتاح Anthropic في المزوّدين.') }); return; }
      if (r.error) { setMsg({ kind: 'err', text: t('AI suggestion failed.', 'فشل اقتراح الذكاء الاصطناعي.') }); return; }
      const m = new Map<string, { attributeValueId: string; valueEn: string }>();
      for (const p of r.picks) m.set(p.productId, { attributeValueId: p.attributeValueId, valueEn: p.valueEn }); // last wins for single-select
      setPicks(m);
      setMsg({ kind: 'ok', text: t(`AI suggested values for ${m.size} product(s) — review, then apply.`, `اقترح الذكاء الاصطناعي قيمًا لـ ${m.size} منتج — راجع ثم طبّق.`) });
    });
  };

  const applyAi = () => {
    if (picks.size === 0) return;
    const pairs = [...picks.entries()].map(([productId, v]) => ({ productId, attributeValueId: v.attributeValueId }));
    start(async () => {
      const r = await applyPicksAction({ attributeId, pairs });
      if (r.error) setMsg({ kind: 'err', text: t('Could not apply.', 'تعذّر التطبيق.') });
      else { setMsg({ kind: 'ok', text: t(`Applied ${r.applied} AI suggestion(s).`, `طُبّق ${r.applied} اقتراحًا.`) }); reload(); }
    });
  };

  const th = 'px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  const td = 'px-3 py-2 text-sm align-middle';

  return (
    <div className="space-y-4">
      {/* Attribute + filters */}
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-medium text-muted-foreground">{t('Attribute', 'الخاصية')}
          <select value={attributeId} onChange={(e) => { setAttributeId(e.target.value); setAssignValueId(''); reload({ attributeId: e.target.value }); }} className={inputCls}>
            {attributes.map((a) => <option key={a.id} value={a.id}>{(ar ? a.nameAr ?? a.nameEn : a.nameEn)}{a.isFilterable ? ' ⚹' : ''}{a.multi ? t(' (multi)', ' (متعدد)') : ''}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">{t('Category', 'الفئة')}
          <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); reload({ categoryId: e.target.value }); }} className={inputCls}>
            <option value="">{t('All', 'الكل')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">{t('Brand', 'العلامة')}
          <select value={brandId} onChange={(e) => { setBrandId(e.target.value); reload({ brandId: e.target.value }); }} className={inputCls}>
            <option value="">{t('All', 'الكل')}</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">{t('Search', 'بحث')}
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') reload(); }} placeholder={t('name or SKU', 'الاسم أو SKU')} className={inputCls} />
        </label>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-foreground"><input type="checkbox" checked={onlyMissing} onChange={(e) => { setOnlyMissing(e.target.checked); reload({ onlyMissing: e.target.checked }); }} /> {t('Only missing', 'الناقص فقط')}</label>
          <button onClick={() => reload()} className="h-9 rounded-md border border-border px-3 text-sm font-medium hover:bg-surface">{t('Refresh', 'تحديث')}</button>
        </div>
      </div>

      {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.kind === 'ok' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{msg.text}</div>}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <span className="text-sm text-muted-foreground">{t(`${selected.size} selected · ${items.length} shown of ${total}`, `${selected.size} محدد · ${items.length} من ${total}`)}</span>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <select value={assignValueId} onChange={(e) => setAssignValueId(e.target.value)} className={`${inputCls} w-44`}>
            <option value="">{t('Value to assign…', 'القيمة المراد تعيينها…')}</option>
            {attr?.values.map((v) => <option key={v.id} value={v.id}>{ar ? v.valueAr ?? v.valueEn : v.valueEn}</option>)}
          </select>
          <button onClick={doAssign} disabled={pending || !assignValueId || selected.size === 0} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">{t('Assign to selected', 'عيّن للمحدد')}</button>
          {aiEnabled && (
            <>
              <button onClick={doSuggest} disabled={pending} className="h-9 rounded-md border border-primary px-3 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50">{t('✨ Suggest with AI', '✨ اقترح بالذكاء الاصطناعي')}</button>
              {picks.size > 0 && <button onClick={applyAi} disabled={pending} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">{t(`Apply ${picks.size} AI pick(s)`, `طبّق ${picks.size} اقتراحًا`)}</button>}
            </>
          )}
        </div>
      </div>

      {/* Product table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] border-collapse">
          <thead className="bg-surface">
            <tr>
              <th className={`${th} w-8`}><input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="select all" /></th>
              <th className={th}>{t('Product', 'المنتج')}</th>
              <th className={th}>{t('Brand', 'العلامة')}</th>
              <th className={th}>{t('Current value', 'القيمة الحالية')}</th>
              {picks.size > 0 && <th className={th}>{t('AI suggestion', 'اقتراح الذكاء')}</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={picks.size > 0 ? 5 : 4} className="p-6 text-center text-sm text-muted-foreground">{pending ? t('Loading…', 'جارٍ التحميل…') : t('No products match.', 'لا منتجات مطابقة.')}</td></tr>}
            {items.map((p) => {
              const pick = picks.get(p.id);
              return (
                <tr key={p.id} className={`border-t border-border ${selected.has(p.id) ? 'bg-primary/5' : ''}`}>
                  <td className={td}><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>
                  <td className={`${td} font-medium text-foreground`}>{nameOf(p)}<div className="text-[11px] text-muted-foreground">{p.sku}</div></td>
                  <td className={`${td} text-muted-foreground`}>{p.brand ?? '—'}</td>
                  <td className={td}>
                    {p.valueIds.length ? p.valueIds.map((id) => <span key={id} className="me-1 inline-block rounded bg-surface px-1.5 py-0.5 text-xs">{valueLabel(id)}</span>) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  {picks.size > 0 && <td className={td}>{pick ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">{pick.valueEn}</span> : <span className="text-xs text-muted-foreground">—</span>}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
