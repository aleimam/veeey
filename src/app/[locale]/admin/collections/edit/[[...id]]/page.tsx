import { setRequestLocale } from 'next-intl/server';
import { getCollection } from '@/lib/content-service';
import { listCategories } from '@/lib/taxonomy-service';
import { listProducts } from '@/lib/catalog-service';
import { saveCollectionAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { pick } from '@/lib/admin-i18n';

export default async function CollectionEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const STATUS = [
    { value: 'DRAFT', label: tb('Draft', 'مسودة') },
    { value: 'PUBLISHED', label: tb('Published', 'منشور') },
    { value: 'ARCHIVED', label: tb('Archived', 'مؤرشف') },
  ];
  const collectionId = id?.[0];
  const [collection, categories, products] = await Promise.all([
    collectionId ? getCollection(collectionId) : Promise.resolve(null),
    listCategories(),
    listProducts(),
  ]);

  const fields: FieldSpec[] = [
    { name: 'titleEn', label: tb('Title (English)', 'العنوان (إنجليزي)'), type: 'text', required: true },
    { name: 'titleAr', label: tb('Title (Arabic)', 'العنوان (عربي)'), type: 'text' },
    { name: 'slug', label: tb('Slug', 'المُعرّف'), type: 'slug' },
    { name: 'descriptionEn', label: tb('Description (English)', 'الوصف (إنجليزي)'), type: 'rich', compact: true },
    { name: 'type', label: tb('Type', 'النوع'), type: 'select', options: [{ value: 'MANUAL', label: tb('Manual selection', 'اختيار يدوي') }, { value: 'AUTO', label: tb('Automatic (rule)', 'تلقائي (قاعدة)') }] },
    { name: 'status', label: tb('Status', 'الحالة'), type: 'select', options: STATUS },
    { name: 'ruleCategoryId', label: tb('Auto rule: category', 'قاعدة تلقائية: الفئة'), type: 'select', options: [{ value: '', label: tb('— None —', '— بدون —') }, ...categories.map((c) => ({ value: c.id, label: c.nameEn }))] },
    { name: 'ruleTagSlug', label: tb('Auto rule: tag slug', 'قاعدة تلقائية: مُعرّف الوسم'), type: 'text' },
    { name: 'productIds', label: tb('Manual products', 'منتجات يدوية'), type: 'multiselect', options: products.map((p) => ({ value: p.id, label: p.nameEn })) },
  ];

  const defaults = collection
    ? { ...collection, productIds: collection.products.map((p) => p.id) }
    : {};

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{collectionId ? tb('Edit collection', 'تعديل المجموعة') : tb('New collection', 'مجموعة جديدة')}</h1>
      <EntityForm action={saveCollectionAction} fields={fields} defaults={defaults} id={collectionId} locale={locale} listHref="/admin/collections" />
    </div>
  );
}
