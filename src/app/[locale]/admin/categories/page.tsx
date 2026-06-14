import { setRequestLocale } from 'next-intl/server';
import { listCategories } from '@/lib/taxonomy-service';
import { AdminList } from '@/components/admin/resource-list';

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const categories = await listCategories();
  return (
    <AdminList
      title="Categories"
      newHref="/admin/categories/edit"
      newLabel="New category"
      head={['Name', 'Parent', 'Slug']}
      rows={categories.map((c) => ({
        key: c.id,
        cells: [c.nameEn, c.parent?.nameEn ?? '—', c.slug],
        editHref: `/admin/categories/edit/${c.id}`,
      }))}
    />
  );
}
