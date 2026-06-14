import { setRequestLocale } from 'next-intl/server';
import { listTags } from '@/lib/taxonomy-service';
import { AdminList } from '@/components/admin/resource-list';

export default async function TagsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tags = await listTags();
  return (
    <AdminList
      title="Tags"
      newHref="/admin/tags/edit"
      newLabel="New tag"
      head={['Name', 'Arabic', 'Slug']}
      rows={tags.map((t) => ({ key: t.id, cells: [t.nameEn, t.nameAr ?? '—', t.slug], editHref: `/admin/tags/edit/${t.id}` }))}
    />
  );
}
