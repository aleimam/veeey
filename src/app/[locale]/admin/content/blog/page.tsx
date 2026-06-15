import { setRequestLocale } from 'next-intl/server';
import { listPosts } from '@/lib/content-service';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BlogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const showingArchived = one(sp.archived) === '1';
  const all = await listPosts();
  const posts = all.filter((p) => (showingArchived ? p.status === 'ARCHIVED' : p.status !== 'ARCHIVED'));
  return (
    <AdminList
      title={showingArchived ? 'Blog Posts (archived)' : 'Blog Posts'}
      newHref="/admin/content/blog/edit"
      newLabel="New post"
      head={['Title', 'Slug', 'Status']}
      toolbar={<ArchivedToggle path="content/blog" showingArchived={showingArchived} />}
      notice={<InUseNotice show={one(sp.error) === 'in_use'} />}
      rows={posts.map((p) => ({
        key: p.id,
        cells: [p.titleEn, p.slug, <StatusBadge key="s" status={p.status} />],
        editHref: `/admin/content/blog/edit/${p.id}`,
        actions: <RowActions entity="post" id={p.id} path="content/blog" locale={locale} archived={p.status === 'ARCHIVED'} />,
      }))}
    />
  );
}
