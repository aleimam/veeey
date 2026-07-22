'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { saveProductAction, type AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { ImageUploader } from './image-uploader';
import { RichTextField } from './rich-text/field';
import { CategoryPicker, type CategoryOpt } from './category-picker';
import { AttributePicker, type AttrOpt } from './attribute-picker';
import { quickCreateBrand, quickCreateTag } from '@/server/quick-actions';
import { TranslateButton } from './translate-button';
import { SeoEditor, type SeoDefaults, type SchemaInfo } from './seo-editor';
import { pick } from '@/lib/admin-i18n';
import { PRODUCT_TABS, type ProductTabId } from '@/lib/product-tabs';

type Opt = { value: string; label: string };

export type ProductDefaults = {
  id?: string;
  sku?: string;
  nameEn?: string;
  nameAr?: string;
  slugEn?: string;
  slugAr?: string;
  kind?: string;
  status?: string;
  preorderEnabled?: boolean;
  maleSupport?: boolean;
  purchaseUrl?: string;
  originCountry?: string | null;
  purchaseCost?: number;
  purchaseCurrency?: string | null;
  brandId?: string | null;
  productType?: string | null;
  basePriceEgp?: number;
  weightG?: number | null;
  reorderPoint?: number | null;
  servingsPerUnit?: number | null;
  dailyDosage?: number | null;
  dailyDosageMax?: number | null;
  shortDescEn?: string;
  shortDescAr?: string;
  longDescEn?: string;
  longDescAr?: string;
  seo?: SeoDefaults;
  categoryIds?: string[];
  tagIds?: string[];
  attributeValueIds?: string[];
  imageUrls?: string[];
  restricted?: boolean;
  restrictHideCatalog?: boolean;
  restrictHideFeeds?: boolean;
  restrictDisableCards?: boolean;
  restrictRequireLogin?: boolean;
  restrictAgeConsent?: boolean;
};

const RESTRICTIONS: { name: keyof ProductDefaults; en: string; ar: string }[] = [
  { name: 'restricted', en: 'Mark as a restricted product', ar: 'تمييز كمنتج مقيّد' },
  { name: 'restrictHideCatalog', en: 'Hide from the public catalog', ar: 'إخفاء من الكتالوج العام' },
  { name: 'restrictHideFeeds', en: 'Hide from Google/Meta feeds', ar: 'إخفاء من خلاصات Google/Meta' },
  { name: 'restrictDisableCards', en: 'Disable card payment', ar: 'تعطيل الدفع بالبطاقة' },
  { name: 'restrictRequireLogin', en: 'Require sign-in', ar: 'يتطلب تسجيل الدخول' },
  { name: 'restrictAgeConsent', en: 'Require age/consent confirmation', ar: 'يتطلب تأكيد السن/الموافقة' },
];

/**
 * Tabbed product form (owner-approved 7-tab layout, 2026-07-22). ONE <form>
 * spans all tabs: every panel stays MOUNTED and is toggled with the `hidden`
 * attribute, so all fields keep submitting together (and the SeoEditor's DOM
 * polling / TranslateButton's form.elements reads keep working across tabs).
 * The active tab persists in the URL as `?tab=…` (router.replace, no scroll).
 * Server-rendered extras (read-only lots table, Always-Needed block, variant
 * group / collection links) arrive as ReactNode props from the page.
 */
