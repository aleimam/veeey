import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listBrands } from '@/lib/taxonomy-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BrandsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const showingArchived = one(sp.archived) === '1';
  const all = await listBrands();
  const brands = all.filter((b) => (showingArchived ? b.archivedAt : !b.archivedAt));
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');
  return (
    <AdminList
      title={showingArchived ? `${tl('brands')} ${tc('archivedSuffix')}` : tl('brands')}
      newHref="/admin/brands/edit"
      head={[tf('name'), tf('nameAr'), tf('slug')]}
      toolbar={<ArchivedToggle path="brands" showingArchived={showingArchived} />}
      notice={<InUseNotice show={one(sp.error) === 'in_use'} />}
      rows={brands.map((b) => ({
        key: b.id,
        cells: [b.nameEn, b.nameAr ?? '—', b.slug],
        editHref: `/admin/brands/edit/${b.id}`,
        actions: <RowActions entity="brand" id={b.id} path="brands" locale={locale} archived={!!b.archivedAt} />,
      }))}
    />
  );
}
