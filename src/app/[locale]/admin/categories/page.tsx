import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listCategories } from '@/lib/taxonomy-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { FilterBar } from '@/components/admin/filter-bar';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CategoriesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const showingArchived = one(sp.archived) === '1';
  const q = one(sp.q);
  const all = await listCategories({ q });
  const categories = all.filter((c) => (showingArchived ? c.archivedAt : !c.archivedAt));
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');
  return (
    <div>
      <FilterBar
        fields={[{ name: 'q', label: locale === 'ar' ? 'بحث' : 'Search', type: 'text' }]}
        values={{ q }}
        locale={locale}
        path="categories"
      />
      <AdminList
      title={showingArchived ? `${tl('categories')} ${tc('archivedSuffix')}` : tl('categories')}
      newHref="/admin/categories/edit"
      head={[tf('name'), tf('parent'), tf('slug')]}
      toolbar={<div className="flex items-center gap-3"><ExportBar entity="categories" locale={locale} query={exportQs(sp)} /><ArchivedToggle path="categories" showingArchived={showingArchived} /></div>}
      notice={<InUseNotice show={one(sp.error) === 'in_use'} />}
      rows={categories.map((c) => ({
        key: c.id,
        cells: [c.nameEn, c.parent?.nameEn ?? '—', c.slug],
        editHref: `/admin/categories/edit/${c.id}`,
        actions: <RowActions entity="category" id={c.id} path="categories" locale={locale} archived={!!c.archivedAt} />,
      }))}
      />
    </div>
  );
}
