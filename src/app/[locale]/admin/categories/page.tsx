import { setRequestLocale } from 'next-intl/server';
import { listCategories } from '@/lib/taxonomy-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CategoriesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const showingArchived = one(sp.archived) === '1';
  const all = await listCategories();
  const categories = all.filter((c) => (showingArchived ? c.archivedAt : !c.archivedAt));
  return (
    <AdminList
      title={showingArchived ? 'Categories (archived)' : 'Categories'}
      newHref="/admin/categories/edit"
      newLabel="New category"
      head={['Name', 'Parent', 'Slug']}
      toolbar={<ArchivedToggle path="categories" showingArchived={showingArchived} />}
      notice={<InUseNotice show={one(sp.error) === 'in_use'} />}
      rows={categories.map((c) => ({
        key: c.id,
        cells: [c.nameEn, c.parent?.nameEn ?? '—', c.slug],
        editHref: `/admin/categories/edit/${c.id}`,
        actions: <RowActions entity="category" id={c.id} path="categories" locale={locale} archived={!!c.archivedAt} />,
      }))}
    />
  );
}
