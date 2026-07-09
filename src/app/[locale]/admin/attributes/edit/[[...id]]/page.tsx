import { setRequestLocale } from 'next-intl/server';
import { getAttribute } from '@/lib/taxonomy-service';
import {
  saveAttributeAction, addAttributeValueAction, deleteAttributeValueAction,
  updateAttributeValueSlugAction, moveAttributeValueAction,
} from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { inputCls } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

export default async function AttributeEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const FIELDS: FieldSpec[] = [
    { name: 'key', label: tb('Key (technical identifier, e.g. size)', 'المفتاح (مُعرّف تقني، مثل size)'), type: 'text', required: true },
    { name: 'nameEn', label: tb('Name (English)', 'الاسم (بالإنجليزية)'), type: 'text', required: true },
    { name: 'nameAr', label: tb('Name (Arabic)', 'الاسم (بالعربية)'), type: 'text' },
    { name: 'kinds', label: tb('Applies to (one or more product types)', 'ينطبق على (نوع منتج أو أكثر)'), type: 'multiselect', options: [
      { value: 'SUPPLEMENT', label: tb('Supplement', 'مكمل غذائي') },
      { value: 'DEVICE', label: tb('Device', 'جهاز') },
      { value: 'INJECTION', label: tb('Injection', 'حقن') },
    ] },
    { name: 'inputType', label: tb('Selection', 'الاختيار'), type: 'select', options: [
      { value: 'SINGLE_SELECT', label: tb('Single-select (one value)', 'اختيار واحد') },
      { value: 'MULTI_SELECT', label: tb('Multi-select (many values)', 'اختيار متعدد') },
    ] },
    { name: 'descriptionEn', label: tb('Description / purpose (English)', 'الوصف / الغرض (إنجليزي)'), type: 'textarea', hint: tb('Admin helper text.', 'نص مساعد للمشرف.') },
    { name: 'descriptionAr', label: tb('Description / purpose (Arabic)', 'الوصف / الغرض (عربي)'), type: 'textarea' },
    { name: 'unit', label: tb('Unit (optional, e.g. mg, ml)', 'الوحدة (اختياري، مثل mg، ml)'), type: 'text' },
    { name: 'isFilterable', label: tb('Show as a storefront filter (facet)', 'عرضه كفلتر في المتجر'), type: 'checkbox' },
    { name: 'isRequired', label: tb('Required on the product form', 'مطلوب في نموذج المنتج'), type: 'checkbox' },
  ];
  const attributeId = id?.[0];
  const attribute = attributeId ? await getAttribute(attributeId) : null;

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{attributeId ? tb('Edit attribute', 'تعديل الخاصية') : tb('New attribute', 'خاصية جديدة')}</h1>
      <EntityForm action={saveAttributeAction} fields={FIELDS} defaults={attribute ?? {}} id={attributeId} locale={locale} listHref="/admin/attributes" />

      {attribute && (
        <section className="mt-10 max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold">{tb('Values', 'القيم')}</h2>
          <ul className="mb-4 space-y-1">
            {attribute.values.map((v, i) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                <form action={moveAttributeValueAction} className="flex gap-0.5">
                  <input type="hidden" name="locale" value={locale} /><input type="hidden" name="attributeId" value={attribute.id} /><input type="hidden" name="valueId" value={v.id} />
                  <button name="dir" value="up" disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={tb('Move up', 'أعلى')}>↑</button>
                  <button name="dir" value="down" disabled={i === attribute.values.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={tb('Move down', 'أسفل')}>↓</button>
                </form>
                <span className="min-w-32 flex-1">{v.valueEn}{v.valueAr ? ` · ${v.valueAr}` : ''}</span>
                <form action={updateAttributeValueSlugAction} className="flex items-center gap-1">
                  <input type="hidden" name="locale" value={locale} /><input type="hidden" name="attributeId" value={attribute.id} /><input type="hidden" name="valueId" value={v.id} />
                  <input name="slug" defaultValue={v.slug ?? ''} dir="ltr" placeholder={tb('slug', 'المُعرّف')} className={`${inputCls} w-40 py-1 font-mono text-xs`} />
                  <button className="text-primary hover:underline" aria-label={tb('Save slug', 'حفظ المُعرّف')}>{tb('Save', 'حفظ')}</button>
                </form>
                <form action={deleteAttributeValueAction}>
                  <input type="hidden" name="locale" value={locale} /><input type="hidden" name="attributeId" value={attribute.id} /><input type="hidden" name="valueId" value={v.id} />
                  <button className="text-destructive hover:underline" aria-label={tb('Delete value', 'حذف القيمة')}>{tb('Remove', 'إزالة')}</button>
                </form>
              </li>
            ))}
            {attribute.values.length === 0 && <li className="text-sm text-muted-foreground">{tb('No values yet.', 'لا توجد قيم بعد.')}</li>}
          </ul>
          <form action={addAttributeValueAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="attributeId" value={attribute.id} />
            <input name="valueEn" placeholder={tb('Value (English)', 'القيمة (بالإنجليزية)')} required className={`${inputCls} w-44`} />
            <input name="valueAr" placeholder={tb('Value (Arabic)', 'القيمة (بالعربية)')} dir="rtl" className={`${inputCls} w-44`} />
            <input name="slug" placeholder={tb('slug (auto)', 'المُعرّف (تلقائي)')} dir="ltr" className={`${inputCls} w-36 font-mono text-xs`} />
            <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{tb('Add value', 'إضافة قيمة')}</button>
          </form>
        </section>
      )}
    </div>
  );
}
