import { setRequestLocale } from 'next-intl/server';
import { listCollections } from '@/lib/content-service';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CollectionsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const showingArchived = one(sp.archived) === '1';
  const all = await listCollections();
  const collections = all.filter((c) => (showingArchived ? c.status === 'ARCHIVED' : c.status !== 'ARCHIVED'));
  return (
    <AdminList
      title={showingArchived ? 'Collections (archived)' : 'Collections'}
      newHref="/admin/collections/edit"
      newLabel="New collection"
      head={['Title', 'Type', 'Status', 'Slug']}
      toolbar={<ArchivedToggle path="collections" showingArchived={showingArchived} />}
      notice={<InUseNotice show={one(sp.error) === 'in_use'} />}
      rows={collections.map((c) => ({
        key: c.id,
        cells: [c.titleEn, c.type, <StatusBadge key="s" status={c.status} />, c.slug],
        editHref: `/admin/collections/edit/${c.id}`,
        actions: <RowActions entity="collection" id={c.id} path="collections" locale={locale} archived={c.status === 'ARCHIVED'} />,
      }))}
    />
  );
}
