import { setRequestLocale } from 'next-intl/server';
import { listPages } from '@/lib/content-service';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';

export default async function CmsPagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const pages = await listPages();
  return (
    <AdminList
      title="CMS Pages"
      newHref="/admin/content/pages/edit"
      newLabel="New page"
      head={['Title', 'Slug', 'Status']}
      rows={pages.map((p) => ({
        key: p.id,
        cells: [p.titleEn, p.slug, <StatusBadge key="s" status={p.status} />],
        editHref: `/admin/content/pages/edit/${p.id}`,
      }))}
    />
  );
}
