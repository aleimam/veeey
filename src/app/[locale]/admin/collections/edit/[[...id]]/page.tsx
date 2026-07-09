import { setRequestLocale } from 'next-intl/server';
import { getCollection } from '@/lib/content-service';
import { listCategories } from '@/lib/taxonomy-service';
import { hydratePickerProducts } from '@/server/collection-actions';
import { CollectionForm } from '@/components/admin/collection-form';
import { pick } from '@/lib/admin-i18n';

export default async function CollectionEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const collectionId = id?.[0];
  const [collection, categories] = await Promise.all([
    collectionId ? getCollection(collectionId) : Promise.resolve(null),
    listCategories(),
  ]);
  const initialProducts = collection ? await hydratePickerProducts(collection.orderedProductIds) : [];

  const defaults = collection
    ? {
        titleEn: collection.titleEn, titleAr: collection.titleAr ?? '', slug: collection.slug,
        descriptionEn: collection.descriptionEn ?? '', descriptionAr: collection.descriptionAr ?? '',
        type: collection.type, status: collection.status,
        ruleCategoryId: collection.ruleCategoryId ?? '', ruleTagSlug: collection.ruleTagSlug ?? '',
        imageUrl: collection.imageUrl ?? '', imageAltEn: collection.imageAltEn ?? '', imageAltAr: collection.imageAltAr ?? '',
        metaTitleEn: collection.metaTitleEn ?? '', metaTitleAr: collection.metaTitleAr ?? '',
        metaDescEn: collection.metaDescEn ?? '', metaDescAr: collection.metaDescAr ?? '',
      }
    : {};

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{collectionId ? tb('Edit collection', 'تعديل المجموعة') : tb('New collection', 'مجموعة جديدة')}</h1>
      <CollectionForm
        locale={locale}
        id={collectionId}
        defaults={defaults}
        categoryOptions={categories.map((c) => ({ value: c.id, label: c.nameEn }))}
        initialProducts={initialProducts}
      />
    </div>
  );
}
