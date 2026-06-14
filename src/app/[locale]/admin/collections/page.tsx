import { setRequestLocale } from 'next-intl/server';
import { listCollections } from '@/lib/content-service';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';

export default async function CollectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const collections = await listCollections();
  return (
    <AdminList
      title="Collections"
      newHref="/admin/collections/edit"
      newLabel="New collection"
      head={['Title', 'Type', 'Status', 'Slug']}
      rows={collections.map((c) => ({
        key: c.id,
        cells: [c.titleEn, c.type, <StatusBadge key="s" status={c.status} />, c.slug],
        editHref: `/admin/collections/edit/${c.id}`,
      }))}
    />
  );
}
