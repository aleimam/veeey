'use client';

import { useRef, useState } from 'react';
import { pick } from '@/lib/admin-i18n';
import { Select } from '@/components/storefront/ui/select';
import { Checkbox } from '@/components/storefront/ui/checkbox';
import type { PlpState } from '@/lib/plp-filters';

export type FacetOption = { id: string; name: string };
export type FacetAttribute = { id: string; name: string; values: FacetOption[] };

const inputCls =
  'block w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-slate-45 focus:border-lime focus:bg-white';

/**
 * Faceted filter rail (audit P1 5.5): category / searchable brand list /
 * price / rating / expiry window / dynamic attribute facets (form, dietary…)
 * + stock, offers and sort. Selects, radios and checkboxes apply instantly
 * (auto-submit); the price inputs use the button. GET form → shareable URLs.
 */
export function PlpFilters({
  locale,
  action,
  state,
  brands,
  categories,
  attributes,
  showKind = true,
  resultCount,
}: {
  locale: string;
  action: string;
  state: PlpState;
  brands: FacetOption[];
  categories: FacetOption[];
  attributes: FacetAttribute[];
  showKind?: boolean;
  resultCount: number;
}) {
  const t = pick(locale);
  const formRef = useRef<HTMLFormElement>(null);
  const [brandQuery, setBrandQuery] = useState('');

  const submit = () => formRef.current?.requestSubmit();
  // Instant apply for discrete controls; free-text/number inputs wait for the button.
  const onChange = (e: React.ChangeEvent<HTMLFormElement>) => {
    const el = e.target as unknown as HTMLInputElement;
    if (el.type === 'number' || el.dataset.noSubmit != null) return;
    submit();
  };

  const visibleBrands = brandQuery
    ? brands.filter((b) => b.name.toLowerCase().includes(brandQuery.toLowerCase()))
    : brands;

  const section = 'border-t border-[color:var(--slate-border)] pt-4 first:border-t-0 first:pt-0';
  const label = 'mb-2 block text-sm font-bold text-ink';

  return (
    <form ref={formRef} action={action} onChange={onChange} className="space-y-4">
      {state.q && <input type="hidden" name="q" value={state.q} />}

      <div className={section}>
        <Select name="sort" defaultValue={state.sort} label={t('Sort by', 'الترتيب حسب')}>
          <option value="popular">{t('Most popular', 'الأكثر شيوعًا')}</option>
          <option value="price_asc">{t('Price: low to high', 'السعر: من الأقل للأعلى')}</option>
          <option value="price_desc">{t('Price: high to low', 'السعر: من الأعلى للأقل')}</option>
          <option value="rating">{t('Highest rated', 'الأعلى تقييمًا')}</option>
          <option value="expiry">{t('Nearest expiry', 'الأقرب صلاحية')}</option>
        </Select>
      </div>

      {showKind && (
        <div className={section}>
          <Select name="kind" defaultValue={state.kind ?? ''} label={t('Type', 'النوع')}>
            <option value="">{t('All', 'الكل')}</option>
            <option value="SUPPLEMENT">{t('Supplements', 'المكمّلات')}</option>
            <option value="DEVICE">{t('Devices', 'الأجهزة')}</option>
          </Select>
        </div>
      )}

      {categories.length > 0 && (
        <div className={section}>
          <Select name="category" defaultValue={state.category ?? ''} label={t('Health goal / category', 'الهدف الصحي / الفئة')}>
            <option value="">{t('All categories', 'كل الفئات')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
      )}

      {brands.length > 0 && (
        <div className={section}>
          <span className={label}>{t('Brand', 'العلامة التجارية')}</span>
          <input
            type="text"
            data-no-submit
            value={brandQuery}
            onChange={(e) => setBrandQuery(e.target.value)}
            placeholder={t('Search brands…', 'ابحث في العلامات…')}
            className={`${inputCls} mb-2`}
            aria-label={t('Search brands', 'ابحث في العلامات')}
          />
          <div className="max-h-44 space-y-1.5 overflow-y-auto pe-1">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="brand" value="" defaultChecked={!state.brand} className="size-4 accent-[var(--green-dark)]" />
              {t('All brands', 'كل العلامات')}
            </label>
            {visibleBrands.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-sm text-ink">
                <input type="radio" name="brand" value={b.id} defaultChecked={state.brand === b.id} className="size-4 accent-[var(--green-dark)]" />
                <span className="truncate">{b.name}</span>
              </label>
            ))}
            {visibleBrands.length === 0 && <p className="text-xs text-[color:var(--text-subtle)]">{t('No brands match.', 'لا توجد علامات مطابقة.')}</p>}
          </div>
        </div>
      )}

      <div className={section}>
        <span className={label}>{t('Price (EGP)', 'السعر (ج.م)')}</span>
        <div className="flex items-center gap-2">
          <input type="number" name="pmin" min="0" defaultValue={state.pminEgp ?? ''} placeholder={t('Min', 'من')} className={inputCls} aria-label={t('Minimum price', 'أدنى سعر')} />
          <span className="text-[color:var(--text-subtle)]">–</span>
          <input type="number" name="pmax" min="0" defaultValue={state.pmaxEgp ?? ''} placeholder={t('Max', 'إلى')} className={inputCls} aria-label={t('Maximum price', 'أقصى سعر')} />
        </div>
      </div>

      <div className={section}>
        <Select name="rating" defaultValue={state.rating != null ? String(state.rating) : ''} label={t('Rating', 'التقييم')}>
          <option value="">{t('Any rating', 'أي تقييم')}</option>
          <option value="4">★ 4+</option>
          <option value="3">★ 3+</option>
        </Select>
      </div>

      <div className={section}>
        <Select name="exp" defaultValue={state.exp ?? ''} label={t('Expiry window', 'نافذة الصلاحية')}>
          <option value="">{t('Any expiry', 'أي صلاحية')}</option>
          <option value="lt3">{t('Under 3 months (deals)', 'أقل من 3 أشهر (عروض)')}</option>
          <option value="3to6">{t('3–6 months', '3–6 أشهر')}</option>
          <option value="gt6">{t('6+ months', 'أكثر من 6 أشهر')}</option>
        </Select>
      </div>

      {attributes.map((a) => (
        <div key={a.id} className={section}>
          <Select name={`av_${a.id}`} defaultValue={state.attrs[a.id] ?? ''} label={a.name}>
            <option value="">{t('All', 'الكل')}</option>
            {a.values.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </Select>
        </div>
      ))}

      <div className={`${section} flex flex-col gap-3`}>
        <Checkbox name="instock" value="1" defaultChecked={state.instock} label={t('In stock only', 'المتوفر فقط')} />
        <Checkbox name="offers" value="1" defaultChecked={state.offers} label={t('On offer', 'عليه عرض')} />
      </div>

      <button className="v-btn v-btn--primary v-btn--block">
        {t(`Show ${resultCount} results`, `عرض ${resultCount} نتيجة`)}
      </button>
    </form>
  );
}
