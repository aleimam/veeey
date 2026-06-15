import { setRequestLocale } from 'next-intl/server';
import { getAttribute } from '@/lib/taxonomy-service';
import { saveAttributeAction, addAttributeValueAction, deleteAttributeValueAction } from '@/server/admin-actions';
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
    { name: 'kind', label: tb('Applies to', 'ينطبق على'), type: 'select', options: [{ value: 'SUPPLEMENT', label: tb('Supplement', 'مكمل غذائي') }, { value: 'DEVICE', label: tb('Device', 'جهاز') }, { value: 'INJECTION', label: tb('Injection', 'حقن') }] },
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
            {attribute.values.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                <span>{v.valueEn}{v.valueAr ? ` · ${v.valueAr}` : ''}</span>
                <form action={deleteAttributeValueAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="attributeId" value={attribute.id} />
                  <input type="hidden" name="valueId" value={v.id} />
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
            <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{tb('Add value', 'إضافة قيمة')}</button>
          </form>
        </section>
      )}
    </div>
  );
}
