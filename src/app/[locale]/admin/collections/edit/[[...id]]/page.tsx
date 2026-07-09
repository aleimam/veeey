import { setRequestLocale } from 'next-intl/server';
import { getCollection } from '@/lib/content-service';
import { listCategories, listTags, listBrands, listAttributes } from '@/lib/taxonomy-service';
import { hydratePickerProducts } from '@/server/collection-actions';
import { parseRule, type RuleConfig } from '@/lib/collection-rules';
import { CollectionForm } from '@/components/admin/collection-form';
import type { RuleOptions } from '@/components/admin/collection-rule-builder';
import { pick } from '@/lib/admin-i18n';

export default async function CollectionEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const collectionId = id?.[0];
  const [collection, categories, tags, brands, attributes] = await Promise.all([
    collectionId ? getCollection(collectionId) : Promise.resolve(null),
    listCategories(),
    listTags(),
    listBrands(),
    listAttributes(),
  ]);
  const initialProducts = collection ? await hydratePickerProducts(collection.orderedProductIds) : [];

  const ruleOptions: RuleOptions = {
    categories: categories.map((c) => ({ value: c.id, label: c.nameEn })),
    tags: tags.map((t) => ({ value: t.id, label: t.nameEn })),
    brands: brands.map((b) => ({ value: b.id, label: b.nameEn })),
    attributes: attributes.map((a) => ({ id: a.id, name: a.nameEn, values: a.values.map((v) => ({ value: v.id, label: v.valueEn })) })),
  };

  // Prefer the stored structured rule; else seed conditions from the legacy
  // single category + tag slug so existing AUTO collections keep working.
  let initialRule: RuleConfig = parseRule(collection?.ruleJson ?? null);
  if (collection && initialRule.conditions.length === 0 && collection.type === 'AUTO') {
    const conds: RuleConfig['conditions'] = [];
    if (collection.ruleCategoryId) conds.push({ field: 'category', op: 'is', value: collection.ruleCategoryId });
    if (collection.ruleTagSlug) {
      const t = tags.find((x) => x.slug === collection.ruleTagSlug);
      if (t) conds.push({ field: 'tag', op: 'is', value: t.id });
    }
    initialRule = { match: 'ALL', conditions: conds };
  }

  const defaults = collection
    ? {
        titleEn: collection.titleEn, titleAr: collection.titleAr ?? '', slug: collection.slug,
        descriptionEn: collection.descriptionEn ?? '', descriptionAr: collection.descriptionAr ?? '',
        type: collection.type, status: collection.status, sortOrder: String(collection.sortOrder ?? 0),
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
        ruleOptions={ruleOptions}
        initialRule={initialRule}
        initialProducts={initialProducts}
      />
    </div>
  );
}
