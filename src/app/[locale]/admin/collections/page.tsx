import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listCollections } from '@/lib/content-service';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';
import { bulkSoftDeleteAction } from '@/server/bulk-actions';
import { parseListParams, listQs, clientPage, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';
import type { BulkOp } from '@/components/admin/bulk-bar';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CollectionsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const showingArchived = one(sp.archived) === '1';
  const lp = parseListParams(sp, { sortable: ['title', 'slug'], defaultSort: 'title', defaultDir: 'asc' });
  const all = (await listCollections()).filter((c) => (showingArchived ? c.status === 'ARCHIVED' : c.status !== 'ARCHIVED'));
  const { rows: collections, total } = clientPage(all, lp, { title: (c) => c.titleEn, slug: (c) => c.slug });
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');

  const basePath = `/${locale}/admin/collections`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined })}`;
  const done = one(sp.done);
  const ops: BulkOp[] = [
    showingArchived ? { value: 'restore', label: tb('Restore', 'استعادة') } : { value: 'archive', label: tb('Archive', 'أرشفة') },
    { value: 'delete', label: tb('Delete', 'حذف'), danger: true },
  ];

  return (
    <AdminList
      title={showingArchived ? `${tl('collections')} ${tc('archivedSuffix')}` : tl('collections')}
      newHref="/admin/collections/edit"
      count={total}
      head={[{ label: tf('title'), col: 'title' }, tf('type'), tf('status'), { label: tf('slug'), col: 'slug' }]}
      sortCtx={{ sort: lp.sort, dir: lp.dir, sp, basePath }}
      toolbar={<ArchivedToggle path="collections" showingArchived={showingArchived} />}
      notice={<>
        <InUseNotice show={one(sp.error) === 'in_use'} />
        {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Done — ${done} updated`, `تم — ${done}`)}{Number(one(sp.skip)) > 0 ? tb(`, ${one(sp.skip)} skipped (in use)`, `، ${one(sp.skip)} متخطّى`) : ''}.</p>}
      </>}
      bulk={{ formId: 'bulk-collections', action: bulkSoftDeleteAction, locale, back, ops, hidden: { entity: 'collection', path: 'collections' } }}
      pagination={{ page: lp.page, perPage: lp.perPage, total, sp, basePath, locale }}
      rows={collections.map((c) => ({
        key: c.id,
        cells: [c.titleEn, c.type, <StatusBadge key="s" status={c.status} />, c.slug],
        editHref: `/admin/collections/edit/${c.id}`,
        actions: <RowActions entity="collection" id={c.id} path="collections" locale={locale} archived={c.status === 'ARCHIVED'} />,
      }))}
    />
  );
}
