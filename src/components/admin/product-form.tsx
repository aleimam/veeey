'use client';

import { useActionState, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { saveProductAction, type AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { ImageUploader } from './image-uploader';
import { CategoryPicker, type CategoryOpt } from './category-picker';
import { AttributePicker, type AttrOpt } from './attribute-picker';
import { quickCreateBrand, quickCreateTag } from '@/server/quick-actions';
import { TranslateButton } from './translate-button';
import { pick } from '@/lib/admin-i18n';

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
  brandId?: string | null;
  productType?: string | null;
  basePriceEgp?: number;
  weightG?: number | null;
  servingsPerUnit?: number | null;
  dailyDosage?: number | null;
  dailyDosageMax?: number | null;
  shortDescEn?: string;
  shortDescAr?: string;
  longDescEn?: string;
  longDescAr?: string;
  metaTitleEn?: string;
  metaDescEn?: string;
  aiSummaryEn?: string;
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

export function ProductForm({
  locale,
  defaults = {},
  brands,
  categories,
  tags,
  attributes,
}: {
  locale: string;
  defaults?: ProductDefaults;
  brands: Opt[];
  categories: CategoryOpt[];
  tags: Opt[];
  attributes: AttrOpt[];
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(saveProductAction, {});
  const tb = pick(useLocale());
  const d = defaults;
  const [kind, setKind] = useState<string>(d.kind ?? 'SUPPLEMENT');
  const [brandOpts, setBrandOpts] = useState<Opt[]>(brands);
  const [brandId, setBrandId] = useState<string>(d.brandId ?? '');
  const [newBrand, setNewBrand] = useState('');
  const [tagOpts, setTagOpts] = useState<Opt[]>(tags);
  const [newTag, setNewTag] = useState('');
  const [busy, setBusy] = useState(false);

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
      setNewTag('');
    } finally { setBusy(false); }
  }

  return (
    <form action={action} className="max-w-3xl space-y-6">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {d.id && <input type="hidden" name="id" value={d.id} />}

      <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
        <span className="text-xs text-muted-foreground">{tb('Fill English, then auto-translate the Arabic fields.', 'املأ الإنجليزية ثم ترجم الحقول العربية تلقائيًا.')}</span>
        <TranslateButton pairs={[
          { en: 'nameEn', ar: 'nameAr' },
          { en: 'shortDescEn', ar: 'shortDescAr' },
          { en: 'longDescEn', ar: 'longDescAr' },
          { en: 'metaTitleEn', ar: 'metaTitleAr' },
          { en: 'metaDescEn', ar: 'metaDescAr' },
        ]} />
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={tb('Name (English)', 'الاسم (بالإنجليزية)')}><input name="nameEn" required defaultValue={d.nameEn ?? ''} className={inputCls} /></Field>
        <Field label={tb('Name (Arabic)', 'الاسم (بالعربية)')}><input name="nameAr" defaultValue={d.nameAr ?? ''} dir="rtl" className={inputCls} /></Field>
        <Field label={tb('SKU', 'رمز المنتج (SKU)')} hint={tb('Leave empty to auto-generate (VEY-…).', 'اتركه فارغًا للتوليد التلقائي (VEY-…).')}><input name="sku" defaultValue={d.sku ?? ''} className={inputCls} /></Field>
        <Field label={tb('Brand', 'العلامة التجارية')}>
          <select name="brandId" value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputCls}>
            <option value="">{tb('— None —', '— بدون —')}</option>
            {brandOpts.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder={tb('New brand', 'علامة جديدة')} className={`${inputCls} py-1`} />
            <button type="button" onClick={addBrand} disabled={busy || !newBrand.trim()} className="whitespace-nowrap text-primary hover:underline disabled:opacity-50">{tb('+ Add', '+ إضافة')}</button>
          </div>
        </Field>
        <Field label={tb('Slug (English)', 'المُعرّف (بالإنجليزية)')} hint={tb('Leave empty to auto-generate.', 'اتركه فارغًا للتوليد التلقائي.')}><input name="slugEn" defaultValue={d.slugEn ?? ''} className={inputCls} /></Field>
        <Field label={tb('Slug (Arabic)', 'المُعرّف (بالعربية)')} hint={tb('Leave empty to auto-generate.', 'اتركه فارغًا للتوليد التلقائي.')}><input name="slugAr" defaultValue={d.slugAr ?? ''} className={inputCls} /></Field>
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

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={tb('Short description (English)', 'وصف مختصر (بالإنجليزية)')}><textarea name="shortDescEn" rows={2} defaultValue={d.shortDescEn ?? ''} className={inputCls} /></Field>
        <Field label={tb('Short description (Arabic)', 'وصف مختصر (بالعربية)')}><textarea name="shortDescAr" rows={2} dir="rtl" defaultValue={d.shortDescAr ?? ''} className={inputCls} /></Field>
        <Field label={tb('Detailed description (English)', 'وصف تفصيلي (بالإنجليزية)')}><textarea name="longDescEn" rows={4} defaultValue={d.longDescEn ?? ''} className={inputCls} /></Field>
        <Field label={tb('Detailed description (Arabic)', 'وصف تفصيلي (بالعربية)')}><textarea name="longDescAr" rows={4} dir="rtl" defaultValue={d.longDescAr ?? ''} className={inputCls} /></Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Field label={tb('Categories', 'الفئات')} hint={tb('Pick up to 4 (sub)categories.', 'اختر حتى 4 فئات أو فئات فرعية.')}>
          <CategoryPicker categories={categories} initial={d.categoryIds ?? []} max={4} />
        </Field>
        <Field label={tb('Tags', 'الوسوم')} hint={tb('Use Ctrl/Cmd for multi-select.', 'استخدم Ctrl/Cmd للتحديد المتعدد.')}>
          <select name="tagIds" multiple defaultValue={d.tagIds ?? []} className={`${inputCls} h-24`}>
            {tagOpts.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder={tb('New tag', 'وسم جديد')} className={`${inputCls} py-1`} />
            <button type="button" onClick={addTag} disabled={busy || !newTag.trim()} className="whitespace-nowrap text-primary hover:underline disabled:opacity-50">{tb('+ Add', '+ إضافة')}</button>
          </div>
        </Field>
        <Field label={tb('Attributes', 'الخصائص')} hint={tb('Pick attribute, then value.', 'اختر الخاصية ثم القيمة.')}>
          <AttributePicker attributes={attributes} initial={d.attributeValueIds ?? []} kind={kind} />
        </Field>
      </section>

      <section>
        <p className="mb-2 text-sm font-medium">{tb('Images', 'الصور')}</p>
        <ImageUploader initial={d.imageUrls ?? []} />
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

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={tb('SEO title (English)', 'عنوان SEO (بالإنجليزية)')}><input name="metaTitleEn" defaultValue={d.metaTitleEn ?? ''} className={inputCls} /></Field>
        <Field label={tb('SEO description (English)', 'وصف SEO (بالإنجليزية)')}><input name="metaDescEn" defaultValue={d.metaDescEn ?? ''} className={inputCls} /></Field>
        <Field label={tb('AI summary (English)', 'ملخص الذكاء الاصطناعي (بالإنجليزية)')} hint={tb('For AEO / AI engines.', 'لمحركات AEO / الذكاء الاصطناعي.')}><textarea name="aiSummaryEn" rows={2} defaultValue={d.aiSummaryEn ?? ''} className={inputCls} /></Field>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton>{tb('Save product', 'حفظ المنتج')}</SubmitButton>
        <Link href="/admin/products" className="text-sm text-muted-foreground hover:underline">{tb('Cancel', 'إلغاء')}</Link>
      </div>
    </form>
  );
}