export function ProductForm({
  locale,
  defaults = {},
  brands,
  categories,
  tags,
  attributes,
  schemaInfo,
  initialTab = 'details',
  organizationExtra,
  sellingExtra,
  stockPanel,
}: {
  locale: string;
  defaults?: ProductDefaults;
  brands: Opt[];
  categories: CategoryOpt[];
  tags: Opt[];
  attributes: AttrOpt[];
  schemaInfo?: SchemaInfo;
  initialTab?: ProductTabId;
  organizationExtra?: React.ReactNode;
  sellingExtra?: React.ReactNode;
  stockPanel?: React.ReactNode;
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(saveProductAction, {});
  const tb = pick(useLocale());
  const router = useRouter();
  const pathname = usePathname();
  const d = defaults;
  const [kind, setKind] = useState<string>(d.kind ?? 'SUPPLEMENT');
  const [brandOpts, setBrandOpts] = useState<Opt[]>(brands);
  const [brandId, setBrandId] = useState<string>(d.brandId ?? '');
  const [brandQuery, setBrandQuery] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [tagOpts, setTagOpts] = useState<Opt[]>(tags);
  const [newTag, setNewTag] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(d.tagIds ?? []));
  const [tagQuery, setTagQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState<string>(d.originCountry ?? '');
  const [active, setActive] = useState<ProductTabId>(initialTab);
  const [errorTabs, setErrorTabs] = useState<ReadonlySet<ProductTabId>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);
  const checkQueued = useRef(false);
  const currencyOf = (o: string) => (o === 'USA' ? 'USD ($)' : o === 'UK' ? 'GBP (£)' : o === 'EU' ? 'EUR (€)' : '');
  const toggleTag = (id: string) => setSelectedTags((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const selectTab = useCallback(
    (id: ProductTabId, focus = false) => {
      setActive(id);
      // Persist the active tab in the URL so reload/share keeps it; no scroll jump.
      router.replace(id === 'details' ? pathname : `${pathname}?tab=${id}`, { scroll: false });
      if (focus) requestAnimationFrame(() => document.getElementById(`ptab-${id}`)?.focus());
    },
    [router, pathname],
  );

  // Error badges: native constraint validation blocks the submit SILENTLY when
  // the invalid control sits on a hidden panel (the browser can't focus it), so
  // listen for `invalid` (capture — it doesn't bubble), badge every tab whose
  // panel contains an invalid control, and jump to the first offending tab.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onInvalid = () => {
      if (checkQueued.current) return; // one check per submit attempt (invalid fires per control)
      checkQueued.current = true;
      requestAnimationFrame(() => {
        checkQueued.current = false;
        const bad = new Set<ProductTabId>();
        for (const t of PRODUCT_TABS) {
          if (document.getElementById(`ptab-panel-${t.id}`)?.querySelector(':invalid, [aria-invalid="true"]')) bad.add(t.id);
        }
        setErrorTabs(bad);
        const first = PRODUCT_TABS.find((t) => bad.has(t.id));
        if (first && !bad.has(active)) selectTab(first.id, true);
      });
    };
    form.addEventListener('invalid', onInvalid, true);
    return () => form.removeEventListener('invalid', onInvalid, true);
  }, [active, selectTab]);

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const last = PRODUCT_TABS.length - 1;
    const idx = PRODUCT_TABS.findIndex((t) => t.id === active);
    let next = idx;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else {
      // Arrows follow the reading direction (RTL flips them).
      const forward = (e.key === 'ArrowRight') !== (locale === 'ar');
      next = forward ? (idx === last ? 0 : idx + 1) : (idx === 0 ? last : idx - 1);
    }
    selectTab(PRODUCT_TABS[next].id, true);
  };

  async function addBrand() {
    if (!newBrand.trim()) return;
    setBusy(true);
    try {
      const b = await quickCreateBrand(newBrand.trim());
      setBrandOpts((o) => [...o, { value: b.id, label: b.label }]);
      setBrandId(b.id);
      setNewBrand('');
    } finally { setBusy(false); }
  }
  async function addTag() {
    if (!newTag.trim()) return;
    setBusy(true);
    try {
      const t = await quickCreateTag(newTag.trim());
      setTagOpts((o) => [...o, { value: t.id, label: t.label }]);
      setSelectedTags((s) => new Set(s).add(t.id));
      setNewTag('');
    } finally { setBusy(false); }
  }

  const panelCls = 'space-y-6 pt-5';

  return (
    <form
      ref={formRef}
      action={action}
      // V7 audit C19: a 0-EGP save is almost always a mistake (a missed price,
      // not a free product) — ask before storing it. The list's `Price = 0`
      // filter still surfaces any that get through.
      onSubmit={(e) => {
        const price = Number((e.currentTarget.elements.namedItem('basePriceEgp') as HTMLInputElement | null)?.value || 0);
        if (price === 0 && !confirm(tb(
          'Base price is 0 EGP — the product would show as free. Save anyway?',
          'السعر الأساسي 0 ج.م — سيظهر المنتج مجانيًا. الحفظ رغم ذلك؟',
        ))) { e.preventDefault(); return; }
        setErrorTabs(new Set()); // native validation passed — clear the badges
      }}
      className="max-w-3xl space-y-6"
    >
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {d.id && <input type="hidden" name="id" value={d.id} />}

      <div role="tablist" aria-label={tb('Product sections', 'أقسام المنتج')} onKeyDown={onTabKeyDown} className="flex flex-wrap gap-1 border-b border-border">
        {PRODUCT_TABS.map((t) => {
          const selected = active === t.id;
          const hasError = errorTabs.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`ptab-${t.id}`}
              aria-selected={selected}
              aria-controls={`ptab-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(t.id)}
              className={`-mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium ${selected ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:bg-surface hover:text-foreground'}`}
            >
              {tb(t.en, t.ar)}
              {hasError && <span aria-hidden className="size-2 rounded-full bg-destructive" />}
              {hasError && <span className="sr-only">{tb('— has invalid fields', '— يحتوي حقولًا غير صالحة')}</span>}
            </button>
          );
        })}
      </div>

      {/* Panels stay MOUNTED (hidden attr, never unmounted) so every field on
          every tab submits with this single form. */}

      {/* ---- 1 · Details — core commercial fields (EN) ---------------------- */}
      <div role="tabpanel" id="ptab-panel-details" aria-labelledby="ptab-details" hidden={active !== 'details'} className={panelCls}>
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label={tb('Name (English)', 'الاسم (بالإنجليزية)')} required><input name="nameEn" required defaultValue={d.nameEn ?? ''} className={inputCls} /></Field>
          <Field label={tb('SKU', 'رمز المنتج (SKU)')} hint={tb('Leave empty to auto-generate (VEY-…).', 'اتركه فارغًا للتوليد التلقائي (VEY-…).')}><input name="sku" defaultValue={d.sku ?? ''} className={inputCls} /></Field>
          <Field label={tb('Brand', 'العلامة التجارية')} hint={tb('Search and pick one brand.', 'ابحث واختر علامة واحدة.')}>
            <input
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
              placeholder={tb('Search brands…', 'ابحث في العلامات…')}
              className={inputCls}
            />
            <div className="mt-1 max-h-40 overflow-auto rounded-md border border-border">
              <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-surface">
                <input type="radio" name="brandPick" checked={brandId === ''} onChange={() => setBrandId('')} className="size-4" />
                {tb('— None —', '— بدون —')}
              </label>
              {brandOpts
                .filter((b) => b.label.toLowerCase().includes(brandQuery.trim().toLowerCase()))
                .map((b) => (
                  <label key={b.value} className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-surface">
                    <input type="radio" name="brandPick" checked={brandId === b.value} onChange={() => setBrandId(b.value)} className="size-4" />
                    {b.label}
                  </label>
                ))}
              {brandOpts.filter((b) => b.label.toLowerCase().includes(brandQuery.trim().toLowerCase())).length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">{tb('No brands match.', 'لا توجد علامات مطابقة.')}</p>
              )}
            </div>
            {/* Selected brand submits regardless of the current filter. */}
            <input type="hidden" name="brandId" value={brandId} />
            {brandId && <p className="mt-1 text-xs text-muted-foreground">{tb('Selected: ', 'المحدد: ')}{brandOpts.find((b) => b.value === brandId)?.label ?? ''}</p>}
            <div className="mt-1 flex items-center gap-2 text-xs">
              <input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder={tb('New brand', 'علامة جديدة')} className={`${inputCls} py-1`} />
              <button type="button" onClick={addBrand} disabled={busy || !newBrand.trim()} className="whitespace-nowrap text-primary hover:underline disabled:opacity-50">{tb('+ Add', '+ إضافة')}</button>
            </div>
          </Field>
          <Field label={tb('Slug (English)', 'المُعرّف (بالإنجليزية)')} hint={tb('Leave empty to auto-generate.', 'اتركه فارغًا للتوليد التلقائي.')}><input name="slugEn" defaultValue={d.slugEn ?? ''} className={inputCls} /></Field>
          <Field label={tb('Type', 'النوع')}>
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
              <option value="SUPPLEMENT">{tb('Supplement', 'مكمل غذائي')}</option>
              <option value="DEVICE">{tb('Device', 'جهاز')}</option>
              <option value="INJECTION">{tb('Injection', 'حقن')}</option>
            </select>
          </Field>
          <Field label={tb('Status', 'الحالة')}>
            <select name="status" defaultValue={d.status ?? 'PUBLISHED'} className={inputCls}>
              <option value="PUBLISHED">{tb('Published', 'منشور')}</option>
              <option value="PRIVATE">{tb('Private (staff only)', 'خاص (للموظفين فقط)')}</option>
              <option value="DRAFT">{tb('Draft', 'مسودة')}</option>
              <option value="ARCHIVED">{tb('Archived', 'مؤرشف')}</option>
            </select>
          </Field>
          <Field label={tb('Base price (EGP)', 'السعر الأساسي (ج.م)')}><input name="basePriceEgp" type="number" step="0.01" min="0" defaultValue={d.basePriceEgp ?? 0} className={inputCls} /></Field>
          <Field label={tb('Weight (g)', 'الوزن (جم)')}><input name="weightG" type="number" min="0" defaultValue={d.weightG ?? ''} className={inputCls} /></Field>
          {kind !== 'DEVICE' && (
            <>
              <Field label={tb('Servings per unit', 'عدد الجرعات في العبوة')} hint={tb('Used in the supply-duration calculator.', 'يُستخدم في حاسبة مدة الاستخدام.')}><input name="servingsPerUnit" type="number" min="0" defaultValue={d.servingsPerUnit ?? ''} className={inputCls} /></Field>
              <Field label={tb('Daily dosage — min', 'الجرعة اليومية — الحد الأدنى')} hint={tb('Min servings per day (also the calculator default).', 'أقل عدد جرعات يوميًا (وافتراضي الحاسبة).')}><input name="dailyDosage" type="number" min="0" defaultValue={d.dailyDosage ?? ''} className={inputCls} /></Field>
              <Field label={tb('Daily dosage — max', 'الجرعة اليومية — الحد الأقصى')} hint={tb('Optional upper bound of the dose range.', 'الحد الأعلى الاختياري لنطاق الجرعة.')}><input name="dailyDosageMax" type="number" min="0" defaultValue={d.dailyDosageMax ?? ''} className={inputCls} /></Field>
            </>
          )}
        </section>

        <section className="grid gap-4">
          <Field label={tb('Short description (English)', 'وصف مختصر (بالإنجليزية)')}><RichTextField name="shortDescEn" initial={d.shortDescEn ?? ''} compact /></Field>
          <Field label={tb('Detailed description (English)', 'وصف تفصيلي (بالإنجليزية)')}><RichTextField name="longDescEn" initial={d.longDescEn ?? ''} /></Field>
        </section>
      </div>

      {/* ---- 2 · Arabic — all AR translation fields + AI translate ---------- */}
      <div role="tabpanel" id="ptab-panel-arabic" aria-labelledby="ptab-arabic" hidden={active !== 'arabic'} className={panelCls}>
        <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
          <span className="text-xs text-muted-foreground">{tb('Fill English, then auto-translate the Arabic fields.', 'املأ الإنجليزية ثم ترجم الحقول العربية تلقائيًا.')}</span>
          <TranslateButton pairs={[
            { en: 'nameEn', ar: 'nameAr' },
            { en: 'shortDescEn', ar: 'shortDescAr' },
            { en: 'longDescEn', ar: 'longDescAr' },
            { en: 'metaTitleEn', ar: 'metaTitleAr' },
            { en: 'metaDescEn', ar: 'metaDescAr' },
            { en: 'ogTitleEn', ar: 'ogTitleAr' },
            { en: 'ogDescEn', ar: 'ogDescAr' },
            { en: 'aiSummaryEn', ar: 'aiSummaryAr' },
          ]} />
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          <Field label={tb('Name (Arabic)', 'الاسم (بالعربية)')}><input name="nameAr" defaultValue={d.nameAr ?? ''} dir="rtl" className={inputCls} /></Field>
          <Field label={tb('Slug (Arabic)', 'المُعرّف (بالعربية)')} hint={tb('Leave empty to auto-generate.', 'اتركه فارغًا للتوليد التلقائي.')}><input name="slugAr" defaultValue={d.slugAr ?? ''} className={inputCls} /></Field>
        </section>
        <section className="grid gap-4">
          <Field label={tb('Short description (Arabic)', 'وصف مختصر (بالعربية)')}><RichTextField name="shortDescAr" initial={d.shortDescAr ?? ''} compact /></Field>
          <Field label={tb('Detailed description (Arabic)', 'وصف تفصيلي (بالعربية)')}><RichTextField name="longDescAr" initial={d.longDescAr ?? ''} /></Field>
        </section>
        <p className="text-xs text-muted-foreground">{tb('Arabic SEO fields (meta title, description, keywords, OG) live on the SEO tab.', 'حقول SEO العربية (عنوان الميتا، الوصف، الكلمات، OG) موجودة في تبويب SEO.')}</p>
      </div>

      {/* ---- 3 · Media — gallery / uploader --------------------------------- */}
      <div role="tabpanel" id="ptab-panel-media" aria-labelledby="ptab-media" hidden={active !== 'media'} className={panelCls}>
        <section>
          <p className="mb-2 text-sm font-medium">{tb('Images', 'الصور')}</p>
          <ImageUploader initial={d.imageUrls ?? []} context="product" />
          <p className="mt-2 text-xs text-muted-foreground">{tb('The first image is the primary (cover) image — it fronts the catalog card and defaults the OG share image.', 'الصورة الأولى هي الصورة الرئيسية (الغلاف) — تظهر في بطاقة الكتالوج وتُستخدم افتراضيًا لصورة المشاركة OG.')}</p>
        </section>
      </div>

      {/* ---- 4 · Organization — taxonomy ------------------------------------ */}
      <div role="tabpanel" id="ptab-panel-organization" aria-labelledby="ptab-organization" hidden={active !== 'organization'} className={panelCls}>
        <section className="grid gap-4 sm:grid-cols-3">
          <Field label={tb('Categories', 'الفئات')} hint={tb('Pick up to 4 (sub)categories.', 'اختر حتى 4 فئات أو فئات فرعية.')}>
            <CategoryPicker categories={categories} initial={d.categoryIds ?? []} max={4} />
          </Field>
          <Field label={tb('Tags', 'الوسوم')} hint={tb('Search and tick tags.', 'ابحث وحدد الوسوم.')}>
            <input
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder={tb('Search tags…', 'ابحث في الوسوم…')}
              className={inputCls}
            />
            <div className="mt-1 max-h-40 overflow-auto rounded-md border border-border">
              {tagOpts
                .filter((t) => t.label.toLowerCase().includes(tagQuery.trim().toLowerCase()))
                .map((t) => (
                  <label key={t.value} className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-surface">
                    <input type="checkbox" checked={selectedTags.has(t.value)} onChange={() => toggleTag(t.value)} className="size-4" />
                    {t.label}
                  </label>
                ))}
              {tagOpts.filter((t) => t.label.toLowerCase().includes(tagQuery.trim().toLowerCase())).length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">{tb('No tags match.', 'لا توجد وسوم مطابقة.')}</p>
              )}
            </div>
            {/* Selected tags submit regardless of the current filter. */}
            {[...selectedTags].map((id) => <input key={id} type="hidden" name="tagIds" value={id} />)}
            <p className="mt-1 text-xs text-muted-foreground">{tb(`${selectedTags.size} selected`, `${selectedTags.size} محدد`)}</p>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder={tb('New tag', 'وسم جديد')} className={`${inputCls} py-1`} />
              <button type="button" onClick={addTag} disabled={busy || !newTag.trim()} className="whitespace-nowrap text-primary hover:underline disabled:opacity-50">{tb('+ Add', '+ إضافة')}</button>
            </div>
          </Field>
          <Field label={tb('Attributes', 'الخصائص')} hint={tb('Pick attribute, then value.', 'اختر الخاصية ثم القيمة.')}>
            <AttributePicker attributes={attributes} initial={d.attributeValueIds ?? []} kind={kind} />
          </Field>
        </section>

        <Field label={tb('Male support', 'دعم الرجال')} hint={tb('Flag this product for men’s health.', 'تمييز المنتج لصحة الرجال.')}>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="maleSupport" defaultChecked={d.maleSupport} className="size-4" />
            {tb('Is male support', 'منتج لدعم الرجال')}
          </label>
        </Field>

        {organizationExtra}
      </div>

      {/* ---- 5 · Selling — how it sells (and gets bought) ------------------- */}
      <div role="tabpanel" id="ptab-panel-selling" aria-labelledby="ptab-selling" hidden={active !== 'selling'} className={panelCls}>
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label={tb('Pre-order', 'الطلب المسبق')} hint={tb('Show in the storefront even when out of stock.', 'إظهاره في المتجر حتى عند نفاد المخزون.')}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="preorderEnabled" defaultChecked={d.preorderEnabled} className="size-4" />
              {tb('Allow pre-order', 'السماح بالطلب المسبق')}
            </label>
          </Field>
          {kind !== 'DEVICE' && (
            <Field label={tb('Reorder point', 'حد إعادة الطلب')} hint={tb('Sellable stock at/below this shows on the To-buy list. Empty = automatic.', 'المخزون القابل للبيع عند هذا الحد أو أقل يظهر في قائمة الشراء. فارغ = تلقائي.')}><input name="reorderPoint" type="number" min="0" defaultValue={d.reorderPoint ?? ''} className={inputCls} /></Field>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface/40 p-4">
          <div className="mb-3 text-xs font-semibold uppercase text-muted-foreground">{tb('Sourcing (internal)', 'المصدر (داخلي)')}</div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={tb('Origin country', 'بلد المنشأ')} hint={tb('Import origin — shown to customers as a trust badge.', 'مصدر الاستيراد — يظهر للعملاء كشارة ثقة.')}>
              <select name="originCountry" value={origin} onChange={(e) => setOrigin(e.target.value)} className={inputCls}>
                <option value="">{tb('— None —', '— بدون —')}</option>
                <option value="USA">{tb('USA', 'الولايات المتحدة')}</option>
                <option value="UK">{tb('UK', 'بريطانيا')}</option>
                <option value="EU">{tb('EU', 'الاتحاد الأوروبي')}</option>
              </select>
            </Field>
            <Field label={tb('Purchase price', 'سعر الشراء')} hint={origin ? tb(`In ${currencyOf(origin)} (set by origin).`, `بعملة ${currencyOf(origin)} (حسب المنشأ).`) : tb('Pick an origin country to set the currency.', 'اختر بلد المنشأ لتحديد العملة.')}>
              <input name="purchaseCost" type="number" step="0.01" min="0" defaultValue={d.purchaseCost ?? ''} disabled={!origin} className={inputCls} />
            </Field>
            <Field label={tb('Purchase URL', 'رابط الشراء')} hint={tb('Supplier / source link (internal only).', 'رابط المورّد/المصدر (داخلي فقط).')}>
              <input name="purchaseUrl" type="url" defaultValue={d.purchaseUrl ?? ''} placeholder="https://…" className={inputCls} />
            </Field>
          </div>
        </section>

        <fieldset className="rounded-md border border-border p-4">
          <legend className="px-1 text-sm font-medium">{tb('Restriction settings (disabled by default)', 'إعدادات التقييد (معطّلة افتراضيًا)')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {RESTRICTIONS.map((r) => (
              <label key={r.name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={r.name} defaultChecked={!!d[r.name]} className="size-4" />
                {tb(r.en, r.ar)}
              </label>
            ))}
          </div>
        </fieldset>

        {sellingExtra}
      </div>

      {/* ---- 6 · Stock — read-only lots (server-rendered) ------------------- */}
      <div role="tabpanel" id="ptab-panel-stock" aria-labelledby="ptab-stock" hidden={active !== 'stock'} className={panelCls}>
        {stockPanel ?? (
          <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
            {tb('Save the product first — stock lots can be added once it exists.', 'احفظ المنتج أولًا — يمكن إضافة دفعات المخزون بعد إنشائه.')}
          </p>
        )}
      </div>

      {/* ---- 7 · SEO — RankMath-style editor (EN + AR) ---------------------- */}
      <div role="tabpanel" id="ptab-panel-seo" aria-labelledby="ptab-seo" hidden={active !== 'seo'} className={panelCls}>
        <SeoEditor
          d={d.seo}
          schemaInfo={schemaInfo ?? { name: d.nameEn ?? '', brand: '', priceEgp: d.basePriceEgp ?? 0, inStock: false, ratingAvg: null, ratingCount: 0, image: d.imageUrls?.[0] ?? '' }}
        />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>{tb('Save product', 'حفظ المنتج')}</SubmitButton>
        <Link href="/admin/products" className="text-sm text-muted-foreground hover:underline">{tb('Cancel', 'إلغاء')}</Link>
      </div>
    </form>
  );
}
