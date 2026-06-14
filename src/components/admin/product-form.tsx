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
  { name: 'restricted', label: 'Flag as restricted' },
  { name: 'restrictHideCatalog', label: 'Hide from public catalog' },
  { name: 'restrictHideFeeds', label: 'Hide from Google/Meta feeds' },
  { name: 'restrictDisableCards', label: 'Disable card payments' },
  { name: 'restrictRequireLogin', label: 'Require login' },
  { name: 'restrictAgeConsent', label: 'Require age/consent' },
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
        <Field label="Name (English)"><input name="nameEn" required defaultValue={d.nameEn ?? ''} className={inputCls} /></Field>
        <Field label="Name (Arabic)"><input name="nameAr" defaultValue={d.nameAr ?? ''} dir="rtl" className={inputCls} /></Field>
        <Field label="SKU" hint="Leave blank to auto-generate (VEY-…)."><input name="sku" defaultValue={d.sku ?? ''} className={inputCls} /></Field>
        <Field label="Brand">
          <select name="brandId" defaultValue={d.brandId ?? ''} className={inputCls}>
            <option value="">— none —</option>
            {brands.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="Slug (English)" hint="Leave blank to auto-generate."><input name="slugEn" defaultValue={d.slugEn ?? ''} className={inputCls} /></Field>
        <Field label="Slug (Arabic)" hint="Leave blank to auto-generate."><input name="slugAr" defaultValue={d.slugAr ?? ''} className={inputCls} /></Field>
        <Field label="Kind">
          <select name="kind" defaultValue={d.kind ?? 'SUPPLEMENT'} className={inputCls}>
            <option value="SUPPLEMENT">Supplement</option>
            <option value="DEVICE">Device</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={d.status ?? 'DRAFT'} className={inputCls}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </Field>
        <Field label="Base price (EGP)"><input name="basePriceEgp" type="number" step="0.01" min="0" defaultValue={d.basePriceEgp ?? 0} className={inputCls} /></Field>
        <Field label="Merchandising type">
          <select name="productType" defaultValue={d.productType ?? ''} className={inputCls}>
            <option value="">— none —</option>
            {['MISCELLANEOUS', 'MALE_SUPPORT', 'PREMIUM', 'NEW', 'TREND'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Weight (g)"><input name="weightG" type="number" min="0" defaultValue={d.weightG ?? ''} className={inputCls} /></Field>
        <Field label="Servings per unit" hint="Powers the duration calculator."><input name="servingsPerUnit" type="number" min="0" defaultValue={d.servingsPerUnit ?? ''} className={inputCls} /></Field>
        <Field label="Daily dosage" hint="Servings consumed per day."><input name="dailyDosage" type="number" min="0" defaultValue={d.dailyDosage ?? ''} className={inputCls} /></Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Short description (EN)"><textarea name="shortDescEn" rows={2} defaultValue={d.shortDescEn ?? ''} className={inputCls} /></Field>
        <Field label="Short description (AR)"><textarea name="shortDescAr" rows={2} dir="rtl" defaultValue={d.shortDescAr ?? ''} className={inputCls} /></Field>
        <Field label="Long description (EN)"><textarea name="longDescEn" rows={4} defaultValue={d.longDescEn ?? ''} className={inputCls} /></Field>
        <Field label="Long description (AR)"><textarea name="longDescAr" rows={4} dir="rtl" defaultValue={d.longDescAr ?? ''} className={inputCls} /></Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="Categories" hint="Ctrl/Cmd to multi-select.">
          <select name="categoryIds" multiple defaultValue={d.categoryIds ?? []} className={`${inputCls} h-32`}>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Tags" hint="Ctrl/Cmd to multi-select.">
          <select name="tagIds" multiple defaultValue={d.tagIds ?? []} className={`${inputCls} h-32`}>
            {tags.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Attributes" hint="Ctrl/Cmd to multi-select.">
          <select name="attributeValueIds" multiple defaultValue={d.attributeValueIds ?? []} className={`${inputCls} h-32`}>
            {attributeValues.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </Field>
      </section>

      <section>
        <p className="mb-2 text-sm font-medium">Images</p>
        <ImageUploader initial={d.imageUrls ?? []} />
      </section>

      <fieldset className="rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Restriction profile (default off)</legend>
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
        <Field label="SEO title (EN)"><input name="metaTitleEn" defaultValue={d.metaTitleEn ?? ''} className={inputCls} /></Field>
        <Field label="SEO description (EN)"><input name="metaDescEn" defaultValue={d.metaDescEn ?? ''} className={inputCls} /></Field>
        <Field label="AI summary (EN)" hint="For AEO / AI engines."><textarea name="aiSummaryEn" rows={2} defaultValue={d.aiSummaryEn ?? ''} className={inputCls} /></Field>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton>Save product</SubmitButton>
        <Link href="/admin/products" className="text-sm text-muted-foreground hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
