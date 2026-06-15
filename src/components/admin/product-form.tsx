'use client';

import { useActionState } from 'react';
import { Link } from '@/i18n/navigation';
import { saveProductAction, type AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { ImageUploader } from './image-uploader';

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

const RESTRICTIONS: { name: keyof ProductDefaults; label: string }[] = [
  { name: 'restricted', label: 'تمييز كمنتج مقيّد' },
  { name: 'restrictHideCatalog', label: 'إخفاء من الكتالوج العام' },
  { name: 'restrictHideFeeds', label: 'إخفاء من خلاصات Google/Meta' },
  { name: 'restrictDisableCards', label: 'تعطيل الدفع بالبطاقة' },
  { name: 'restrictRequireLogin', label: 'يتطلب تسجيل الدخول' },
  { name: 'restrictAgeConsent', label: 'يتطلب تأكيد السن/الموافقة' },
];

export function ProductForm({
  locale,
  defaults = {},
  brands,
  categories,
  tags,
  attributeValues,
}: {
  locale: string;
  defaults?: ProductDefaults;
  brands: Opt[];
  categories: Opt[];
  tags: Opt[];
  attributeValues: Opt[];
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(saveProductAction, {});
  const d = defaults;

  return (
    <form action={action} className="max-w-3xl space-y-6">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {d.id && <input type="hidden" name="id" value={d.id} />}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم (بالإنجليزية)"><input name="nameEn" required defaultValue={d.nameEn ?? ''} className={inputCls} /></Field>
        <Field label="الاسم (بالعربية)"><input name="nameAr" defaultValue={d.nameAr ?? ''} dir="rtl" className={inputCls} /></Field>
        <Field label="رمز المنتج (SKU)" hint="اتركه فارغًا للتوليد التلقائي (VEY-…)."><input name="sku" defaultValue={d.sku ?? ''} className={inputCls} /></Field>
        <Field label="العلامة التجارية">
          <select name="brandId" defaultValue={d.brandId ?? ''} className={inputCls}>
            <option value="">— بدون —</option>
            {brands.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="المُعرّف (بالإنجليزية)" hint="اتركه فارغًا للتوليد التلقائي."><input name="slugEn" defaultValue={d.slugEn ?? ''} className={inputCls} /></Field>
        <Field label="المُعرّف (بالعربية)" hint="اتركه فارغًا للتوليد التلقائي."><input name="slugAr" defaultValue={d.slugAr ?? ''} className={inputCls} /></Field>
        <Field label="النوع">
          <select name="kind" defaultValue={d.kind ?? 'SUPPLEMENT'} className={inputCls}>
            <option value="SUPPLEMENT">مكمل غذائي</option>
            <option value="DEVICE">جهاز</option>
            <option value="OTHER">أخرى</option>
          </select>
        </Field>
        <Field label="الحالة">
          <select name="status" defaultValue={d.status ?? 'DRAFT'} className={inputCls}>
            <option value="DRAFT">مسودة</option>
            <option value="PUBLISHED">منشور</option>
            <option value="ARCHIVED">مؤرشف</option>
          </select>
        </Field>
        <Field label="السعر الأساسي (ج.م)"><input name="basePriceEgp" type="number" step="0.01" min="0" defaultValue={d.basePriceEgp ?? 0} className={inputCls} /></Field>
        <Field label="نوع العرض التسويقي">
          <select name="productType" defaultValue={d.productType ?? ''} className={inputCls}>
            <option value="">— بدون —</option>
            {['MISCELLANEOUS', 'MALE_SUPPORT', 'PREMIUM', 'NEW', 'TREND'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="الوزن (جم)"><input name="weightG" type="number" min="0" defaultValue={d.weightG ?? ''} className={inputCls} /></Field>
        <Field label="عدد الجرعات في العبوة" hint="يُستخدم في حاسبة مدة الاستخدام."><input name="servingsPerUnit" type="number" min="0" defaultValue={d.servingsPerUnit ?? ''} className={inputCls} /></Field>
        <Field label="الجرعة اليومية" hint="عدد الجرعات المستهلكة يوميًا."><input name="dailyDosage" type="number" min="0" defaultValue={d.dailyDosage ?? ''} className={inputCls} /></Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="وصف مختصر (بالإنجليزية)"><textarea name="shortDescEn" rows={2} defaultValue={d.shortDescEn ?? ''} className={inputCls} /></Field>
        <Field label="وصف مختصر (بالعربية)"><textarea name="shortDescAr" rows={2} dir="rtl" defaultValue={d.shortDescAr ?? ''} className={inputCls} /></Field>
        <Field label="وصف تفصيلي (بالإنجليزية)"><textarea name="longDescEn" rows={4} defaultValue={d.longDescEn ?? ''} className={inputCls} /></Field>
        <Field label="وصف تفصيلي (بالعربية)"><textarea name="longDescAr" rows={4} dir="rtl" defaultValue={d.longDescAr ?? ''} className={inputCls} /></Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="الفئات" hint="استخدم Ctrl/Cmd للتحديد المتعدد.">
          <select name="categoryIds" multiple defaultValue={d.categoryIds ?? []} className={`${inputCls} h-32`}>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="الوسوم" hint="استخدم Ctrl/Cmd للتحديد المتعدد.">
          <select name="tagIds" multiple defaultValue={d.tagIds ?? []} className={`${inputCls} h-32`}>
            {tags.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="الخصائص" hint="استخدم Ctrl/Cmd للتحديد المتعدد.">
          <select name="attributeValueIds" multiple defaultValue={d.attributeValueIds ?? []} className={`${inputCls} h-32`}>
            {attributeValues.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </Field>
      </section>

      <section>
        <p className="mb-2 text-sm font-medium">الصور</p>
        <ImageUploader initial={d.imageUrls ?? []} />
      </section>

      <fieldset className="rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">إعدادات التقييد (معطّلة افتراضيًا)</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {RESTRICTIONS.map((r) => (
            <label key={r.name} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={r.name} defaultChecked={!!d[r.name]} className="size-4" />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="عنوان SEO (بالإنجليزية)"><input name="metaTitleEn" defaultValue={d.metaTitleEn ?? ''} className={inputCls} /></Field>
        <Field label="وصف SEO (بالإنجليزية)"><input name="metaDescEn" defaultValue={d.metaDescEn ?? ''} className={inputCls} /></Field>
        <Field label="ملخص الذكاء الاصطناعي (بالإنجليزية)" hint="لمحركات AEO / الذكاء الاصطناعي."><textarea name="aiSummaryEn" rows={2} defaultValue={d.aiSummaryEn ?? ''} className={inputCls} /></Field>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton>حفظ المنتج</SubmitButton>
        <Link href="/admin/products" className="text-sm text-muted-foreground hover:underline">إلغاء</Link>
      </div>
    </form>
  );
}
