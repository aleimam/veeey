import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listPages } from '@/lib/content-service';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CmsPagesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const showingArchived = one(sp.archived) === '1';
  const all = await listPages();
  const pages = all.filter((p) => (showingArchived ? p.status === 'ARCHIVED' : p.status !== 'ARCHIVED'));
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');
  return (
    <AdminList
      title={showingArchived ? `${tl('cmsPages')} ${tc('archivedSuffix')}` : tl('cmsPages')}
      newHref="/admin/content/pages/edit"
      head={[tf('title'), tf('slug'), tf('status')]}
      toolbar={<ArchivedToggle path="content/pages" showingArchived={showingArchived} />}
      notice={<InUseNotice show={one(sp.error) === 'in_use'} />}
      rows={pages.map((p) => ({
        key: p.id,
        cells: [p.titleEn, p.slug, <StatusBadge key="s" status={p.status} />],
        editHref: `/admin/content/pages/edit/${p.id}`,
        actions: <RowActions entity="page" id={p.id} path="content/pages" locale={locale} archived={p.status === 'ARCHIVED'} />,
      }))}
    />
  );
}
