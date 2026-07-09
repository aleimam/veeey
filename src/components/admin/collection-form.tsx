'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { saveCollectionAction, type AdminFormState } from '@/server/admin-actions';
import type { PickerProduct } from '@/server/collection-actions';
import { pick } from '@/lib/admin-i18n';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { SlugField } from './slug-field';
import { RichTextField } from './rich-text/field';
import { SingleImageUploader } from './image-uploader';
import { CollectionProductPicker } from './collection-product-picker';

type Opt = { value: string; label: string };

/**
 * Bespoke collection create/edit form (V3-COL-2/3). Unlike the generic
 * EntityForm it needs a searchable product picker and conditional field display
 * (Manual → picker, Automatic → rule fields). Reuses the shared SlugField and
 * the unsaved-changes guard pattern.
 */
export function CollectionForm({
  locale, id, defaults, categoryOptions, initialProducts,
}: {
  locale: string;
  id?: string;
  defaults: Record<string, unknown>;
  categoryOptions: Opt[];
  initialProducts: PickerProduct[];
}) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(saveCollectionAction, {});
  const tc = useTranslations('admin.common');
  const tb = pick(locale);
  const router = useRouter();

  const s = (k: string) => (defaults[k] as string) ?? '';
  const [titleEn, setTitleEn] = useState(s('titleEn'));
  const [titleAr, setTitleAr] = useState(s('titleAr'));
  const [slug, setSlug] = useState(s('slug'));
  const [type, setType] = useState(s('type') || 'MANUAL');
  const [status, setStatus] = useState(s('status') || 'DRAFT');
  const [ruleCategoryId, setRuleCategoryId] = useState(s('ruleCategoryId'));
  const [ruleTagSlug, setRuleTagSlug] = useState(s('ruleTagSlug'));
  const [dirty, setDirty] = useState(false);
  const touch = () => setDirty(true);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const cancel = () => { if (dirty && !confirm(tc('unsavedLeave'))) return; router.push('/admin/collections'); };
  const isManual = type === 'MANUAL';

  return (
    <form action={formAction} onChange={touch} className="max-w-2xl space-y-5">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {id && <input type="hidden" name="id" value={id} />}

      <Field label={tb('Title (English)', 'العنوان (إنجليزي)')}>
        <input name="titleEn" value={titleEn} onChange={(e) => { setTitleEn(e.target.value); touch(); }} required className={inputCls} />
      </Field>
      <Field label={tb('Title (Arabic)', 'العنوان (عربي)')}>
        <input name="titleAr" value={titleAr} onChange={(e) => { setTitleAr(e.target.value); touch(); }} dir="rtl" className={inputCls} />
      </Field>
      <SlugField fieldName="slug" label={tb('Slug', 'المُعرّف')} value={slug} onChange={(v) => { setSlug(v); touch(); }} sourceName={titleEn} entity="collection" id={id} />

      <Field label={tb('Description (English)', 'الوصف (إنجليزي)')}>
        <RichTextField name="descriptionEn" initial={s('descriptionEn')} compact />
      </Field>
      <Field label={tb('Description (Arabic)', 'الوصف (عربي)')}>
        <RichTextField name="descriptionAr" initial={s('descriptionAr')} compact />
      </Field>

      {/* Banner: image + bilingual alt text (a11y + SEO). */}
      <Field label={tb('Banner image', 'صورة البانر')} hint={tb('Drag & drop, paste, or click to upload.', 'اسحب وأفلت أو الصق أو انقر للرفع.')}>
        <SingleImageUploader name="imageUrl" initial={s('imageUrl')} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={tb('Banner alt (English)', 'نص بديل (إنجليزي)')}>
          <input name="imageAltEn" defaultValue={s('imageAltEn')} className={inputCls} />
        </Field>
        <Field label={tb('Banner alt (Arabic)', 'نص بديل (عربي)')}>
          <input name="imageAltAr" defaultValue={s('imageAltAr')} dir="rtl" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={tb('Type', 'النوع')}>
          <select name="type" value={type} onChange={(e) => { setType(e.target.value); touch(); }} className={inputCls}>
            <option value="MANUAL">{tb('Manual selection', 'اختيار يدوي')}</option>
            <option value="AUTO">{tb('Automatic (rule)', 'تلقائي (قاعدة)')}</option>
          </select>
        </Field>
        <Field label={tb('Status', 'الحالة')}>
          <select name="status" value={status} onChange={(e) => { setStatus(e.target.value); touch(); }} className={inputCls}>
            <option value="DRAFT">{tb('Draft', 'مسودة')}</option>
            <option value="PUBLISHED">{tb('Published', 'منشور')}</option>
            <option value="ARCHIVED">{tb('Archived', 'مؤرشف')}</option>
          </select>
        </Field>
      </div>

      {/* Conditional: only the fields relevant to the selected type are active. */}
      {isManual ? (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">{tb('Products', 'المنتجات')}</p>
          <CollectionProductPicker initial={initialProducts} onDirty={touch} />
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-border p-3">
          <p className="text-sm font-medium text-foreground">{tb('Automatic rule', 'قاعدة تلقائية')}</p>
          <Field label={tb('Category', 'الفئة')}>
            <select name="ruleCategoryId" value={ruleCategoryId} onChange={(e) => { setRuleCategoryId(e.target.value); touch(); }} className={inputCls}>
              <option value="">{tb('— None —', '— بدون —')}</option>
              {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label={tb('Tag slug', 'مُعرّف الوسم')}>
            <input name="ruleTagSlug" value={ruleTagSlug} onChange={(e) => { setRuleTagSlug(e.target.value); touch(); }} dir="ltr" className={inputCls} />
          </Field>
          <p className="text-xs text-muted-foreground">{tb('Products matching the category and/or tag are included automatically. A richer condition builder is coming.', 'تُضاف المنتجات المطابقة للفئة و/أو الوسم تلقائيًا. أداة شروط أكثر تفصيلًا قادمة.')}</p>
        </div>
      )}

      {/* SEO — collection landing pages are indexable; meta title/desc EN+AR. */}
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">{tb('SEO (search engine listing)', 'تحسين محركات البحث')}</summary>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={tb('Meta title (English)', 'عنوان ميتا (إنجليزي)')}>
            <input name="metaTitleEn" defaultValue={s('metaTitleEn')} className={inputCls} />
          </Field>
          <Field label={tb('Meta title (Arabic)', 'عنوان ميتا (عربي)')}>
            <input name="metaTitleAr" defaultValue={s('metaTitleAr')} dir="rtl" className={inputCls} />
          </Field>
          <Field label={tb('Meta description (English)', 'وصف ميتا (إنجليزي)')}>
            <textarea name="metaDescEn" defaultValue={s('metaDescEn')} rows={2} className={inputCls} />
          </Field>
          <Field label={tb('Meta description (Arabic)', 'وصف ميتا (عربي)')}>
            <textarea name="metaDescAr" defaultValue={s('metaDescAr')} rows={2} dir="rtl" className={inputCls} />
          </Field>
        </div>
      </details>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
        <button type="button" onClick={cancel} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface">{tc('cancel')}</button>
      </div>
    </form>
  );
}
