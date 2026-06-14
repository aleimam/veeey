import { setRequestLocale } from 'next-intl/server';
import { getAttribute } from '@/lib/taxonomy-service';
import { saveAttributeAction, addAttributeValueAction, deleteAttributeValueAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { inputCls } from '@/components/admin/ui';

const FIELDS: FieldSpec[] = [
  { name: 'key', label: 'Key (machine id, e.g. size)', type: 'text', required: true },
  { name: 'nameEn', label: 'Name (English)', type: 'text', required: true },
  { name: 'nameAr', label: 'Name (Arabic)', type: 'text' },
  { name: 'kind', label: 'Applies to', type: 'select', options: [{ value: 'SUPPLEMENT', label: 'Supplement' }, { value: 'DEVICE', label: 'Device' }, { value: 'OTHER', label: 'Other' }] },
];

export default async function AttributeEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const attributeId = id?.[0];
  const attribute = attributeId ? await getAttribute(attributeId) : null;

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{attributeId ? 'Edit attribute' : 'New attribute'}</h1>
      <EntityForm action={saveAttributeAction} fields={FIELDS} defaults={attribute ?? {}} id={attributeId} locale={locale} listHref="/admin/attributes" />

      {attribute && (
        <section className="mt-10 max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold">Values</h2>
          <ul className="mb-4 space-y-1">
            {attribute.values.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                <span>{v.valueEn}{v.valueAr ? ` · ${v.valueAr}` : ''}</span>
                <form action={deleteAttributeValueAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="attributeId" value={attribute.id} />
                  <input type="hidden" name="valueId" value={v.id} />
                  <button className="text-destructive hover:underline" aria-label="Delete value">Remove</button>
                </form>
              </li>
            ))}
            {attribute.values.length === 0 && <li className="text-sm text-muted-foreground">No values yet.</li>}
          </ul>
          <form action={addAttributeValueAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="attributeId" value={attribute.id} />
            <input name="valueEn" placeholder="Value (EN)" required className={`${inputCls} w-44`} />
            <input name="valueAr" placeholder="Value (AR)" dir="rtl" className={`${inputCls} w-44`} />
            <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Add value</button>
          </form>
        </section>
      )}
    </div>
  );
}
