import { setRequestLocale } from 'next-intl/server';
import { listPosts } from '@/lib/content-service';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const posts = await listPosts();
  return (
    <AdminList
      title="Blog Posts"
      newHref="/admin/content/blog/edit"
      newLabel="New post"
      head={['Title', 'Slug', 'Status']}
      rows={posts.map((p) => ({
        key: p.id,
        cells: [p.titleEn, p.slug, <StatusBadge key="s" status={p.status} />],
        editHref: `/admin/content/blog/edit/${p.id}`,
      }))}
    />
  );
}
