import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listTags } from '@/lib/taxonomy-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TagsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const showingArchived = one(sp.archived) === '1';
  const all = await listTags();
  const tags = all.filter((t) => (showingArchived ? t.archivedAt : !t.archivedAt));
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');
  return (
    <AdminList
      title={showingArchived ? `${tl('tags')} ${tc('archivedSuffix')}` : tl('tags')}
      newHref="/admin/tags/edit"
      head={[tf('name'), tf('nameAr'), tf('slug')]}
      toolbar={<ArchivedToggle path="tags" showingArchived={showingArchived} />}
      notice={<InUseNotice show={one(sp.error) === 'in_use'} />}
      rows={tags.map((t) => ({
        key: t.id,
        cells: [t.nameEn, t.nameAr ?? '—', t.slug],
        editHref: `/admin/tags/edit/${t.id}`,
        actions: <RowActions entity="tag" id={t.id} path="tags" locale={locale} archived={!!t.archivedAt} />,
      }))}
    />
  );
}
