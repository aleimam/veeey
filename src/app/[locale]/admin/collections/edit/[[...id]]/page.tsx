import { setRequestLocale } from 'next-intl/server';
import { getCollection } from '@/lib/content-service';
import { listCategories } from '@/lib/taxonomy-service';
import { listProducts } from '@/lib/catalog-service';
import { saveCollectionAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';

const STATUS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export default async function CollectionEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const collectionId = id?.[0];
  const [collection, categories, products] = await Promise.all([
    collectionId ? getCollection(collectionId) : Promise.resolve(null),
    listCategories(),
    listProducts(),
  ]);

  const fields: FieldSpec[] = [
    { name: 'titleEn', label: 'Title (English)', type: 'text', required: true },
    { name: 'titleAr', label: 'Title (Arabic)', type: 'text' },
    { name: 'slug', label: 'Slug', type: 'slug' },
    { name: 'descriptionEn', label: 'Description (EN)', type: 'textarea' },
    { name: 'type', label: 'Type', type: 'select', options: [{ value: 'MANUAL', label: 'Manual picks' }, { value: 'AUTO', label: 'Auto (rule)' }] },
    { name: 'status', label: 'Status', type: 'select', options: STATUS },
    { name: 'ruleCategoryId', label: 'Auto rule: category', type: 'select', options: [{ value: '', label: '— none —' }, ...categories.map((c) => ({ value: c.id, label: c.nameEn }))] },
    { name: 'ruleTagSlug', label: 'Auto rule: tag slug', type: 'text' },
    { name: 'productIds', label: 'Manual products', type: 'multiselect', options: products.map((p) => ({ value: p.id, label: p.nameEn })) },
  ];

  const defaults = collection
    ? { ...collection, productIds: collection.products.map((p) => p.id) }
    : {};

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{collectionId ? 'Edit collection' : 'New collection'}</h1>
      <EntityForm action={saveCollectionAction} fields={fields} defaults={defaults} id={collectionId} locale={locale} listHref="/admin/collections" />
    </div>
  );
}
